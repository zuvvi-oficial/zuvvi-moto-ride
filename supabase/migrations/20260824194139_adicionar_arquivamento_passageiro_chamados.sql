-- Permite ao passageiro "arquivar" um chamado (sumir da lista dele, sem apagar do banco).
-- Não altera nenhuma coluna, política ou função já existente.

ALTER TABLE public.chamados_suporte
  ADD COLUMN arquivado_pelo_passageiro boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.suporte_arquivar_chamado_passageiro(_chamado_id uuid, _auth_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_usuario_id uuid;
  v_status public.status_chamado_suporte;
  v_dono uuid;
BEGIN
  SELECT u.id INTO v_usuario_id
  FROM public.usuarios u
  WHERE u.auth_user_id = _auth_user_id;

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;

  SELECT c.status, c.usuario_id INTO v_status, v_dono
  FROM public.chamados_suporte c
  WHERE c.id = _chamado_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado não encontrado.';
  END IF;

  IF v_dono <> v_usuario_id THEN
    RAISE EXCEPTION 'Você só pode arquivar seus próprios chamados.';
  END IF;

  IF v_status NOT IN ('resolvido', 'fechado') THEN
    RAISE EXCEPTION 'Só é possível arquivar chamados já resolvidos ou fechados.';
  END IF;

  UPDATE public.chamados_suporte
  SET arquivado_pelo_passageiro = true
  WHERE id = _chamado_id;
END;
$function$;
