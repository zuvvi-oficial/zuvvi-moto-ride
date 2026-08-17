-- migration for fixing avaliacoes security rules
-- 1. Remove existing policies to replace them with stricter ones
DROP POLICY IF EXISTS "Users can insert their own ratings" ON public.avaliacoes;

-- 2. Create a stricter policy for inserting ratings
-- This policy enforces all business rules:
-- - Ride status must be 'concluida'
-- - Evaluator must be a participant (passenger or driver)
-- - Evaluated must be the other participant
-- - Passenger evaluates driver / Driver evaluates passenger
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
            -- Case: Current user is the passenger evaluating the driver
            (up.auth_user_id = auth.uid() AND avaliador_id = up.id AND avaliado_id = ud.id)
            OR
            -- Case: Current user is the driver evaluating the passenger
            (ud.auth_user_id = auth.uid() AND avaliador_id = ud.id AND avaliado_id = up.id)
        )
    )
);

-- Note: The existing unique_avaliacao_per_ride constraint already prevents duplicate ratings.
-- Note: The existing check_not_self_rating constraint already prevents self-rating.
-- Note: The SELECT policy remains as is, allowing users to see ratings they sent or received.
