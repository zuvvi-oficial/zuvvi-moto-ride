-- Advisor de segurança (function_search_path_mutable, WARN): as duas funções
-- abaixo não fixavam search_path, deixando a resolução de esquema depender do
-- search_path da sessão que dispara o trigger. Nenhuma delas muda de
-- comportamento aqui — só passam a fixar search_path = '' (todas as
-- referências já eram explicitamente qualificadas: public.contatos_confianca,
-- e as demais são objetos de pg_catalog, sempre pesquisado implicitamente
-- independente do search_path configurado).
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = ''
as $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

create or replace function public.enforce_contatos_confianca_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
BEGIN
    -- Lock consultivo por passageiro: serializa inserts concorrentes do
    -- mesmo usuário sem travar outras linhas/usuários.
    PERFORM pg_advisory_xact_lock(
        hashtextextended(NEW.passageiro_id::text, 0)
    );

    IF (
        SELECT count(*)
        FROM public.contatos_confianca
        WHERE passageiro_id = NEW.passageiro_id
    ) >= 5 THEN
        RAISE EXCEPTION
            'Você atingiu o limite de 5 contatos de confiança. Exclua um para adicionar outro.'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;
