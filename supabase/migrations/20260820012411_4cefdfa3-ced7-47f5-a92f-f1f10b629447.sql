-- ZUVVI — MICROETAPA 0.3 — CORRIGIR OWNERSHIP DA POLICY DE INSERT DE CORRIDAS

-- Drop policy if exists
DROP POLICY IF EXISTS "Passageiros podem criar suas próprias corridas" ON public.corridas;

-- Recreate policy with correct WITH CHECK mapping passageiro_id (usuarios.id) to auth.uid() (usuarios.auth_user_id)
CREATE POLICY "Passageiros podem criar suas próprias corridas"
    ON public.corridas
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.usuarios u
            WHERE u.id = passageiro_id
            AND u.auth_user_id = auth.uid()
        )
    );