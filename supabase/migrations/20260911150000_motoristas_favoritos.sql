-- Motoristas favoritos — Etapa 1 do recurso "motorista fixo/preferido"
-- pedido pelo usuário. Passageiro marca motoristas com quem já andou como
-- favoritos; nas próximas etapas isso vai dar prioridade na oferta de
-- corridas. Nesta etapa é só a camada de dados (tabela + limite seguro),
-- nenhuma mudança na criação/matching de corridas ainda.

CREATE TABLE public.motoristas_favoritos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    passageiro_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    motorista_id uuid NOT NULL REFERENCES public.motoristas(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT motoristas_favoritos_passageiro_motorista_unique UNIQUE (passageiro_id, motorista_id)
);

GRANT SELECT, INSERT, DELETE ON public.motoristas_favoritos TO authenticated;
GRANT ALL ON public.motoristas_favoritos TO service_role;

CREATE INDEX motoristas_favoritos_passageiro_id_idx ON public.motoristas_favoritos(passageiro_id);
CREATE INDEX motoristas_favoritos_motorista_id_idx ON public.motoristas_favoritos(motorista_id);

ALTER TABLE public.motoristas_favoritos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "passageiro vê seus próprios motoristas favoritos"
ON public.motoristas_favoritos
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.id = motoristas_favoritos.passageiro_id
        AND u.auth_user_id = auth.uid()
    )
);

CREATE POLICY "passageiro insere seus próprios motoristas favoritos"
ON public.motoristas_favoritos
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.id = motoristas_favoritos.passageiro_id
        AND u.auth_user_id = auth.uid()
    )
);

CREATE POLICY "passageiro exclui seus próprios motoristas favoritos"
ON public.motoristas_favoritos
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.id = motoristas_favoritos.passageiro_id
        AND u.auth_user_id = auth.uid()
    )
);

-- Limite de 5 favoritos, aplicado com lock consultivo (não só checagem em
-- código de aplicação) para evitar de largada a mesma condição de corrida
-- (TOCTOU) já encontrada e corrigida depois dos fatos em contatos_confianca
-- (20260906190100) e enderecos_favoritos (20260821212540) — replicando a
-- mesma técnica, e já com search_path fixo (20260907170000).
CREATE FUNCTION public.enforce_motoristas_favoritos_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    -- Lock consultivo por passageiro: serializa inserts concorrentes do
    -- mesmo usuário sem travar outras linhas/usuários.
    PERFORM pg_advisory_xact_lock(
        hashtextextended(NEW.passageiro_id::text, 0)
    );

    IF (
        SELECT count(*)
        FROM public.motoristas_favoritos
        WHERE passageiro_id = NEW.passageiro_id
    ) >= 5 THEN
        RAISE EXCEPTION
            'Você atingiu o limite de 5 motoristas favoritos. Remova um para adicionar outro.'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_motoristas_favoritos_limit_trigger
BEFORE INSERT ON public.motoristas_favoritos
FOR EACH ROW
EXECUTE FUNCTION public.enforce_motoristas_favoritos_limit();
