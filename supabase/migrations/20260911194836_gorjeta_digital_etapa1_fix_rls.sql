-- Correção de dois achados do Codex no PR #74 sobre a Etapa 1 de gorjeta
-- digital: a política de RLS de INSERT só validava participação/conclusão
-- da corrida, então um passageiro chamando a Data API do Supabase direto
-- (em vez de criarGorjeta) conseguia:
--   1. Inserir valor abaixo do mínimo anunciado de R$1 (a constraint só
--      exigia > 0, o Zod min(1) só valia dentro do server function).
--   2. Registrar gorjeta 'pendente' pra um motorista sem Pix Mercado Pago
--      conectado — como corrida_id é único, isso trava pra sempre o slot
--      de gorjeta daquela corrida, já que a Etapa 2 nunca vai conseguir
--      cobrar (e não existe fluxo de reabrir esse slot).

-- 1. Alinha a constraint de banco com o mínimo já anunciado ao usuário.
ALTER TABLE public.gorjetas DROP CONSTRAINT gorjetas_valor_check;
ALTER TABLE public.gorjetas ADD CONSTRAINT gorjetas_valor_check
    CHECK (valor >= 1 AND valor <= 200);

-- 2. Função SECURITY DEFINER que expõe só o booleano "conectado" (nunca as
-- credenciais em si, que continuam revogadas de authenticated/anon) pra
-- poder ser usada dentro da própria política de RLS. Mesma lógica de
-- getPixMercadoPagoSecureConnectionStatus (pix-mercadopago-account.server.ts).
CREATE FUNCTION public.motorista_pix_conectado(_motorista_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.motoristas m
        JOIN private.motorista_mercadopago_credenciais c ON c.motorista_id = m.id
        WHERE m.id = _motorista_id
        AND m.conta_mercado_pago_id IS NOT NULL
        AND c.connection_status = 'active'
        AND c.revoked_at IS NULL
        AND c.encryption_version > 0
        AND c.access_token_encrypted IS NOT NULL AND char_length(c.access_token_encrypted) > 0
        AND c.refresh_token_encrypted IS NOT NULL AND char_length(c.refresh_token_encrypted) > 0
        AND c.mercadopago_user_id = m.conta_mercado_pago_id
    );
$$;

REVOKE ALL ON FUNCTION public.motorista_pix_conectado(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.motorista_pix_conectado(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.motorista_pix_conectado(uuid) IS
    'Expõe só o booleano de conexão Pix ativa do motorista, sem vazar credenciais — uso liberado pra RLS/clientes autenticados.';

-- 3. Reforça a política de INSERT com a mesma elegibilidade que criarGorjeta
-- já checa em código, agora também no banco.
DROP POLICY "passageiro registra gorjeta da própria corrida" ON public.gorjetas;

CREATE POLICY "passageiro registra gorjeta da própria corrida"
ON public.gorjetas
FOR INSERT
TO authenticated
WITH CHECK (
    status = 'pendente'
    AND id_transacao_mercadopago IS NULL
    AND public.motorista_pix_conectado(gorjetas.motorista_id)
    AND EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.id = gorjetas.passageiro_id
        AND u.auth_user_id = auth.uid()
    )
    AND EXISTS (
        SELECT 1 FROM public.corridas c
        WHERE c.id = gorjetas.corrida_id
        AND c.passageiro_id = gorjetas.passageiro_id
        AND c.motorista_id = gorjetas.motorista_id
        AND c.status = 'concluida'
    )
);
