-- Cupons de desconto — Etapa 2: reforça os limites de uso (total e por
-- usuário) direto no banco, com lock consultivo (mesma técnica de
-- motoristas_favoritos/corridas_agendadas), pra fechar a janela de corrida
-- entre duas requisições concorrentes que passariam pela checagem de
-- aplicação (avaliarCupomParaCorrida) ao mesmo tempo e ambas inserirem uso
-- além do limite. A checagem em código continua existindo (evita o
-- trabalho caro de criar a corrida quando já dá pra saber que o cupom não
-- vale), mas só o trigger garante a invariante de verdade.
CREATE FUNCTION public.enforce_cupom_usos_limites()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    _limite_total integer;
    _limite_usuario integer;
    _usos_total integer;
    _usos_usuario integer;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.cupom_id::text, 2));

    SELECT limite_uso_total, limite_uso_por_usuario
    INTO _limite_total, _limite_usuario
    FROM public.cupons
    WHERE id = NEW.cupom_id;

    IF _limite_total IS NOT NULL THEN
        SELECT count(*) INTO _usos_total FROM public.cupom_usos WHERE cupom_id = NEW.cupom_id;
        IF _usos_total >= _limite_total THEN
            RAISE EXCEPTION 'Este cupom atingiu o limite de usos.' USING ERRCODE = '23514';
        END IF;
    END IF;

    SELECT count(*) INTO _usos_usuario
    FROM public.cupom_usos
    WHERE cupom_id = NEW.cupom_id AND usuario_id = NEW.usuario_id;
    IF _usos_usuario >= _limite_usuario THEN
        RAISE EXCEPTION 'Você já usou este cupom o máximo de vezes permitido.' USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_cupom_usos_limites_trigger
BEFORE INSERT ON public.cupom_usos
FOR EACH ROW
EXECUTE FUNCTION public.enforce_cupom_usos_limites();
