
-- 1. Adicionar campos de disponibilidade e localização ao motorista
ALTER TABLE public.motoristas
    ADD COLUMN IF NOT EXISTS is_disponivel BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS ultima_lat DECIMAL(10, 8),
    ADD COLUMN IF NOT EXISTS ultima_lng DECIMAL(11, 8),
    ADD COLUMN IF NOT EXISTS ultima_localizacao_at TIMESTAMPTZ;

-- 2. Grant para as novas colunas
GRANT UPDATE(is_disponivel, ultima_lat, ultima_lng, ultima_localizacao_at) ON public.motoristas TO authenticated;

-- 3. Garantir que Jacarezinho é a única piloto
UPDATE public.cidades SET status = 'em_breve' WHERE nome != 'Jacarezinho';
UPDATE public.cidades SET status = 'piloto' WHERE nome = 'Jacarezinho';

-- 4. Adicionar colunas faltantes na tabela de corridas se necessário (origem_nome e destino_nome)
-- Nota: O código já tenta usar estes campos, vamos garantir que existam
ALTER TABLE public.corridas ADD COLUMN IF NOT EXISTS origem_nome TEXT;
ALTER TABLE public.corridas ADD COLUMN IF NOT EXISTS destino_nome TEXT;
