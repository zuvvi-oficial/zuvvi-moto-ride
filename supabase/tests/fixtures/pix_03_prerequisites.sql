create type public.forma_pagamento as enum ('dinheiro', 'cartao', 'pix');

alter table public.pagamentos
  add column corrida_id uuid,
  add column meio public.forma_pagamento,
  add column id_transacao_mercadopago text;

insert into public.pagamentos (
  id,
  corrida_id,
  meio,
  id_transacao_mercadopago
)
values
  (
    '31000000-0000-4000-8000-000000000001'::uuid,
    '41000000-0000-4000-8000-000000000001'::uuid,
    'dinheiro',
    null
  ),
  (
    '31000000-0000-4000-8000-000000000002'::uuid,
    '41000000-0000-4000-8000-000000000002'::uuid,
    'cartao',
    null
  ),
  (
    '31000000-0000-4000-8000-000000000003'::uuid,
    '41000000-0000-4000-8000-000000000003'::uuid,
    'pix',
    'mp-pix-existing-01'
  );
