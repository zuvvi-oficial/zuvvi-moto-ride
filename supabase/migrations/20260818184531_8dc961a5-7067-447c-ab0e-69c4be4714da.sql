CREATE TABLE IF NOT EXISTS public.motorista_recusas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    motorista_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE NOT NULL,
    corrida_id uuid REFERENCES public.corridas(id) ON DELETE CASCADE NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE (motorista_id, corrida_id)
);

ALTER TABLE public.motorista_recusas ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.motorista_recusas TO authenticated;
GRANT ALL ON public.motorista_recusas TO service_role;

CREATE POLICY "Motoristas podem ver suas próprias recusas"
ON public.motorista_recusas FOR SELECT
TO authenticated
USING (auth.uid() = (SELECT auth_user_id FROM public.usuarios WHERE id = motorista_id));

CREATE POLICY "Motoristas podem inserir suas recusas"
ON public.motorista_recusas FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = (SELECT auth_user_id FROM public.usuarios WHERE id = motorista_id));

CREATE INDEX IF NOT EXISTS idx_motorista_recusas_lookup ON public.motorista_recusas(motorista_id, corrida_id);