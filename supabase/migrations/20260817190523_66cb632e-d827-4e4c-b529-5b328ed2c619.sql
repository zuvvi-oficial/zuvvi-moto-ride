
-- 1. Criar o novo Enum para status_aprovacao
DO $$ BEGIN
    CREATE TYPE public.motorista_status_aprovacao AS ENUM (
        'em_preenchimento',
        'em_analise',
        'aprovado',
        'recusado',
        'suspenso'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Limpar a tabela motoristas removendo campos antigos e o enum antigo (se possível, ou apenas ignorar o enum antigo)
-- Primeiro removemos os campos que não fazem parte da nova definição
ALTER TABLE public.motoristas 
    DROP COLUMN IF EXISTS display_name,
    DROP COLUMN IF EXISTS bio,
    DROP COLUMN IF EXISTS rating_average,
    DROP COLUMN IF EXISTS rating_count,
    DROP COLUMN IF EXISTS onboarding_completed_at,
    DROP COLUMN IF EXISTS payment_ready,
    DROP COLUMN IF EXISTS suspended_at,
    DROP COLUMN IF EXISTS suspension_reason,
    DROP COLUMN IF EXISTS status; -- O campo 'status' antigo usava o enum 'motorista_status'

-- 3. Adicionar os novos campos
ALTER TABLE public.motoristas
    ADD COLUMN IF NOT EXISTS cnh_numero TEXT,
    ADD COLUMN IF NOT EXISTS cnh_categoria TEXT CHECK (cnh_categoria IN ('A', 'AB')),
    ADD COLUMN IF NOT EXISTS cnh_validade DATE,
    ADD COLUMN IF NOT EXISTS status_aprovacao public.motorista_status_aprovacao NOT NULL DEFAULT 'em_preenchimento',
    ADD COLUMN IF NOT EXISTS nota_media DECIMAL(3, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS chave_pix TEXT,
    ADD COLUMN IF NOT EXISTS conta_mercado_pago_id TEXT;

-- 4. O vínculo 'id' como PK e FK para 'usuarios(id)' já é uma relação 1:1 segura e eficiente, então será mantido.
-- O RLS já foi configurado anteriormente e se baseia no motoristas.id vinculado ao usuarios.auth_user_id, o que permanece válido.

-- Nota: created_at e updated_at já existiam e foram mantidos.
