-- Notificar o passageiro quando o admin responde, resolve ou reabre um chamado de suporte.
-- Só ADICIONA um INSERT em public.notificacoes ao final de cada função; nenhuma validação,
-- checagem de permissão ou log de auditoria existente foi alterado.

CREATE OR REPLACE FUNCTION public.suporte_responder_chamado(_chamado_id uuid, _admin_auth_id uuid, _corpo text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_admin_id uuid;
  v_status public.status_chamado_suporte;
  v_corpo text := btrim(coalesce(_corpo, ''));
  v_usuario_id uuid;
  v_tipo public.tipo_chamado_suporte;
  v_titulo text;
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

  SELECT c.usuario_id, c.tipo INTO v_usuario_id, v_tipo
  FROM public.chamados_suporte c
  WHERE c.id = _chamado_id;

  v_titulo := CASE WHEN v_tipo = 'sos' THEN '🚨 Resposta urgente do suporte' ELSE 'Nova resposta do suporte' END;

  INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem)
  VALUES (
    v_usuario_id,
    'suporte',
    v_titulo,
    left(v_corpo, 100) || CASE WHEN length(v_corpo) > 100 THEN '...' ELSE '' END
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.suporte_resolver_chamado(_chamado_id uuid, _admin_auth_id uuid, _mensagem_final text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_admin_id uuid;
  v_status public.status_chamado_suporte;
  v_atendente_id uuid;
  v_corpo text := btrim(coalesce(_mensagem_final, ''));
  v_resolvido_em timestamptz := now();
  v_usuario_id uuid;
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

  SELECT c.usuario_id INTO v_usuario_id
  FROM public.chamados_suporte c
  WHERE c.id = _chamado_id;

  INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem)
  VALUES (
    v_usuario_id,
    'suporte',
    'Seu chamado foi resolvido',
    left(v_corpo, 100) || CASE WHEN length(v_corpo) > 100 THEN '...' ELSE '' END
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.suporte_reabrir_chamado(_chamado_id uuid, _admin_auth_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_admin_id uuid;
  v_status public.status_chamado_suporte;
  v_atendente_id uuid;
  v_data_resolucao timestamptz;
  v_usuario_id uuid;
  v_tipo public.tipo_chamado_suporte;
  v_titulo text;
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

  SELECT c.usuario_id, c.tipo INTO v_usuario_id, v_tipo
  FROM public.chamados_suporte c
  WHERE c.id = _chamado_id;

  v_titulo := CASE WHEN v_tipo = 'sos' THEN '🚨 Seu chamado SOS foi reaberto pela nossa equipe' ELSE 'Seu chamado foi reaberto pela nossa equipe' END;

  INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem)
  VALUES (
    v_usuario_id,
    'suporte',
    v_titulo,
    'A nossa equipe reabriu o atendimento do seu chamado.'
  );
END;
$function$;
