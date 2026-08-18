ALTER TABLE public.corridas 
ADD COLUMN IF NOT EXISTS origem_nome TEXT,
ADD COLUMN IF NOT EXISTS destino_nome TEXT;

COMMENT ON COLUMN public.corridas.origem_nome IS 'Nome legível ou endereço do ponto de partida';
COMMENT ON COLUMN public.corridas.destino_nome IS 'Nome legível ou endereço do ponto de destino';