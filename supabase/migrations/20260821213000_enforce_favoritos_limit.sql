-- Enforce a limit of 10 favorites per user
CREATE OR REPLACE FUNCTION public.enforce_enderecos_favoritos_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    -- Advisory lock to prevent race conditions for the same user
    PERFORM pg_advisory_xact_lock(
        hashtextextended(NEW.usuario_id::text, 0)
    );

    IF (
        SELECT count(*)
        FROM public.enderecos_favoritos
        WHERE usuario_id = NEW.usuario_id
    ) >= 10 THEN
        RAISE EXCEPTION
            'Você atingiu o limite de 10 favoritos. Exclua um favorito para adicionar outro.'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_enderecos_favoritos_limit_trigger
BEFORE INSERT ON public.enderecos_favoritos
FOR EACH ROW
EXECUTE FUNCTION public.enforce_enderecos_favoritos_limit();
