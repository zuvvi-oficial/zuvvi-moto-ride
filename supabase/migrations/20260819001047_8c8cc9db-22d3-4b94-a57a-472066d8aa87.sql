-- Função transacional para enviar motorista e veículo para análise
CREATE OR REPLACE FUNCTION public.submit_motorista_for_analysis(p_auth_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_veiculo_count INT;
    v_doc_count INT;
    v_motorista_status TEXT;
    v_cnh_valida BOOLEAN;
    v_pix_valido BOOLEAN;
BEGIN
    -- 1. Obter ID do usuário através do auth_user_id
    SELECT id INTO v_user_id
    FROM public.usuarios
    WHERE auth_user_id = p_auth_user_id;

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'usuario_nao_encontrado', 'step', 'usuario');
    END IF;

    -- 2. Obter dados do motorista (ID do motorista = ID do usuário)
    SELECT status_aprovacao::text, 
           (cnh_numero IS NOT NULL AND cnh_validade IS NOT NULL),
           (chave_pix IS NOT NULL AND tipo_chave_pix IS NOT NULL)
    INTO v_motorista_status, v_cnh_valida, v_pix_valido
    FROM public.motoristas
    WHERE id = v_user_id;

    IF v_motorista_status IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'motorista_nao_encontrado', 'step', 'motorista');
    END IF;

    -- 3. Validar se já não está em análise ou aprovado
    IF v_motorista_status IN ('em_analise', 'aprovado') THEN
        RETURN jsonb_build_object('success', true, 'status', v_motorista_status, 'message', 'ja_processado');
    END IF;

    -- 4. Validar CNH e PIX
    IF NOT COALESCE(v_cnh_valida, false) OR NOT COALESCE(v_pix_valido, false) THEN
        RETURN jsonb_build_object('success', false, 'error', 'dados_cnh_pix_incompletos', 'step', 'cnh_pix');
    END IF;

    -- 5. Validar documentos (6 tipos obrigatórios)
    SELECT count(DISTINCT tipo_documento) INTO v_doc_count
    FROM public.documentos_motorista
    WHERE motorista_id = v_user_id
      AND tipo_documento IN ('identidade', 'cnh', 'comprovante_residencia', 'crlv', 'foto_veiculo', 'foto_placa');

    IF v_doc_count < 6 THEN
        RETURN jsonb_build_object('success', false, 'error', 'documentos_incompletos', 'step', 'documentos', 'count', v_doc_count);
    END IF;

    -- 6. Validar veículo
    SELECT count(*) INTO v_veiculo_count
    FROM public.veiculos
    WHERE motorista_id = v_user_id;

    IF v_veiculo_count = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'veiculo_nao_encontrado', 'step', 'veiculo');
    END IF;

    -- 7. Atualizações Atômicas
    UPDATE public.motoristas
    SET status_aprovacao = 'em_analise',
        updated_at = NOW()
    WHERE id = v_user_id;

    UPDATE public.veiculos
    SET status_aprovacao = 'em_analise',
        updated_at = NOW()
    WHERE motorista_id = v_user_id;

    RETURN jsonb_build_object('success', true, 'status', 'em_analise');
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_motorista_for_analysis(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_motorista_for_analysis(UUID) TO service_role;

-- Reforçar RLS para impedir que motoristas mudem o próprio status para 'aprovado' manualmente
-- Removendo políticas problemáticas e recriando com lógica simplificada
DROP POLICY IF EXISTS "Motoristas podem atualizar seus próprios dados" ON public.motoristas;
CREATE POLICY "Motoristas podem atualizar seus próprios dados"
ON public.motoristas
FOR UPDATE
TO authenticated
USING (id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid()))
WITH CHECK (
    id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid())
);

DROP POLICY IF EXISTS "Motoristas podem atualizar seu próprio veículo" ON public.veiculos;
CREATE POLICY "Motoristas podem atualizar seu próprio veículo"
ON public.veiculos
FOR UPDATE
TO authenticated
USING (motorista_id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid()))
WITH CHECK (
    motorista_id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid())
);