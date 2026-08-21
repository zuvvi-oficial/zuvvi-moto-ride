-- Ajustando search_path para evitar riscos de segurança (Search Path Mutable)

ALTER FUNCTION public.validate_chat_mensagem_insert() SET search_path = public;
ALTER FUNCTION public.protect_chat_mensagem_update() SET search_path = public;
ALTER FUNCTION public.validate_chat_presenca() SET search_path = public;

-- Também ajustando outras funções que podem ter sido detectadas pelo linter (como a has_role mencionada nas instruções de segurança caso não tenha search_path)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_role' AND pronamespace = 'public'::regnamespace) THEN
        ALTER FUNCTION public.has_role(uuid, public.app_role) SET search_path = public;
    END IF;
END $$;
