-- Cupons de desconto — Etapa 1 do diferencial pedido pelo usuário. Só a
-- camada de dados (tabelas + validação de elegibilidade). Aplicar o
-- desconto de verdade no preço da corrida (cotarCorridaCore/criarCorridaCore)
-- é a Etapa 2 — ainda não existe. Fundação pensada pra também servir
-- programa de indicação e fidelidade/cashback depois (ambos viram só "gerar
-- um cupom automaticamente quando X acontece").
--
-- Nenhum acesso de cliente direto: cupons e cupom_usos só são lidos/escritos
-- pelo service_role (funções de servidor, admin ou o motor de criação de
-- corrida na Etapa 2) — RLS habilitada, sem nenhuma política pra
-- authenticated/anon (nega por padrão), igual às tabelas de credenciais
-- Mercado Pago.

CREATE TYPE public.cupom_tipo_desconto AS ENUM (
    'percentual',
    'fixo'
);

CREATE TABLE public.cupons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo text NOT NULL UNIQUE,
    tipo_desconto public.cupom_tipo_desconto NOT NULL,
    valor numeric NOT NULL CHECK (valor > 0),
    valor_maximo_desconto numeric NULL CHECK (valor_maximo_desconto IS NULL OR valor_maximo_desconto > 0),
    valor_minimo_corrida numeric NULL CHECK (valor_minimo_corrida IS NULL OR valor_minimo_corrida >= 0),
    limite_uso_total integer NULL CHECK (limite_uso_total IS NULL OR limite_uso_total > 0),
    limite_uso_por_usuario integer NOT NULL DEFAULT 1 CHECK (limite_uso_por_usuario > 0),
    cidade_id uuid NULL REFERENCES public.cidades(id),
    descricao text NULL,
    ativo boolean NOT NULL DEFAULT true,
    valido_de timestamptz NOT NULL DEFAULT now(),
    valido_ate timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT cupons_codigo_normalizado CHECK (codigo = upper(btrim(codigo))),
    CONSTRAINT cupons_percentual_valido CHECK (
        tipo_desconto <> 'percentual' OR (valor > 0 AND valor <= 100)
    ),
    CONSTRAINT cupons_validade_coerente CHECK (valido_ate IS NULL OR valido_ate > valido_de)
);

CREATE INDEX cupons_codigo_ativo_idx ON public.cupons(codigo) WHERE ativo;

ALTER TABLE public.cupons ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.cupons TO service_role;

CREATE TABLE public.cupom_usos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cupom_id uuid NOT NULL REFERENCES public.cupons(id) ON DELETE CASCADE,
    usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
    corrida_id uuid NOT NULL UNIQUE REFERENCES public.corridas(id) ON DELETE CASCADE,
    valor_desconto numeric NOT NULL CHECK (valor_desconto > 0),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cupom_usos_cupom_usuario_idx ON public.cupom_usos(cupom_id, usuario_id);

ALTER TABLE public.cupom_usos ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.cupom_usos TO service_role;
