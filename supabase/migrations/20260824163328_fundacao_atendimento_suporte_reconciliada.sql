
ALTER TABLE public.chamados_suporte
  ADD COLUMN IF NOT EXISTS atendente_id uuid,
  ADD COLUMN IF NOT EXISTS data_resolucao timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.chamados_suporte'::regclass
      AND conname = 'chamados_suporte_atendente_id_fkey'
  ) THEN
    ALTER TABLE public.chamados_suporte
      ADD CONSTRAINT chamados_suporte_atendente_id_fkey
      FOREIGN KEY (atendente_id) REFERENCES public.admin_users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.mensagens_suporte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id uuid NOT NULL,
  autor_usuario_id uuid,
  autor_admin_id uuid,
  corpo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mensagens_suporte
  DROP CONSTRAINT IF EXISTS mensagens_suporte_chamado_id_fkey,
  DROP CONSTRAINT IF EXISTS mensagens_suporte_autor_usuario_id_fkey,
  DROP CONSTRAINT IF EXISTS mensagens_suporte_autor_admin_id_fkey,
  DROP CONSTRAINT IF EXISTS exatamente_um_autor,
  DROP CONSTRAINT IF EXISTS corpo_valido;

ALTER TABLE public.mensagens_suporte
  ADD CONSTRAINT mensagens_suporte_chamado_id_fkey
    FOREIGN KEY (chamado_id) REFERENCES public.chamados_suporte(id) ON DELETE CASCADE,
  ADD CONSTRAINT mensagens_suporte_autor_usuario_id_fkey
    FOREIGN KEY (autor_usuario_id) REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  ADD CONSTRAINT mensagens_suporte_autor_admin_id_fkey
    FOREIGN KEY (autor_admin_id) REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  ADD CONSTRAINT exatamente_um_autor
    CHECK (num_nonnulls(autor_usuario_id, autor_admin_id) = 1),
  ADD CONSTRAINT corpo_valido
    CHECK (corpo = btrim(corpo) AND char_length(corpo) BETWEEN 1 AND 2000);

CREATE INDEX IF NOT EXISTS idx_mensagens_chamado_id
  ON public.mensagens_suporte(chamado_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_created_at
  ON public.mensagens_suporte(created_at);
CREATE INDEX IF NOT EXISTS idx_mensagens_autor_usuario
  ON public.mensagens_suporte(autor_usuario_id)
  WHERE autor_usuario_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mensagens_autor_admin
  ON public.mensagens_suporte(autor_admin_id)
  WHERE autor_admin_id IS NOT NULL;

ALTER TABLE public.mensagens_suporte ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Passageiro vê mensagens de seus chamados"
  ON public.mensagens_suporte;

CREATE POLICY "Passageiro vê mensagens de seus chamados"
  ON public.mensagens_suporte
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.chamados_suporte c
      JOIN public.usuarios u ON u.id = c.usuario_id
      WHERE c.id = mensagens_suporte.chamado_id
        AND u.auth_user_id = (SELECT auth.uid())
    )
  );

REVOKE ALL ON TABLE public.mensagens_suporte FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.mensagens_suporte FROM authenticated;
GRANT SELECT ON TABLE public.mensagens_suporte TO authenticated;
GRANT ALL ON TABLE public.mensagens_suporte TO service_role;

CREATE OR REPLACE FUNCTION public.get_admin_id_by_auth(auth_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO pg_catalog, public
AS $$
  SELECT a.id
  FROM public.admin_users a
  WHERE a.auth_user_id = auth_id
    AND a.ativo = true
    AND a.role = 'admin'
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_admin_id_by_auth(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_id_by_auth(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.suporte_iniciar_atendimento(
  _chamado_id uuid,
  _admin_auth_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO pg_catalog, public
AS $$
DECLARE
  v_admin_id uuid;
  v_status public.status_chamado_suporte;
  v_atendente_id uuid;
BEGIN
  SELECT a.id INTO v_admin_id
  FROM public.admin_users a
  WHERE a.auth_user_id = _admin_auth_id
    AND a.ativo = true
    AND a.role = 'admin';

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Administrador não autorizado ou inativo.';
  END IF;

  SELECT c.status, c.atendente_id
    INTO v_status, v_atendente_id
  FROM public.chamados_suporte c
  WHERE c.id = _chamado_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado não encontrado.';
  END IF;
  IF v_status <> 'aberto' THEN
    RAISE EXCEPTION 'Somente chamados abertos podem iniciar atendimento.';
  END IF;

  UPDATE public.chamados_suporte
  SET status = 'em_atendimento',
      atendente_id = v_admin_id,
      data_resolucao = NULL,
      updated_at = now()
  WHERE id = _chamado_id;

  INSERT INTO public.admin_audit_logs
    (admin_auth_id, acao, entidade, entidade_id, estado_anterior, estado_novo)
  VALUES
    (_admin_auth_id, 'iniciar_atendimento', 'chamados_suporte', _chamado_id,
     jsonb_build_object('status', v_status, 'atendente_id', v_atendente_id),
     jsonb_build_object('status', 'em_atendimento', 'atendente_id', v_admin_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.suporte_responder_chamado(
  _chamado_id uuid,
  _admin_auth_id uuid,
  _corpo text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO pg_catalog, public
AS $$
DECLARE
  v_admin_id uuid;
  v_status public.status_chamado_suporte;
  v_corpo text := btrim(coalesce(_corpo, ''));
BEGIN
  SELECT a.id INTO v_admin_id
  FROM public.admin_users a
  WHERE a.auth_user_id = _admin_auth_id
    AND a.ativo = true
    AND a.role = 'admin';

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Administrador não autorizado ou inativo.';
  END IF;
  IF char_length(v_corpo) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'Mensagem deve possuir entre 1 e 2000 caracteres.';
  END IF;

  SELECT c.status INTO v_status
  FROM public.chamados_suporte c
  WHERE c.id = _chamado_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado não encontrado.';
  END IF;
  IF v_status <> 'em_atendimento' THEN
    RAISE EXCEPTION 'Chamado deve estar em atendimento para receber resposta.';
  END IF;

  INSERT INTO public.mensagens_suporte
    (chamado_id, autor_usuario_id, autor_admin_id, corpo)
  VALUES
    (_chamado_id, NULL, v_admin_id, v_corpo);

  INSERT INTO public.admin_audit_logs
    (admin_auth_id, acao, entidade, entidade_id, estado_anterior, estado_novo)
  VALUES
    (_admin_auth_id, 'responder_chamado', 'chamados_suporte', _chamado_id,
     jsonb_build_object('status', v_status),
     jsonb_build_object('status', v_status, 'mensagem_administrativa', true));
END;
$$;

CREATE OR REPLACE FUNCTION public.suporte_resolver_chamado(
  _chamado_id uuid,
  _admin_auth_id uuid,
  _mensagem_final text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO pg_catalog, public
AS $$
DECLARE
  v_admin_id uuid;
  v_status public.status_chamado_suporte;
  v_atendente_id uuid;
  v_corpo text := btrim(coalesce(_mensagem_final, ''));
  v_resolvido_em timestamptz := now();
BEGIN
  SELECT a.id INTO v_admin_id
  FROM public.admin_users a
  WHERE a.auth_user_id = _admin_auth_id
    AND a.ativo = true
    AND a.role = 'admin';

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Administrador não autorizado ou inativo.';
  END IF;
  IF char_length(v_corpo) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'Mensagem final deve possuir entre 1 e 2000 caracteres.';
  END IF;

  SELECT c.status, c.atendente_id
    INTO v_status, v_atendente_id
  FROM public.chamados_suporte c
  WHERE c.id = _chamado_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado não encontrado.';
  END IF;
  IF v_status <> 'em_atendimento' THEN
    RAISE EXCEPTION 'Somente chamados em atendimento podem ser resolvidos.';
  END IF;

  INSERT INTO public.mensagens_suporte
    (chamado_id, autor_usuario_id, autor_admin_id, corpo)
  VALUES
    (_chamado_id, NULL, v_admin_id, v_corpo);

  UPDATE public.chamados_suporte
  SET status = 'resolvido',
      atendente_id = coalesce(v_atendente_id, v_admin_id),
      data_resolucao = v_resolvido_em,
      updated_at = v_resolvido_em
  WHERE id = _chamado_id;

  INSERT INTO public.admin_audit_logs
    (admin_auth_id, acao, entidade, entidade_id, estado_anterior, estado_novo)
  VALUES
    (_admin_auth_id, 'resolver_chamado', 'chamados_suporte', _chamado_id,
     jsonb_build_object('status', v_status, 'atendente_id', v_atendente_id),
     jsonb_build_object('status', 'resolvido',
                        'atendente_id', coalesce(v_atendente_id, v_admin_id),
                        'data_resolucao', v_resolvido_em));
END;
$$;

CREATE OR REPLACE FUNCTION public.suporte_reabrir_chamado(
  _chamado_id uuid,
  _admin_auth_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO pg_catalog, public
AS $$
DECLARE
  v_admin_id uuid;
  v_status public.status_chamado_suporte;
  v_atendente_id uuid;
  v_data_resolucao timestamptz;
BEGIN
  SELECT a.id INTO v_admin_id
  FROM public.admin_users a
  WHERE a.auth_user_id = _admin_auth_id
    AND a.ativo = true
    AND a.role = 'admin';

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Administrador não autorizado ou inativo.';
  END IF;

  SELECT c.status, c.atendente_id, c.data_resolucao
    INTO v_status, v_atendente_id, v_data_resolucao
  FROM public.chamados_suporte c
  WHERE c.id = _chamado_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado não encontrado.';
  END IF;
  IF v_status <> 'resolvido' THEN
    RAISE EXCEPTION 'Somente chamados resolvidos podem ser reabertos.';
  END IF;

  UPDATE public.chamados_suporte
  SET status = 'em_atendimento',
      atendente_id = v_admin_id,
      data_resolucao = NULL,
      updated_at = now()
  WHERE id = _chamado_id;

  INSERT INTO public.admin_audit_logs
    (admin_auth_id, acao, entidade, entidade_id, estado_anterior, estado_novo)
  VALUES
    (_admin_auth_id, 'reabrir_chamado', 'chamados_suporte', _chamado_id,
     jsonb_build_object('status', v_status, 'atendente_id', v_atendente_id,
                        'data_resolucao', v_data_resolucao),
     jsonb_build_object('status', 'em_atendimento', 'atendente_id', v_admin_id,
                        'data_resolucao', NULL));
END;
$$;

CREATE OR REPLACE FUNCTION public.suporte_fechar_chamado(
  _chamado_id uuid,
  _admin_auth_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO pg_catalog, public
AS $$
DECLARE
  v_admin_id uuid;
  v_status public.status_chamado_suporte;
  v_atendente_id uuid;
  v_data_resolucao timestamptz;
BEGIN
  SELECT a.id INTO v_admin_id
  FROM public.admin_users a
  WHERE a.auth_user_id = _admin_auth_id
    AND a.ativo = true
    AND a.role = 'admin';

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Administrador não autorizado ou inativo.';
  END IF;

  SELECT c.status, c.atendente_id, c.data_resolucao
    INTO v_status, v_atendente_id, v_data_resolucao
  FROM public.chamados_suporte c
  WHERE c.id = _chamado_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado não encontrado.';
  END IF;
  IF v_status <> 'resolvido' THEN
    RAISE EXCEPTION 'Somente chamados resolvidos podem ser fechados.';
  END IF;

  UPDATE public.chamados_suporte
  SET status = 'fechado',
      updated_at = now()
  WHERE id = _chamado_id;

  INSERT INTO public.admin_audit_logs
    (admin_auth_id, acao, entidade, entidade_id, estado_anterior, estado_novo)
  VALUES
    (_admin_auth_id, 'fechar_chamado', 'chamados_suporte', _chamado_id,
     jsonb_build_object('status', v_status, 'atendente_id', v_atendente_id,
                        'data_resolucao', v_data_resolucao),
     jsonb_build_object('status', 'fechado', 'atendente_id', v_atendente_id,
                        'data_resolucao', v_data_resolucao));
END;
$$;

REVOKE ALL ON FUNCTION public.suporte_iniciar_atendimento(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.suporte_responder_chamado(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.suporte_resolver_chamado(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.suporte_reabrir_chamado(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.suporte_fechar_chamado(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.suporte_iniciar_atendimento(uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.suporte_responder_chamado(uuid, uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.suporte_resolver_chamado(uuid, uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.suporte_reabrir_chamado(uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.suporte_fechar_chamado(uuid, uuid)
  TO service_role;
