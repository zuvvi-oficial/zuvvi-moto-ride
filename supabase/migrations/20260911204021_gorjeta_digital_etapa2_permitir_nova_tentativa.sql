-- Corrige achado P1 do Codex no PR #76: como corridas_agendadas.corrida_id
-- é único (Etapa 1), uma cobrança Pix de gorjeta que expira ou é rejeitada
-- travava o passageiro pra sempre — não existia como tentar de novo pra
-- aquela corrida. tentativa_pix_id vira a chave de idempotência estável da
-- tentativa em andamento (reservada antes de chamar o Mercado Pago, reusada
-- em retries do mesmo pedido, e trocada só quando uma tentativa anterior é
-- confirmada morta — rejeitada/cancelada/expirada — antes de gerar uma nova
-- cobrança pra mesma gorjeta).
ALTER TABLE public.gorjetas
    ADD COLUMN tentativa_pix_id uuid NULL;
