-- 1. Tornar a coluna nota_media anulável e remover o valor padrão
ALTER TABLE public.motoristas ALTER COLUMN nota_media DROP NOT NULL;
ALTER TABLE public.motoristas ALTER COLUMN nota_media DROP DEFAULT;

-- 2. Corrigir motoristas que estão com 0 (nunca avaliados)
UPDATE public.motoristas SET nota_media = NULL WHERE nota_media = 0;

-- 3. Contra-prova imediata para auditoria
-- (Estes comandos rodam na transação da migration)
