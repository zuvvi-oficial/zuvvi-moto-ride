-- Migration 20260820175038: set_motorista_online_atomic
-- Objetivo: Tornar a entrada em modo ONLINE atômica em relação ao aceite de corrida.

CREATE OR REPLACE FUNCTION public.set_motorista_online_atomic(
  p_motorista_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_exists boolean;
  v_active_ride_exists boolean;
BEGIN
  -- 1. Bloqueio da linha do motorista para garantir atomicidade.
  -- Compatível com accept_corrida_atomic que também bloqueia o motorista.
  SELECT EXISTS (
    SELECT 1 FROM public.motoristas WHERE id = p_motorista_id FOR UPDATE
  ) INTO v_exists;

  IF NOT v_exists THEN
    RAISE EXCEPTION 'MOTORISTA_NOT_FOUND';
  END IF;

  -- 2. Consultar se existe corrida ativa vinculada ao motorista.
  -- Status: aceita, motorista_a_caminho, motorista_chegou, em_andamento.
  SELECT EXISTS (
    SELECT 1
    FROM public.corridas
    WHERE motorista_id = p_motorista_id
      AND status IN ('aceita', 'motorista_a_caminho', 'motorista_chegou', 'em_andamento')
  ) INTO v_active_ride_exists;

  -- 3. Se existir corrida ativa, não altera a disponibilidade e retorna código específico.
  IF v_active_ride_exists THEN
    RETURN 'ACTIVE_RIDE_EXISTS';
  END IF;

  -- 4. Se não houver corrida ativa, atualiza is_disponivel = true.
  UPDATE public.motoristas
  SET is_disponivel = true
  WHERE id = p_motorista_id;

  -- 5. Confirmar atualização (implícito pelo UPDATE anterior em tabela com PK).
  RETURN 'OK';
END;
$$;

-- Permissões rigorosas: apenas service_role pode executar.
REVOKE ALL ON FUNCTION public.set_motorista_online_atomic(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_motorista_online_atomic(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.set_motorista_online_atomic(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_motorista_online_atomic(uuid) TO service_role;
