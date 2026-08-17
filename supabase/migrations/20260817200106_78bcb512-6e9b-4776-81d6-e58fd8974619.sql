DROP POLICY IF EXISTS "Users can insert their own ratings" ON public.avaliacoes; 

CREATE POLICY "Strict insertion of ratings per ride participant" 
ON public.avaliacoes 
FOR INSERT 
TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.corridas c
        JOIN public.usuarios up ON c.passageiro_id = up.id
        JOIN public.usuarios ud ON c.motorista_id = ud.id
        WHERE c.id = public.avaliacoes.corrida_id
        AND c.status = 'concluida'
        AND (
            -- Passageiro avaliando o motorista
            (up.auth_user_id = auth.uid() AND avaliador_id = up.id AND avaliado_id = ud.id)
            OR
            -- Motorista avaliando o passageiro
            (ud.auth_user_id = auth.uid() AND avaliador_id = ud.id AND avaliado_id = up.id)
        )
    )
);