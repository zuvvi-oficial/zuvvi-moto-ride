-- Habilitar Realtime para a tabela public.corridas de forma idempotente
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'corridas'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.corridas;
    END IF;
END $$;
