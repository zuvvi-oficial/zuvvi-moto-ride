
-- 1. Tentar adicionar status 'em_analise' ao motorista_status
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'em_analise' AND enumtypid = 'public.motorista_status'::regtype) THEN
        ALTER TYPE public.motorista_status ADD VALUE 'em_analise';
    END IF;
EXCEPTION
    WHEN OTHERS THEN RAISE NOTICE 'Erro ao adicionar enum value: %', SQLERRM;
END $$;

-- 2. Colunas adicionais em motoristas
ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS cnh_numero TEXT;
ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS cnh_categoria TEXT;
ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS cnh_validade DATE;
ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS chave_pix TEXT;

-- 3. Políticas de RLS para Storage (documentos-motorista)
CREATE POLICY "Drivers can upload to their own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'documentos-motorista' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Drivers can read their own folder"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'documentos-motorista' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);
