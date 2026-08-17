
-- Create Enums
DO $$ BEGIN
    CREATE TYPE public.tipo_documento AS ENUM (
        'identidade',
        'cnh',
        'comprovante_residencia',
        'crlv',
        'foto_veiculo',
        'foto_placa'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.documento_status_analise AS ENUM (
        'pendente',
        'aprovado',
        'recusado'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create Table
CREATE TABLE IF NOT EXISTS public.documentos_motorista (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    motorista_id UUID NOT NULL REFERENCES public.motoristas(id) ON DELETE CASCADE,
    veiculo_id UUID REFERENCES public.veiculos(id) ON DELETE CASCADE,
    tipo_documento public.tipo_documento NOT NULL,
    storage_path TEXT NOT NULL,
    status_analise public.documento_status_analise NOT NULL DEFAULT 'pendente',
    motivo_recusa TEXT,
    data_envio TIMESTAMPTZ NOT NULL DEFAULT now(),
    data_analise TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.documentos_motorista TO authenticated;
GRANT ALL ON public.documentos_motorista TO service_role;

-- RLS
ALTER TABLE public.documentos_motorista ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Drivers can view their own documents"
    ON public.documentos_motorista
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.motoristas m
            JOIN public.usuarios u ON m.id = u.id
            WHERE m.id = public.documentos_motorista.motorista_id
            AND u.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Drivers can insert their own documents"
    ON public.documentos_motorista
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

CREATE POLICY "Drivers can update their own documents"
    ON public.documentos_motorista
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.motoristas m
            JOIN public.usuarios u ON m.id = u.id
            WHERE m.id = public.documentos_motorista.motorista_id
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

-- Trigger
DROP TRIGGER IF EXISTS on_documento_updated ON public.documentos_motorista;
CREATE TRIGGER on_documento_updated
    BEFORE UPDATE ON public.documentos_motorista
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
