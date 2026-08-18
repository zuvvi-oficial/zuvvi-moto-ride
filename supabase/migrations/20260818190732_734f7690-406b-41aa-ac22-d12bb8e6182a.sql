-- Migração para Estrutura Administrativa Zuvvi
-- Data: 2026-08-18

-- 1. Tabela de Administradores
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(auth_user_id)
);

-- Permissões admin_users
GRANT SELECT ON public.admin_users TO authenticated;
GRANT ALL ON public.admin_users TO service_role;

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver a lista de admins
CREATE POLICY "Admins podem ver admins"
ON public.admin_users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users au 
    WHERE au.auth_user_id = auth.uid() AND au.ativo = true
  )
);

-- 2. Tabela de Auditoria Administrativa
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_auth_id UUID REFERENCES auth.users(id) NOT NULL,
    acao TEXT NOT NULL,
    entidade TEXT NOT NULL,
    entidade_id UUID NOT NULL,
    estado_anterior JSONB,
    estado_novo JSONB,
    justificativa TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Permissões admin_audit_logs
GRANT SELECT ON public.admin_audit_logs TO authenticated;
GRANT INSERT ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver logs"
ON public.admin_audit_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users au 
    WHERE au.auth_user_id = auth.uid() AND au.ativo = true
  )
);

-- 3. Função para conferir se é admin (Security Definer para evitar recursão)
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE auth_user_id = user_id
      AND ativo = true
  );
$$;

-- 4. Bootstrap do primeiro administrador (mokahz@gmail.com)
DO $$
BEGIN
    INSERT INTO public.admin_users (auth_user_id, role, ativo)
    SELECT id, 'admin', true
    FROM auth.users
    WHERE email = 'mokahz@gmail.com'
    ON CONFLICT (auth_user_id) DO NOTHING;
END $$;

-- 5. Trigger para atualizar updated_at em admin_users
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_admin_users_updated_at') THEN
        CREATE TRIGGER set_admin_users_updated_at
            BEFORE UPDATE ON public.admin_users
            FOR EACH ROW
            EXECUTE FUNCTION public.handle_updated_at();
    END IF;
END $$;