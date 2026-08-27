create table public.pagamentos_pix_tentativas (
  id uuid primary key default gen_random_uuid(),
  pagamento_id uuid not null
    references public.pagamentos(id) on delete cascade,
  motorista_id uuid not null
    references public.motoristas(id) on delete restrict,
  mercadopago_payment_id text,
  idempotency_key text not null,
  estado_interno text not null default 'criando',
  provider_status text,
  provider_status_detail text,
  valor_total numeric(10, 2) not null,
  valor_comissao numeric(10, 2) not null,
  pix_copia_cola text,
  expires_at timestamptz,
  approved_at timestamptz,
  failed_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pagamentos_pix_tentativas_mp_payment_unique
    unique (mercadopago_payment_id),
  constraint pagamentos_pix_tentativas_idempotency_unique
    unique (idempotency_key),
  constraint pagamentos_pix_tentativas_idempotency_not_blank
    check (btrim(idempotency_key) <> ''),
  constraint pagamentos_pix_tentativas_mp_payment_not_blank
    check (
      mercadopago_payment_id is null
      or btrim(mercadopago_payment_id) <> ''
    ),
  constraint pagamentos_pix_tentativas_estado_check
    check (
      estado_interno in ('criando', 'pendente', 'pago', 'falhou', 'estornado')
    ),
  constraint pagamentos_pix_tentativas_valor_total_check
    check (valor_total > 0),
  constraint pagamentos_pix_tentativas_valor_comissao_check
    check (valor_comissao >= 0 and valor_comissao <= valor_total),
  constraint pagamentos_pix_tentativas_pix_not_blank
    check (pix_copia_cola is null or btrim(pix_copia_cola) <> '')
);

create index pagamentos_pix_tentativas_pagamento_idx
  on public.pagamentos_pix_tentativas (pagamento_id);

create index pagamentos_pix_tentativas_motorista_idx
  on public.pagamentos_pix_tentativas (motorista_id);

create index pagamentos_pix_tentativas_expires_pending_idx
  on public.pagamentos_pix_tentativas (expires_at)
  where estado_interno = 'pendente';

create unique index pagamentos_pix_tentativas_active_payment_unique_idx
  on public.pagamentos_pix_tentativas (pagamento_id)
  where estado_interno in ('criando', 'pendente', 'pago');

alter table public.pagamentos_pix_tentativas enable row level security;
alter table public.pagamentos_pix_tentativas force row level security;

revoke all on table public.pagamentos_pix_tentativas
  from public, anon, authenticated;
grant select, insert, update
  on table public.pagamentos_pix_tentativas
  to service_role;

create table private.mercadopago_webhook_eventos (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  request_id text,
  topic text not null,
  action text,
  resource_id text not null,
  payload_hash text not null,
  processing_status text not null default 'received',
  processing_attempts integer not null default 0,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_code text,
  constraint mercadopago_webhook_eventos_event_key_unique
    unique (event_key),
  constraint mercadopago_webhook_eventos_event_key_not_blank
    check (btrim(event_key) <> ''),
  constraint mercadopago_webhook_eventos_topic_not_blank
    check (btrim(topic) <> ''),
  constraint mercadopago_webhook_eventos_resource_not_blank
    check (btrim(resource_id) <> ''),
  constraint mercadopago_webhook_eventos_payload_hash_not_blank
    check (btrim(payload_hash) <> ''),
  constraint mercadopago_webhook_eventos_processing_status_check
    check (processing_status in ('received', 'processing', 'processed', 'failed')),
  constraint mercadopago_webhook_eventos_processing_attempts_check
    check (processing_attempts >= 0)
);

create index mercadopago_webhook_eventos_resource_idx
  on private.mercadopago_webhook_eventos (resource_id);

create index mercadopago_webhook_eventos_received_idx
  on private.mercadopago_webhook_eventos (received_at desc);

create index mercadopago_webhook_eventos_payload_hash_idx
  on private.mercadopago_webhook_eventos (payload_hash);

alter table private.mercadopago_webhook_eventos enable row level security;
alter table private.mercadopago_webhook_eventos force row level security;

revoke all on table private.mercadopago_webhook_eventos
  from public, anon, authenticated;
grant select, insert, update
  on table private.mercadopago_webhook_eventos
  to service_role;

comment on table public.pagamentos_pix_tentativas is
  'Tentativas Pix imutáveis por identidade externa, com estado operacional controlado pelo servidor.';
comment on table private.mercadopago_webhook_eventos is
  'Eventos Mercado Pago deduplicados para processamento idempotente no servidor; não armazena payload bruto.';
