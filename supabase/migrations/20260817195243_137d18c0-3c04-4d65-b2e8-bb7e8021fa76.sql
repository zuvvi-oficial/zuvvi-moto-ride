-- Create the avaliacoes table
CREATE TABLE public.avaliacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    corrida_id UUID NOT NULL REFERENCES public.corridas(id) ON DELETE CASCADE,
    avaliador_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    avaliado_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    nota INTEGER NOT NULL CHECK (nota >= 1 AND nota <= 5),
    comentario TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Ensure same person doesn't rate same person twice for the same ride
    CONSTRAINT unique_avaliacao_per_ride UNIQUE (corrida_id, avaliador_id, avaliado_id),
    -- Ensure user cannot rate themselves
    CONSTRAINT check_not_self_rating CHECK (avaliador_id <> avaliado_id)
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avaliacoes TO authenticated;
GRANT ALL ON public.avaliacoes TO service_role;

-- Enable RLS
ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can see ratings they gave or received
CREATE POLICY "Users can view their own sent or received ratings"
ON public.avaliacoes
FOR SELECT
TO authenticated
USING (
    avaliador_id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid()) OR
    avaliado_id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid())
);

-- Users can only insert ratings where they are the evaluator
CREATE POLICY "Users can insert their own ratings"
ON public.avaliacoes
FOR INSERT
TO authenticated
WITH CHECK (
    avaliador_id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid())
);

-- Trigger for updated_at
CREATE TRIGGER handle_avaliacoes_updated_at
    BEFORE UPDATE ON public.avaliacoes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
