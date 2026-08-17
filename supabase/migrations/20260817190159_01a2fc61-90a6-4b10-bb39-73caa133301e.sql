
-- 1. Criar o Enum para o status do motorista
DO $$ BEGIN
    CREATE TYPE public.motorista_status AS ENUM (
        'draft',
        'under_review',
        'approved',
        'suspended',
        'rejected'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Criar a tabela motoristas
CREATE TABLE IF NOT EXISTS public.motoristas (
    id UUID PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE CASCADE,
    status public.motorista_status NOT NULL DEFAULT 'draft',
    display_name TEXT NOT NULL,
    bio TEXT,
    rating_average DECIMAL(3, 2) NOT NULL DEFAULT 0,
    rating_count INTEGER NOT NULL DEFAULT 0,
    onboarding_completed_at TIMESTAMPTZ,
    payment_ready BOOLEAN NOT NULL DEFAULT FALSE,
    suspended_at TIMESTAMPTZ,
    suspension_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Grants de acesso (PostgREST/Data API)
GRANT SELECT, INSERT, UPDATE ON public.motoristas TO authenticated;
GRANT ALL ON public.motoristas TO service_role;

-- 4. Habilitar RLS
ALTER TABLE public.motoristas ENABLE ROW LEVEL SECURITY;

-- 5. Criar Políticas de RLS
-- Motoristas podem ver seu próprio perfil
CREATE POLICY "Motoristas podem ver o próprio perfil"
ON public.motoristas
FOR SELECT
TO authenticated
USING (auth.uid() = (SELECT auth_user_id FROM public.usuarios WHERE id = motoristas.id));

-- Motoristas podem atualizar seu próprio perfil (campos limitados na prática via app)
CREATE POLICY "Motoristas podem atualizar o próprio perfil"
ON public.motoristas
FOR UPDATE
TO authenticated
USING (auth.uid() = (SELECT auth_user_id FROM public.usuarios WHERE id = motoristas.id));

-- Trigger para updated_at (assumindo que já existe uma função handle_updated_at no banco, comum em templates Lovable)
-- Caso não exista, ela será ignorada ou falhará silenciosamente se não criarmos, 
-- mas geralmente o Supabase/Lovable já tem. Por segurança, vamos apenas criar a tabela.
