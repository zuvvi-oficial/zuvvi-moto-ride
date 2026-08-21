
-- Microetapa Favoritos 1: Estrutura segura de endereços favoritos
-- Data: 2026-08-21 19:39:14

CREATE TABLE public.enderecos_favoritos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    nome text NOT NULL CONSTRAINT enderecos_favoritos_nome_check CHECK (char_length(trim(nome)) > 0 AND char_length(nome) <= 40),
    endereco text NOT NULL CONSTRAINT enderecos_favoritos_endereco_check CHECK (char_length(trim(endereco)) > 0 AND char_length(endereco) <= 300),
    latitude numeric NOT NULL CONSTRAINT enderecos_favoritos_latitude_check CHECK (latitude >= -90 AND latitude <= 90),
    longitude numeric NOT NULL CONSTRAINT enderecos_favoritos_longitude_check CHECK (longitude >= -180 AND longitude <= 180),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enderecos_favoritos TO authenticated;
GRANT ALL ON public.enderecos_favoritos TO service_role;

-- Índices
CREATE INDEX enderecos_favoritos_usuario_id_idx ON public.enderecos_favoritos(usuario_id);
CREATE UNIQUE INDEX enderecos_favoritos_usuario_nome_unique ON public.enderecos_favoritos(usuario_id, lower(trim(nome)));

-- RLS
ALTER TABLE public.enderecos_favoritos ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "usuário somente vê seus próprios favoritos"
ON public.enderecos_favoritos
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.id = enderecos_favoritos.usuario_id
        AND u.auth_user_id = auth.uid()
    )
);

CREATE POLICY "usuário somente insere seus próprios favoritos"
ON public.enderecos_favoritos
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.id = enderecos_favoritos.usuario_id
        AND u.auth_user_id = auth.uid()
    )
);

CREATE POLICY "usuário somente altera seus próprios favoritos"
ON public.enderecos_favoritos
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.id = enderecos_favoritos.usuario_id
        AND u.auth_user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.id = enderecos_favoritos.usuario_id
        AND u.auth_user_id = auth.uid()
    )
);

CREATE POLICY "usuário somente exclui seus próprios favoritos"
ON public.enderecos_favoritos
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.id = enderecos_favoritos.usuario_id
        AND u.auth_user_id = auth.uid()
    )
);

-- Trigger updated_at
CREATE TRIGGER handle_updated_at_enderecos_favoritos
    BEFORE UPDATE ON public.enderecos_favoritos
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
