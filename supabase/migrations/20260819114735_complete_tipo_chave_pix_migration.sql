-- Completa a migração que faltava: o código (RPC submit_motorista_for_analysis
-- e a função salvarDadosCNH) já esperava esta coluna, mas ela nunca foi criada
-- de fato no banco. Isso, sozinho, quebra o botão "Enviar para análise" com
-- o erro "column tipo_chave_pix does not exist" antes de qualquer validação
-- rodar. Nada existente é alterado — só o que faltava é adicionado.


DO $$ BEGIN
    CREATE TYPE public.tipo_chave_pix AS ENUM ('cpf', 'telefone', 'email', 'aleatoria');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


ALTER TABLE public.motoristas
  ADD COLUMN IF NOT EXISTS tipo_chave_pix public.tipo_chave_pix;
