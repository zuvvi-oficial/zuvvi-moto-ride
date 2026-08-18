-- Adiciona restrição de unicidade para motorista_id na tabela veiculos
-- Isso permite o uso de ON CONFLICT (motorista_id) na função criarVeiculo
ALTER TABLE public.veiculos ADD CONSTRAINT veiculos_motorista_id_key UNIQUE (motorista_id);
