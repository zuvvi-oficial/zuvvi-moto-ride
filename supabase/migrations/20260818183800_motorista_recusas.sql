-- Tabela para registrar recusas de motoristas para não exibir a mesma corrida novamente
CREATE TABLE public.motorista_recusas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    motorista_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE NOT NULL,
    corrida_id uuid REFERENCES public.corridas(id) ON DELETE CASCADE NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE (motorista_id, corrida_id)
);

-- Habilitar RLS
ALTER TABLE public.motorista_recusas ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT ON public.motorista_recusas TO authenticated;
GRANT ALL ON public.motorista_recusas TO service_role;

-- Políticas
CREATE POLICY "Motoristas podem ver suas próprias recusas"
ON public.motorista_recusas FOR SELECT
TO authenticated
USING (auth.uid() = (SELECT auth_user_id FROM public.usuarios WHERE id = motorista_id));

CREATE POLICY "Motoristas podem inserir suas recusas"
ON public.motorista_recusas FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = (SELECT auth_user_id FROM public.usuarios WHERE id = motorista_id));

-- Adicionar índice para performance no filtro de ofertas
CREATE INDEX idx_motorista_recusas_lookup ON public.motorista_recusas(motorista_id, corrida_id);
