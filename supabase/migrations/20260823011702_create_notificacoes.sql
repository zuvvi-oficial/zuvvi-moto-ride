CREATE TABLE public.notificacoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE NOT NULL,
    tipo text NOT NULL,
    titulo text NOT NULL,
    mensagem text NOT NULL,
    corrida_id uuid REFERENCES public.corridas(id) ON DELETE SET NULL,
    lida boolean DEFAULT false NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, UPDATE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;

-- Políticas de RLS
CREATE POLICY "Usuários podem ver suas próprias notificações"
ON public.notificacoes
FOR SELECT
TO authenticated
USING (
    usuario_id IN (
        SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid()
    )
);

CREATE POLICY "Usuários podem marcar suas notificações como lidas"
ON public.notificacoes
FOR UPDATE
TO authenticated
USING (
    usuario_id IN (
        SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid()
    )
)
WITH CHECK (
    usuario_id IN (
        SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid()
    )
);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
