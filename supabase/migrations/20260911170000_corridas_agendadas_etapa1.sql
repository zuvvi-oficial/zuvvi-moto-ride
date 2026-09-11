-- Corrida agendada — Etapa 1 do diferencial pedido pelo usuário. Passageiro
-- marca um horário futuro; nesta etapa é só a camada de dados (tabela +
-- limite seguro). O "motor" que converte um agendamento vencido numa
-- corrida real (reaproveitando criarCorrida, com prioridade de motorista
-- favorito de graça) é a Etapa 2 — ainda não existe.

CREATE TYPE public.corrida_agendada_status AS ENUM (
    'agendada',
    'convertida',
    'cancelada',
    'falhou'
);

CREATE TABLE public.corridas_agendadas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    passageiro_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    origem_nome text,
    origem_lat numeric NOT NULL,
    origem_lng numeric NOT NULL,
    destino_nome text,
    destino_lat numeric NOT NULL,
    destino_lng numeric NOT NULL,
    forma_pagamento public.forma_pagamento NOT NULL,
    horario_agendado timestamptz NOT NULL,
    status public.corrida_agendada_status NOT NULL DEFAULT 'agendada',
    corrida_id uuid NULL REFERENCES public.corridas(id),
    motivo_falha text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.corridas_agendadas TO authenticated;
GRANT ALL ON public.corridas_agendadas TO service_role;

CREATE INDEX corridas_agendadas_passageiro_id_idx ON public.corridas_agendadas(passageiro_id);
CREATE INDEX corridas_agendadas_status_horario_idx ON public.corridas_agendadas(status, horario_agendado)
    WHERE status = 'agendada';

ALTER TABLE public.corridas_agendadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "passageiro vê seus próprios agendamentos"
ON public.corridas_agendadas
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.id = corridas_agendadas.passageiro_id
        AND u.auth_user_id = auth.uid()
    )
);

CREATE POLICY "passageiro cria seus próprios agendamentos"
ON public.corridas_agendadas
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.id = corridas_agendadas.passageiro_id
        AND u.auth_user_id = auth.uid()
    )
    AND status = 'agendada'
    AND corrida_id IS NULL
);

-- Só permite a transição agendada -> cancelada pelo próprio passageiro, via
-- REST direto. A conversão em corrida real (status='convertida') só pode
-- ocorrer pelo service_role (Etapa 2), que ignora RLS — nunca pelo cliente.
CREATE POLICY "passageiro cancela seu próprio agendamento"
ON public.corridas_agendadas
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.id = corridas_agendadas.passageiro_id
        AND u.auth_user_id = auth.uid()
    )
    AND status = 'agendada'
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.id = corridas_agendadas.passageiro_id
        AND u.auth_user_id = auth.uid()
    )
    AND status = 'cancelada'
    AND corrida_id IS NULL
);

-- Limite de 10 agendamentos pendentes por passageiro, com lock consultivo
-- (mesma técnica de motoristas_favoritos/contatos_confianca) para evitar de
-- largada a mesma condição de corrida (TOCTOU) já corrigida depois dos
-- fatos nessas outras tabelas.
CREATE FUNCTION public.enforce_corridas_agendadas_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(
        hashtextextended(NEW.passageiro_id::text, 1)
    );

    IF (
        SELECT count(*)
        FROM public.corridas_agendadas
        WHERE passageiro_id = NEW.passageiro_id
        AND status = 'agendada'
    ) >= 10 THEN
        RAISE EXCEPTION
            'Você atingiu o limite de 10 corridas agendadas pendentes. Cancele uma para adicionar outra.'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_corridas_agendadas_limit_trigger
BEFORE INSERT ON public.corridas_agendadas
FOR EACH ROW
EXECUTE FUNCTION public.enforce_corridas_agendadas_limit();
