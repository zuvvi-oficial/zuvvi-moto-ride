-- 1. Revogar execução pública e autenticada direta
REVOKE EXECUTE ON FUNCTION public.submit_motorista_for_analysis(UUID) FROM PUBLIC, anon, authenticated;

-- 2. Garantir execução apenas para service_role (usado via supabaseAdmin no servidor)
GRANT EXECUTE ON FUNCTION public.submit_motorista_for_analysis(UUID) TO service_role;

-- 3. Refatorar RPC para maior segurança e validações exigidas
CREATE OR REPLACE FUNCTION public.submit_motorista_for_analysis(p_auth_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_motorista_id UUID;
    v_is_motorista BOOLEAN;
    v_veiculo_count INT;
    v_doc_count INT;
    v_motorista_status public.status_aprovacao;
    v_cnh_valida BOOLEAN;
    v_pix_valido BOOLEAN;
BEGIN
    -- 1. Validar se o auth_user_id existe e se é motorista na tabela usuarios
    SELECT id, is_motorista INTO v_motorista_id, v_is_motorista
    FROM public.usuarios
    WHERE auth_user_id = p_auth_user_id;

    IF v_motorista_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'usuario_nao_encontrado', 'step', 'auth');
    END IF;

    IF NOT v_is_motorista THEN
        RETURN jsonb_build_object('success', false, 'error', 'perfil_motorista_invalido', 'step', 'perfil');
    END IF;

    -- 2. Obter dados e status real da tabela motoristas
    -- Nota: v_motorista_id aqui é a PK de usuarios, que é FK (ou 1:1) em motoristas
    SELECT status_aprovacao, 
           (cnh_numero IS NOT NULL AND cnh_validade IS NOT NULL),
           (chave_pix IS NOT NULL AND tipo_chave_pix IS NOT NULL)
    INTO v_motorista_status, v_cnh_valida, v_pix_valido
    FROM public.motoristas
    WHERE id = v_motorista_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'motorista_nao_encontrado', 'step', 'motorista');
    END IF;

    -- 3. Validar se já está aprovado ou suspenso (bloquear alteração)
    IF v_motorista_status IN ('aprovado', 'suspenso') THEN
        RETURN jsonb_build_object('success', false, 'error', 'estado_bloqueado', 'status', v_motorista_status);
    END IF;
    
    -- Se já estiver em análise, apenas retornar sucesso silencioso
    IF v_motorista_status = 'em_analise' THEN
        RETURN jsonb_build_object('success', true, 'status', 'em_analise', 'message', 'ja_em_analise');
    END IF;

    -- 4. Validar CNH e PIX
    IF NOT v_cnh_valida OR NOT v_pix_valido THEN
        RETURN jsonb_build_object('success', false, 'error', 'dados_cnh_pix_incompletos', 'step', 'cnh_pix');
    END IF;

    -- 5. Validar documentos (6 tipos obrigatórios)
    SELECT count(DISTINCT tipo_documento) INTO v_doc_count
    FROM public.documentos_motorista
    WHERE motorista_id = v_motorista_id
      AND tipo_documento IN ('identidade', 'cnh', 'comprovante_residencia', 'crlv', 'foto_veiculo', 'foto_placa');

    IF v_doc_count < 6 THEN
        RETURN jsonb_build_object('success', false, 'error', 'documentos_incompletos', 'step', 'documentos', 'count', v_doc_count);
    END IF;

    -- 6. Validar veículo
    SELECT count(*) INTO v_veiculo_count
    FROM public.veiculos
    WHERE motorista_id = v_motorista_id;

    IF v_veiculo_count = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'veiculo_nao_encontrado', 'step', 'veiculo');
    END IF;

    -- 7. Atualizações Atômicas
    UPDATE public.motoristas
    SET status_aprovacao = 'em_analise',
        updated_at = NOW()
    WHERE id = v_motorista_id;

    UPDATE public.veiculos
    SET status_aprovacao = 'em_analise',
        updated_at = NOW()
    WHERE motorista_id = v_motorista_id;

    RETURN jsonb_build_object('success', true, 'status', 'em_analise');
END;
$$;

-- 4. Reforçar RLS para impedir que o motorista altere o próprio status_aprovacao
-- As políticas atuais já devem ser revisadas, mas garantiremos que apenas roles administrativas ou a RPC (via security definer) alterem isso.
DROP POLICY IF EXISTS \"Motoristas podem atualizar o próprio perfil\" ON public.motoristas;
CREATE POLICY \"Motoristas podem atualizar dados básicos\"
ON public.motoristas
FOR UPDATE
TO authenticated
USING (auth.uid() = auth_user_id)
WITH CHECK (
    auth.uid() = auth_user_id AND 
    (status_aprovacao = 'em_preenchimento' OR status_aprovacao = 'pendente')
);
-- Nota: A alteração para 'em_analise' ocorrerá via RPC que é SECURITY DEFINER.
-- A alteração para 'aprovado'/'suspenso' não é permitida por esta política.
