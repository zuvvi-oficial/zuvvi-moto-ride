ALTER TABLE public.veiculos ADD CONSTRAINT veiculos_motorista_id_key UNIQUE (motorista_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.veiculos TO authenticated;
GRANT ALL ON public.veiculos TO service_role;