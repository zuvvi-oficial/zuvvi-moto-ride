-- migration already written to file, executing now
DO $$ BEGIN
    CREATE TYPE public.pagamento_status AS ENUM ('pendente', 'pago', 'falhou', 'estornado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.pagamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    corrida_id UUID NOT NULL REFERENCES public.corridas(id) ON DELETE CASCADE,
    meio public.forma_pagamento NOT NULL,
    valor_total DECIMAL(10, 2) NOT NULL CHECK (valor_total >= 0),
    valor_motorista DECIMAL(10, 2) NOT NULL CHECK (valor_motorista >= 0),
    valor_comissao DECIMAL(10, 2) NOT NULL CHECK (valor_comissao >= 0),
    status public.pagamento_status NOT NULL DEFAULT 'pendente',
    id_transacao_mercadopago TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.pagamentos TO authenticated;
GRANT ALL ON public.pagamentos TO service_role;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios podem ver pagamentos de suas corridas"
    ON public.pagamentos
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.corridas c
            LEFT JOIN public.usuarios up ON c.passageiro_id = up.id
            LEFT JOIN public.usuarios ud ON c.motorista_id = ud.id
            WHERE c.id = public.pagamentos.corrida_id
            AND (up.auth_user_id = auth.uid() OR ud.auth_user_id = auth.uid())
        )
    );

DROP TRIGGER IF EXISTS update_pagamentos_updated_at ON public.pagamentos;
CREATE TRIGGER update_pagamentos_updated_at
    BEFORE UPDATE ON public.pagamentos
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
