-- ZUVVI — MICROETAPA 2.5 — RESTAURAR REALTIME REAL DE CORRIDAS
-- Objetivo: Garantir de forma idempotente que a tabela public.corridas está na publicação supabase_realtime.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'corridas'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.corridas;
    END IF;
END $$;
