
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'cidades_nome_estado_uf_key'
    ) THEN 
        ALTER TABLE public.cidades ADD CONSTRAINT cidades_nome_estado_uf_key UNIQUE (nome, estado_uf); 
    END IF; 
END $$;
