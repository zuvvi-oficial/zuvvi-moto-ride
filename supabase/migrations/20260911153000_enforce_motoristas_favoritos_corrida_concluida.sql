-- Achado do Codex no PR #62 (P1): a policy de INSERT em
-- motoristas_favoritos só verificava a posse de passageiro_id, não a regra
-- de negócio "só pode favoritar quem já te levou" — essa regra só existia
-- em adicionarMotoristaFavorito (motoristas-favoritos.functions.ts). Como a
-- tabela concede INSERT direto pro authenticated, qualquer usuário podia
-- pular a função e inserir via API REST do Supabase um motorista_id
-- arbitrário, nunca tendo andado com ele — contaminando os dados que as
-- próximas etapas vão usar pra dar prioridade na oferta de corridas.
-- Movida a regra pro WITH CHECK da própria policy: agora a garantia existe
-- em dois lugares (defesa em profundidade), e não só em código de
-- aplicação.
DROP POLICY "passageiro insere seus próprios motoristas favoritos" ON public.motoristas_favoritos;

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
    AND EXISTS (
        SELECT 1 FROM public.corridas c
        WHERE c.passageiro_id = motoristas_favoritos.passageiro_id
        AND c.motorista_id = motoristas_favoritos.motorista_id
        AND c.status = 'concluida'
    )
);
