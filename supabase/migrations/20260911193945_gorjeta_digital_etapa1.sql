-- Gorjeta digital — Etapa 1 do diferencial pedido pelo usuário. Passageiro
-- registra a intenção de dar uma gorjeta pra uma corrida já concluída. Nesta
-- etapa é só a camada de dados (tabela + validações). A cobrança Pix de
-- verdade (reaproveitando a conexão Mercado Pago do motorista, sem comissão
-- da Zuvvi) é a Etapa 2 — ainda não existe. A UI (botão na tela de
-- avaliação pós-corrida) é a Etapa 3.

CREATE TYPE public.gorjeta_status AS ENUM (
    'pendente',
    'paga',
    'falhou'
);

CREATE TABLE public.gorjetas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    corrida_id uuid NOT NULL UNIQUE REFERENCES public.corridas(id) ON DELETE CASCADE,
    passageiro_id uuid NOT NULL REFERENCES public.usuarios(id),
    motorista_id uuid NOT NULL REFERENCES public.motoristas(id),
    valor numeric NOT NULL CHECK (valor > 0 AND valor <= 200),
    status public.gorjeta_status NOT NULL DEFAULT 'pendente',
    id_transacao_mercadopago text NULL,
    motivo_falha text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    pago_at timestamptz NULL
);

GRANT SELECT, INSERT ON public.gorjetas TO authenticated;
GRANT ALL ON public.gorjetas TO service_role;

CREATE INDEX gorjetas_passageiro_id_idx ON public.gorjetas(passageiro_id);
CREATE INDEX gorjetas_motorista_id_idx ON public.gorjetas(motorista_id);

ALTER TABLE public.gorjetas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "passageiro vê suas próprias gorjetas"
ON public.gorjetas
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.id = gorjetas.passageiro_id
        AND u.auth_user_id = auth.uid()
    )
);

CREATE POLICY "motorista vê as gorjetas que recebeu"
ON public.gorjetas
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.id = gorjetas.motorista_id
        AND u.auth_user_id = auth.uid()
    )
);

-- Só o passageiro da própria corrida cria a gorjeta, e só como 'pendente' —
-- a transição pra 'paga'/'falhou' (Etapa 2) é feita só pelo service_role,
-- que ignora RLS, nunca pelo cliente direto.
CREATE POLICY "passageiro registra gorjeta da própria corrida"
ON public.gorjetas
FOR INSERT
TO authenticated
WITH CHECK (
    status = 'pendente'
    AND id_transacao_mercadopago IS NULL
    AND EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.id = gorjetas.passageiro_id
        AND u.auth_user_id = auth.uid()
    )
    AND EXISTS (
        SELECT 1 FROM public.corridas c
        WHERE c.id = gorjetas.corrida_id
        AND c.passageiro_id = gorjetas.passageiro_id
        AND c.motorista_id = gorjetas.motorista_id
        AND c.status = 'concluida'
    )
);
