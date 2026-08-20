CREATE OR REPLACE FUNCTION public.accept_corrida_atomic(
  p_corrida_id uuid,
  p_motorista_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_motorista_aprovacao public.motorista_status_aprovacao;
  v_is_disponivel boolean;
  v_cidade_id uuid;
  v_count_ativas integer;
BEGIN
  -- 1. Bloquear a linha do motorista com FOR UPDATE
  SELECT 
    m.status_aprovacao, 
    m.is_disponivel, 
    u.cidade_id 
  INTO 
    v_motorista_aprovacao, 
    v_is_disponivel, 
    v_cidade_id
  FROM public.motoristas m
  JOIN public.usuarios u ON u.id = m.id
  WHERE m.id = p_motorista_id
  FOR UPDATE;

  -- 2. Confirmar que motorista existe e está apto
  IF v_motorista_aprovacao IS NULL THEN
    RAISE EXCEPTION 'Motorista não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_motorista_aprovacao::text != 'aprovado' THEN
    RAISE EXCEPTION 'Motorista não está aprovado' USING ERRCODE = 'P0001';
  END IF;

  IF NOT v_is_disponivel THEN
    RAISE EXCEPTION 'Motorista não está disponível' USING ERRCODE = 'P0001';
  END IF;

  IF v_cidade_id IS NULL THEN
    RAISE EXCEPTION 'Motorista não possui cidade vinculada' USING ERRCODE = 'P0001';
  END IF;

  -- 3. Confirmar que esse motorista NÃO possui outra corrida ativa
  SELECT count(*) INTO v_count_ativas
  FROM public.corridas
  WHERE motorista_id = p_motorista_id
    AND status IN ('aceita', 'motorista_a_caminho', 'motorista_chegou', 'em_andamento');

  IF v_count_ativas > 0 THEN
    RAISE EXCEPTION 'Motorista já possui uma corrida ativa' USING ERRCODE = 'P0001';
  END IF;

  -- 4. & 5. Aceitar a corrida atomisticamente
  UPDATE public.corridas
  SET 
    motorista_id = p_motorista_id,
    status = 'aceita',
    data_aceite = now(),
    updated_at = now()
  WHERE id = p_corrida_id
    AND status = 'solicitada'
    AND motorista_id IS NULL
    AND cidade_id = v_cidade_id;

  -- 6. Se nenhuma corrida for atualizada, abortar
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Corrida indisponível ou cidade incompatível' USING ERRCODE = 'P0001';
  END IF;

  -- 7. Atualizar motorista para offline
  UPDATE public.motoristas
  SET 
    is_disponivel = false,
    updated_at = now()
  WHERE id = p_motorista_id;

END;
$$;

-- Permissões
REVOKE EXECUTE ON FUNCTION public.accept_corrida_atomic(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accept_corrida_atomic(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.accept_corrida_atomic(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accept_corrida_atomic(uuid, uuid) TO service_role;

-- Índice UNIQUE Parcial
CREATE UNIQUE INDEX IF NOT EXISTS idx_corridas_motorista_ativa_unique 
ON public.corridas (motorista_id) 
WHERE motorista_id IS NOT NULL 
  AND status IN ('aceita', 'motorista_a_caminho', 'motorista_chegou', 'em_andamento');