-- Create custom type for user profiles
DO $$ BEGIN
    CREATE TYPE public.user_profile_type AS ENUM ('passageiro', 'motorista');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create usuarios table
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Preparation for Supabase Auth
    nome TEXT NOT NULL,
    email TEXT UNIQUE,
    celular TEXT UNIQUE,
    cpf TEXT UNIQUE NOT NULL,
    data_nascimento DATE,
    cidade_id UUID REFERENCES public.cidades(id),
    perfil_ativo public.user_profile_type NOT NULL DEFAULT 'passageiro',
    -- Preparing for dual profile support as requested:
    is_passageiro BOOLEAN DEFAULT TRUE,
    is_motorista BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuarios TO authenticated;
GRANT ALL ON public.usuarios TO service_role;

-- Enable RLS
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- Create policies (Users can only see/edit their own data once auth is connected)
DO $$ BEGIN
    CREATE POLICY "Users can view own data"
    ON public.usuarios
    FOR SELECT
    TO authenticated
    USING (auth.uid() = auth_user_id);

    CREATE POLICY "Users can update own data"
    ON public.usuarios
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = auth_user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_usuarios_updated_at ON public.usuarios;
CREATE TRIGGER update_usuarios_updated_at
    BEFORE UPDATE ON public.usuarios
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
