-- Create custom type for city status
DO $$ BEGIN
    CREATE TYPE public.cidade_status AS ENUM ('em_breve', 'piloto', 'ativa');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create cidades table
CREATE TABLE IF NOT EXISTS public.cidades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    estado_uf CHAR(2) NOT NULL,
    status public.cidade_status NOT NULL DEFAULT 'em_breve',
    raio_atuacao_km DECIMAL(10, 2) NOT NULL DEFAULT 0,
    bandeirada DECIMAL(10, 2) NOT NULL DEFAULT 0,
    valor_km DECIMAL(10, 2) NOT NULL DEFAULT 0,
    valor_min DECIMAL(10, 2) NOT NULL DEFAULT 0,
    tarifa_minima DECIMAL(10, 2) NOT NULL DEFAULT 0,
    comissao_pct DECIMAL(5, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cidades TO authenticated;
GRANT ALL ON public.cidades TO service_role;
GRANT SELECT ON public.cidades TO anon;

-- Enable RLS
ALTER TABLE public.cidades ENABLE ROW LEVEL SECURITY;

-- Create policies
DO $$ BEGIN
    CREATE POLICY "Public read access for cities"
    ON public.cidades
    FOR SELECT
    TO anon, authenticated
    USING (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS update_cidades_updated_at ON public.cidades;
CREATE TRIGGER update_cidades_updated_at
    BEFORE UPDATE ON public.cidades
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
