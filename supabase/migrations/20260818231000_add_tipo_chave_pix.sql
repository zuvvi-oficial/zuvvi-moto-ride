DO $$ BEGIN
    CREATE TYPE public.tipo_chave_pix AS ENUM ('cpf', 'telefone', 'email', 'aleatoria');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS tipo_chave_pix public.tipo_chave_pix;
