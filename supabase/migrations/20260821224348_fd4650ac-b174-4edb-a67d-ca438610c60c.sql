-- CHAT PARTICIPANT NULL-SAFE
-- 20260821224500_chat_participant_null_safe.sql

CREATE OR REPLACE FUNCTION public.validate_chat_mensagem_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_passageiro_id uuid;
    v_motorista_id uuid;
    v_status public.corrida_status;
BEGIN
    -- Buscar corrida e dados necessários
    SELECT passageiro_id, motorista_id, status 
    INTO v_passageiro_id, v_motorista_id, v_status
    FROM public.corridas
    WHERE id = NEW.corrida_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Corrida não encontrada.';
    END IF;

    -- NEW.remetente_id deve ser passageiro_id OU motorista_id (NULL-safe comparison)
    IF NEW.remetente_id IS DISTINCT FROM v_passageiro_id
       AND NEW.remetente_id IS DISTINCT FROM v_motorista_id
    THEN
        RAISE EXCEPTION 'Remetente não é participante da corrida.';
    END IF;

    -- Normalizar conteúdo
    NEW.conteudo := btrim(NEW.conteudo);

    -- Permitir nova mensagem SOMENTE nos status: aceita, motorista_a_caminho, motorista_chegou
    IF v_status NOT IN ('aceita', 'motorista_a_caminho', 'motorista_chegou') THEN
        RAISE EXCEPTION 'Status da corrida (%) não permite novas mensagens.', v_status;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_chat_presenca()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_passageiro_id uuid;
    v_motorista_id uuid;
BEGIN
    -- Em UPDATE, proibir troca de corrida_id e usuario_id
    IF TG_OP = 'UPDATE' THEN
        IF OLD.corrida_id != NEW.corrida_id OR OLD.usuario_id != NEW.usuario_id THEN
            RAISE EXCEPTION 'corrida_id e usuario_id são imutáveis em chat_presenca.';
        END IF;
    END IF;

    -- Validar participante
    SELECT passageiro_id, motorista_id 
    INTO v_passageiro_id, v_motorista_id
    FROM public.corridas
    WHERE id = NEW.corrida_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Corrida não encontrada.';
    END IF;

    -- Validar participante (NULL-safe comparison)
    IF NEW.usuario_id IS DISTINCT FROM v_passageiro_id
       AND NEW.usuario_id IS DISTINCT FROM v_motorista_id
    THEN
        RAISE EXCEPTION 'Usuário não é participante da corrida.';
    END IF;

    NEW.updated_at := now();
    RETURN NEW;
END;
$$;
