-- Limpeza 2: o motorista já atribuído a uma corrida podia tentar validar o
-- codigo_embarque (4 dígitos, 10 mil combinações) um número ilimitado de
-- vezes, sem nenhum bloqueio — um motorista mal-intencionado podia, em teoria,
-- forçar o código por tentativa e erro e iniciar a corrida sem o passageiro
-- ter confirmado o embarque de verdade. Esta coluna dá ao servidor um jeito
-- de contar e travar tentativas incorretas, sem depender de nenhuma
-- infraestrutura nova (Redis/KV) — só uma coluna e uma trava no código.
alter table public.corridas
  add column if not exists tentativas_codigo_embarque smallint not null default 0;
