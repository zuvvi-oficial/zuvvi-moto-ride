-- Programa de indicação — Etapa 1 do diferencial pedido pelo usuário.
-- Construído em cima de cupons de desconto (já existente): a recompensa é
-- só "gerar um cupom automaticamente quando alguém se cadastra com um
-- código de indicação" — reaproveita toda a máquina de desconto/limite/
-- teto de comissão já validada, sem nenhuma lógica financeira nova.
--
-- Nesta etapa: código de indicação por usuário + captura no cadastro +
-- cupom de boas-vindas pro indicado. A recompensa do indicador (só quando
-- a corrida do indicado de fato se completa, pra evitar farm de cadastro
-- falso) é a Etapa 2 — ainda não existe.

ALTER TABLE public.usuarios
    ADD COLUMN codigo_indicacao text NULL UNIQUE;

CREATE TYPE public.indicacao_status AS ENUM (
    'pendente',
    'concluida'
);

CREATE TABLE public.indicacoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    indicador_id uuid NOT NULL REFERENCES public.usuarios(id),
    indicado_id uuid NOT NULL UNIQUE REFERENCES public.usuarios(id),
    codigo_usado text NOT NULL,
    status public.indicacao_status NOT NULL DEFAULT 'pendente',
    cupom_indicado_id uuid NULL REFERENCES public.cupons(id),
    cupom_indicador_id uuid NULL REFERENCES public.cupons(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    concluida_at timestamptz NULL,
    CONSTRAINT indicacoes_nao_pode_se_autoindicar CHECK (indicador_id <> indicado_id)
);

CREATE INDEX indicacoes_indicador_id_idx ON public.indicacoes(indicador_id);

-- Mesmo padrão de deny-by-default de cupons/cupom_usos: toda escrita passa
-- pelo service_role (cadastro, e depois a conclusão da corrida na Etapa 2),
-- nunca pelo cliente direto. Leitura liberada só pro próprio indicador e
-- pro próprio indicado verem suas indicações (Etapa 3 vai mostrar isso).
ALTER TABLE public.indicacoes ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.indicacoes TO authenticated;
GRANT ALL ON public.indicacoes TO service_role;

CREATE POLICY "usuário vê indicações que fez"
ON public.indicacoes
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.id = indicacoes.indicador_id
        AND u.auth_user_id = auth.uid()
    )
);

CREATE POLICY "usuário vê quem o indicou"
ON public.indicacoes
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.id = indicacoes.indicado_id
        AND u.auth_user_id = auth.uid()
    )
);
