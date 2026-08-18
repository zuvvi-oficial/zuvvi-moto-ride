ALTER TABLE public.documentos_motorista 
ADD CONSTRAINT documentos_motorista_motorista_id_tipo_documento_key 
UNIQUE (motorista_id, tipo_documento);