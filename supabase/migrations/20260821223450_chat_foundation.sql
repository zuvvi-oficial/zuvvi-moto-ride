-- ZUVVI CHAT FOUNDATION
-- 20260821223450_chat_foundation.sql

-- 1. TABELA public.chat_mensagens
CREATE TABLE IF NOT EXISTS public.chat_mensagens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    corrida_id uuid NOT NULL REFERENCES public.corridas(id) ON DELETE CASCADE,
    remetente_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    client_message_id uuid NOT NULL,
    conteudo text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    entregue_at timestamptz NULL,
    lido_at timestamptz NULL,
    
    CONSTRAINT chat_mensagens_conteudo_length CHECK (char_length(btrim(conteudo)) BETWEEN 1 AND 1000),
    CONSTRAINT chat_mensagens_lido_entregue CHECK (lido_at IS NULL OR entregue_at IS NOT NULL),
    CONSTRAINT chat_mensagens_ordem_datas CHECK (lido_at IS NULL OR entregue_at IS NULL OR lido_at >= entregue_at),
    UNIQUE (corrida_id, remetente_id, client_message_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_mensagens_corrida_created ON public.chat_mensagens(corrida_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_chat_mensagens_corrida_lido ON public.chat_mensagens(corrida_id, lido_at, created_at);

-- 2. TRIGGER DE INSERT EM chat_mensagens
CREATE OR REPLACE FUNCTION public.validate_chat_mensagem_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
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

    -- NEW.remetente_id deve ser passageiro_id OU motorista_id
    IF NEW.remetente_id != v_passageiro_id AND NEW.remetente_id != v_motorista_id THEN
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

DROP TRIGGER IF EXISTS trg_chat_mensagens_validate_insert ON public.chat_mensagens;
CREATE TRIGGER trg_chat_mensagens_validate_insert
BEFORE INSERT ON public.chat_mensagens
FOR EACH ROW EXECUTE FUNCTION public.validate_chat_mensagem_insert();

-- 3. IMUTABILIDADE
CREATE OR REPLACE FUNCTION public.protect_chat_mensagem_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    IF OLD.id != NEW.id OR
       OLD.corrida_id != NEW.corrida_id OR
       OLD.remetente_id != NEW.remetente_id OR
       OLD.client_message_id != NEW.client_message_id OR
       OLD.conteudo != NEW.conteudo OR
       OLD.created_at != NEW.created_at THEN
        RAISE EXCEPTION 'Campos imutáveis da mensagem de chat não podem ser alterados.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_mensagens_protect_update ON public.chat_mensagens;
CREATE TRIGGER trg_chat_mensagens_protect_update
BEFORE UPDATE ON public.chat_mensagens
FOR EACH ROW EXECUTE FUNCTION public.protect_chat_mensagem_update();

-- 4. TABELA public.chat_presenca
CREATE TABLE IF NOT EXISTS public.chat_presenca (
    corrida_id uuid NOT NULL REFERENCES public.corridas(id) ON DELETE CASCADE,
    usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    ultimo_visto_at timestamptz NOT NULL DEFAULT now(),
    digitando_ate timestamptz NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (corrida_id, usuario_id)
);

CREATE OR REPLACE FUNCTION public.validate_chat_presenca()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
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

    IF NEW.usuario_id != v_passageiro_id AND NEW.usuario_id != v_motorista_id THEN
        RAISE EXCEPTION 'Usuário não é participante da corrida.';
    END IF;

    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_presenca_validate ON public.chat_presenca;
CREATE TRIGGER trg_chat_presenca_validate
BEFORE INSERT OR UPDATE ON public.chat_presenca
FOR EACH ROW EXECUTE FUNCTION public.validate_chat_presenca();

-- 5. RLS E PRIVILÉGIOS
ALTER TABLE public.chat_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_presenca ENABLE ROW LEVEL SECURITY;

-- Anon
REVOKE ALL ON TABLE public.chat_mensagens FROM anon;
REVOKE ALL ON TABLE public.chat_presenca FROM anon;

-- Authenticated
REVOKE ALL ON TABLE public.chat_mensagens FROM authenticated;
REVOKE ALL ON TABLE public.chat_presenca FROM authenticated;
GRANT SELECT ON public.chat_mensagens TO authenticated;
GRANT SELECT ON public.chat_presenca TO authenticated;

-- Service role
GRANT ALL ON public.chat_mensagens TO service_role;
GRANT ALL ON public.chat_presenca TO service_role;

-- Policies SELECT
DROP POLICY IF EXISTS "Participantes podem ler mensagens da corrida" ON public.chat_mensagens;
CREATE POLICY "Participantes podem ler mensagens da corrida"
ON public.chat_mensagens
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.corridas c
        JOIN public.usuarios u_p ON c.passageiro_id = u_p.id
        LEFT JOIN public.usuarios u_m ON c.motorista_id = u_m.id
        WHERE c.id = chat_mensagens.corrida_id
        AND (u_p.auth_user_id = auth.uid() OR (u_m.auth_user_id = auth.uid()))
    )
);

DROP POLICY IF EXISTS "Participantes podem ler presenca da corrida" ON public.chat_presenca;
CREATE POLICY "Participantes podem ler presenca da corrida"
ON public.chat_presenca
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.corridas c
        JOIN public.usuarios u_p ON c.passageiro_id = u_p.id
        LEFT JOIN public.usuarios u_m ON c.motorista_id = u_m.id
        WHERE c.id = chat_presenca.corrida_id
        AND (u_p.auth_user_id = auth.uid() OR (u_m.auth_user_id = auth.uid()))
    )
);

-- 6. REALTIME
ALTER TABLE public.chat_mensagens REPLICA IDENTITY FULL;
ALTER TABLE public.chat_presenca REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'chat_mensagens'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_mensagens;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'chat_presenca'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_presenca;
  END IF;
END $$;
