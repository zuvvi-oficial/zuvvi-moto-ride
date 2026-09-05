-- Limpeza 3: criarContatoConfianca só checava o limite de 5 contatos em
-- código de aplicação (COUNT antes do INSERT) — clássica condição de corrida
-- (TOCTOU): duas requisições concorrentes do mesmo passageiro podiam passar
-- ambas pela checagem antes de qualquer uma delas inserir, resultando em mais
-- de 5 contatos salvos. O mesmo padrão já existia em enderecos_favoritos
-- (limite de 10) e foi corrigido lá com um trigger + advisory lock
-- (20260821212540); replicando exatamente a mesma técnica aqui.
CREATE OR REPLACE FUNCTION public.enforce_contatos_confianca_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
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

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'enforce_contatos_confianca_limit_trigger') THEN
        CREATE TRIGGER enforce_contatos_confianca_limit_trigger
        BEFORE INSERT ON public.contatos_confianca
        FOR EACH ROW
        EXECUTE FUNCTION public.enforce_contatos_confianca_limit();
    END IF;
END $$;
