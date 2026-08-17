-- 1. Create Enums
DO $$ BEGIN
    CREATE TYPE public.corrida_status AS ENUM (
        'solicitada',
        'buscando_motorista',
        'aceita',
        'motorista_a_caminho',
        'motorista_chegou',
        'em_andamento',
        'concluida',
        'cancelada',
        'sem_motorista'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.forma_pagamento AS ENUM (
        'pix',
        'cartao',
        'dinheiro'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.cancelado_por AS ENUM (
        'passageiro',
        'motorista',
        'operacao'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create Table
CREATE TABLE IF NOT EXISTS public.corridas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    passageiro_id UUID NOT NULL REFERENCES public.usuarios(id),
    motorista_id UUID REFERENCES public.motoristas(id),
    cidade_id UUID NOT NULL REFERENCES public.cidades(id),
    
    origem_lat DECIMAL(10, 8) NOT NULL,
    origem_lng DECIMAL(11, 8) NOT NULL,
    destino_lat DECIMAL(10, 8) NOT NULL,
    destino_lng DECIMAL(11, 8) NOT NULL,
    
    status public.corrida_status NOT NULL DEFAULT 'solicitada',
    valor_estimado DECIMAL(10, 2) NOT NULL,
    valor_final DECIMAL(10, 2),
    forma_pagamento public.forma_pagamento NOT NULL,
    codigo_embarque CHAR(4) NOT NULL,
    
    -- Timestamps
    data_aceite TIMESTAMPTZ,
    data_chegada_motorista TIMESTAMPTZ,
    data_inicio TIMESTAMPTZ,
    data_finalizacao TIMESTAMPTZ,
    data_cancelamento TIMESTAMPTZ,
    
    -- Cancellation details
    cancelado_por public.cancelado_por,
    motivo_cancelamento TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Grants
GRANT SELECT, INSERT, UPDATE ON public.corridas TO authenticated;
GRANT ALL ON public.corridas TO service_role;

-- 4. RLS
ALTER TABLE public.corridas ENABLE ROW LEVEL SECURITY;

-- 5. Policies
-- Passenger can see their own rides
CREATE POLICY "Passageiros podem ver suas próprias corridas"
    ON public.corridas
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios u
            WHERE u.id = public.corridas.passageiro_id
            AND u.auth_user_id = auth.uid()
        )
    );

-- Driver can see their assigned rides
CREATE POLICY "Motoristas podem ver suas próprias corridas"
    ON public.corridas
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.motoristas m
            JOIN public.usuarios u ON m.id = u.id
            WHERE m.id = public.corridas.motorista_id
            AND u.auth_user_id = auth.uid()
        )
    );

-- 6. Trigger for updated_at
DROP TRIGGER IF EXISTS update_corridas_updated_at ON public.corridas;
CREATE TRIGGER update_corridas_updated_at
    BEFORE UPDATE ON public.corridas
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();