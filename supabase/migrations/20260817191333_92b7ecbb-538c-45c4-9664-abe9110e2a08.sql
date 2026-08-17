
-- 1. Create approval status enum for vehicles
DO $$ BEGIN
    CREATE TYPE public.veiculo_status_aprovacao AS ENUM (
        'em_preenchimento',
        'em_analise',
        'aprovado',
        'recusado',
        'suspenso'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create the veiculos table
CREATE TABLE IF NOT EXISTS public.veiculos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    motorista_id UUID NOT NULL REFERENCES public.motoristas(id) ON DELETE CASCADE,
    placa TEXT NOT NULL UNIQUE,
    marca TEXT NOT NULL,
    modelo TEXT NOT NULL,
    ano INTEGER NOT NULL,
    cor TEXT NOT NULL,
    status_aprovacao public.veiculo_status_aprovacao NOT NULL DEFAULT 'em_preenchimento',
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Grant access to Data API
GRANT SELECT, INSERT, UPDATE, DELETE ON public.veiculos TO authenticated;
GRANT ALL ON public.veiculos TO service_role;

-- 4. Enable RLS
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;

-- 5. Policies
-- A driver can see and manage their own vehicles.
CREATE POLICY "Drivers can view their own vehicles"
    ON public.veiculos
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.motoristas m
            JOIN public.usuarios u ON m.id = u.id
            WHERE m.id = public.veiculos.motorista_id
            AND u.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Drivers can insert their own vehicles"
    ON public.veiculos
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.motoristas m
            JOIN public.usuarios u ON m.id = u.id
            WHERE m.id = motorista_id
            AND u.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Drivers can update their own vehicles"
    ON public.veiculos
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.motoristas m
            JOIN public.usuarios u ON m.id = u.id
            WHERE m.id = public.veiculos.motorista_id
            AND u.auth_user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.motoristas m
            JOIN public.usuarios u ON m.id = u.id
            WHERE m.id = motorista_id
            AND u.auth_user_id = auth.uid()
        )
    );

-- 6. Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_veiculo_updated ON public.veiculos;
CREATE TRIGGER on_veiculo_updated
    BEFORE UPDATE ON public.veiculos
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
