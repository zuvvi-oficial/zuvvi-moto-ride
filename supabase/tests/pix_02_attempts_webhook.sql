begin;

select plan(48);

select has_table(
  'public',
  'pagamentos_pix_tentativas',
  'tabela pública de tentativas Pix existe'
);
select has_table(
  'private',
  'mercadopago_webhook_eventos',
  'tabela privada de eventos existe'
);
select col_is_pk(
  'public',
  'pagamentos_pix_tentativas',
  'id',
  'tentativa possui chave primária'
);
select col_is_fk(
  'public',
  'pagamentos_pix_tentativas',
  'pagamento_id',
  'pagamento_id é chave estrangeira'
);
select col_is_fk(
  'public',
  'pagamentos_pix_tentativas',
  'motorista_id',
  'motorista_id é chave estrangeira'
);

select ok(
  (select relrowsecurity and relforcerowsecurity
   from pg_class
   where oid = 'public.pagamentos_pix_tentativas'::regclass),
  'RLS de tentativas está habilitada e forçada'
);
select ok(
  (select relrowsecurity and relforcerowsecurity
   from pg_class
   where oid = 'private.mercadopago_webhook_eventos'::regclass),
  'RLS de eventos está habilitada e forçada'
);

select ok(
  not has_table_privilege('anon', 'public.pagamentos_pix_tentativas', 'SELECT'),
  'anon não lê tentativas'
);
select ok(
  not has_table_privilege('authenticated', 'public.pagamentos_pix_tentativas', 'SELECT'),
  'authenticated não lê tentativas diretamente'
);
select ok(
  has_table_privilege(
    'service_role',
    'public.pagamentos_pix_tentativas',
    'SELECT,INSERT,UPDATE'
  ),
  'service_role opera tentativas'
);
select ok(
  not has_table_privilege('service_role', 'public.pagamentos_pix_tentativas', 'DELETE'),
  'service_role não apaga histórico de tentativas'
);
select ok(
  not has_schema_privilege('anon', 'private', 'USAGE'),
  'anon não usa o schema private'
);
select ok(
  not has_schema_privilege('authenticated', 'private', 'USAGE'),
  'authenticated não usa o schema private'
);
select ok(
  has_schema_privilege('service_role', 'private', 'USAGE'),
  'service_role usa o schema private'
);
select ok(
  not has_table_privilege('anon', 'private.mercadopago_webhook_eventos', 'SELECT'),
  'anon não lê eventos'
);
select ok(
  not has_table_privilege('authenticated', 'private.mercadopago_webhook_eventos', 'SELECT'),
  'authenticated não lê eventos'
);
select ok(
  has_table_privilege(
    'service_role',
    'private.mercadopago_webhook_eventos',
    'SELECT,INSERT,UPDATE'
  ),
  'service_role opera eventos'
);
select ok(
  not has_table_privilege('service_role', 'private.mercadopago_webhook_eventos', 'DELETE'),
  'service_role não apaga eventos'
);

select has_check(
  'public',
  'pagamentos_pix_tentativas',
  'tentativas possuem checks de integridade'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.pagamentos_pix_tentativas'::regclass
      and conname = 'pagamentos_pix_tentativas_estado_check'
  ),
  'estado interno possui check explícito'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.pagamentos_pix_tentativas'::regclass
      and conname = 'pagamentos_pix_tentativas_valor_total_check'
  ),
  'valor total possui check explícito'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.pagamentos_pix_tentativas'::regclass
      and conname = 'pagamentos_pix_tentativas_valor_comissao_check'
  ),
  'comissão possui check explícito'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'private.mercadopago_webhook_eventos'::regclass
      and conname = 'mercadopago_webhook_eventos_processing_attempts_check'
  ),
  'número de processamentos possui check explícito'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'private.mercadopago_webhook_eventos'::regclass
      and conname = 'mercadopago_webhook_eventos_processing_status_check'
  ),
  'estado de processamento possui check explícito'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'pagamentos_pix_tentativas'
      and indexname = 'pagamentos_pix_tentativas_idempotency_unique'
      and indexdef ilike '%unique%'
  ),
  'chave de idempotência é única'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'pagamentos_pix_tentativas'
      and indexname = 'pagamentos_pix_tentativas_mp_payment_unique'
      and indexdef ilike '%unique%'
  ),
  'ID Mercado Pago é único'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'pagamentos_pix_tentativas'
      and indexname = 'pagamentos_pix_tentativas_active_payment_unique_idx'
      and indexdef ilike '%unique%where%'
  ),
  'há no máximo uma tentativa ativa por pagamento'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'pagamentos_pix_tentativas'
      and indexname = 'pagamentos_pix_tentativas_pagamento_idx'
  ),
  'FK pagamento possui índice'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'pagamentos_pix_tentativas'
      and indexname = 'pagamentos_pix_tentativas_motorista_idx'
  ),
  'FK motorista possui índice'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'pagamentos_pix_tentativas'
      and indexname = 'pagamentos_pix_tentativas_expires_pending_idx'
      and indexdef ilike '%where%'
  ),
  'expiração pendente possui índice parcial'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'private'
      and tablename = 'mercadopago_webhook_eventos'
      and indexname = 'mercadopago_webhook_eventos_event_key_unique'
      and indexdef ilike '%unique%'
  ),
  'event_key é única'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'private'
      and tablename = 'mercadopago_webhook_eventos'
      and indexname = 'mercadopago_webhook_eventos_resource_idx'
  ),
  'resource_id possui índice'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'private'
      and tablename = 'mercadopago_webhook_eventos'
      and indexname = 'mercadopago_webhook_eventos_received_idx'
  ),
  'received_at possui índice'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'private'
      and tablename = 'mercadopago_webhook_eventos'
      and indexname = 'mercadopago_webhook_eventos_payload_hash_idx'
  ),
  'payload_hash possui índice'
);

insert into public.usuarios (
  id,
  nome,
  perfil_ativo,
  is_passageiro,
  is_motorista
)
values
  (
    '20000000-0000-4000-8000-000000000001'::uuid,
    'Motorista Teste Pix 02 A',
    'motorista',
    false,
    true
  ),
  (
    '20000000-0000-4000-8000-000000000002'::uuid,
    'Motorista Teste Pix 02 B',
    'motorista',
    false,
    true
  );

insert into public.motoristas (id)
values
  ('20000000-0000-4000-8000-000000000001'::uuid),
  ('20000000-0000-4000-8000-000000000002'::uuid);
insert into public.pagamentos (id)
values
  ('30000000-0000-4000-8000-000000000001'::uuid),
  ('30000000-0000-4000-8000-000000000002'::uuid),
  ('30000000-0000-4000-8000-000000000003'::uuid);

set local role service_role;

select lives_ok(
  $$insert into public.pagamentos_pix_tentativas (
      pagamento_id, motorista_id, mercadopago_payment_id, idempotency_key,
      estado_interno, valor_total, valor_comissao, expires_at
    ) values (
      '30000000-0000-4000-8000-000000000001'::uuid,
      '20000000-0000-4000-8000-000000000001'::uuid,
      'mp-payment-01', 'idempotency-01', 'pendente', 10.00, 1.00,
      now() + interval '5 minutes'
    )$$,
  'service_role cria tentativa válida'
);
select throws_ok(
  $$insert into public.pagamentos_pix_tentativas (
      pagamento_id, motorista_id, idempotency_key,
      estado_interno, valor_total, valor_comissao
    ) values (
      '30000000-0000-4000-8000-000000000002'::uuid,
      '20000000-0000-4000-8000-000000000001'::uuid,
      'idempotency-01', 'criando', 12.00, 1.20
    )$$,
  '23505', null,
  'chave de idempotência duplicada é rejeitada'
);
select throws_ok(
  $$insert into public.pagamentos_pix_tentativas (
      pagamento_id, motorista_id, mercadopago_payment_id, idempotency_key,
      estado_interno, valor_total, valor_comissao
    ) values (
      '30000000-0000-4000-8000-000000000002'::uuid,
      '20000000-0000-4000-8000-000000000001'::uuid,
      'mp-payment-01', 'idempotency-02', 'criando', 12.00, 1.20
    )$$,
  '23505', null,
  'ID Mercado Pago duplicado é rejeitado'
);
select throws_ok(
  $$insert into public.pagamentos_pix_tentativas (
      pagamento_id, motorista_id, idempotency_key,
      estado_interno, valor_total, valor_comissao
    ) values (
      '30000000-0000-4000-8000-000000000002'::uuid,
      '20000000-0000-4000-8000-000000000001'::uuid,
      'idempotency-03', 'criando', 10.00, 11.00
    )$$,
  '23514', null,
  'comissão maior que total é rejeitada'
);
select throws_ok(
  $$insert into public.pagamentos_pix_tentativas (
      pagamento_id, motorista_id, idempotency_key,
      estado_interno, valor_total, valor_comissao
    ) values (
      '30000000-0000-4000-8000-000000000002'::uuid,
      '20000000-0000-4000-8000-000000000001'::uuid,
      'idempotency-04', 'criando', 0.00, 0.00
    )$$,
  '23514', null,
  'valor total zero é rejeitado'
);
select throws_ok(
  $$insert into public.pagamentos_pix_tentativas (
      pagamento_id, motorista_id, idempotency_key,
      estado_interno, valor_total, valor_comissao
    ) values (
      '30000000-0000-4000-8000-000000000002'::uuid,
      '20000000-0000-4000-8000-000000000001'::uuid,
      'idempotency-05', 'desconhecido', 10.00, 1.00
    )$$,
  '23514', null,
  'estado desconhecido é rejeitado'
);
select throws_ok(
  $$insert into public.pagamentos_pix_tentativas (
      pagamento_id, motorista_id, idempotency_key,
      estado_interno, valor_total, valor_comissao
    ) values (
      '30000000-0000-4000-8000-000000000001'::uuid,
      '20000000-0000-4000-8000-000000000002'::uuid,
      'idempotency-06', 'criando', 10.00, 1.00
    )$$,
  '23505', null,
  'segunda tentativa ativa do mesmo pagamento é rejeitada'
);

update public.pagamentos_pix_tentativas
set estado_interno = 'falhou', failed_at = now(), updated_at = now()
where pagamento_id = '30000000-0000-4000-8000-000000000001'::uuid;

select lives_ok(
  $$insert into public.pagamentos_pix_tentativas (
      pagamento_id, motorista_id, idempotency_key,
      estado_interno, valor_total, valor_comissao
    ) values (
      '30000000-0000-4000-8000-000000000001'::uuid,
      '20000000-0000-4000-8000-000000000002'::uuid,
      'idempotency-07', 'criando', 10.00, 1.00
    )$$,
  'nova tentativa é permitida depois da anterior falhar'
);
select throws_ok(
  $$insert into public.pagamentos_pix_tentativas (
      pagamento_id, motorista_id, idempotency_key,
      estado_interno, valor_total, valor_comissao
    ) values (
      '30000000-0000-4000-8000-000000000099'::uuid,
      '20000000-0000-4000-8000-000000000001'::uuid,
      'idempotency-08', 'criando', 10.00, 1.00
    )$$,
  '23503', null,
  'pagamento inexistente é rejeitado'
);
select throws_ok(
  $$insert into public.pagamentos_pix_tentativas (
      pagamento_id, motorista_id, idempotency_key,
      estado_interno, valor_total, valor_comissao
    ) values (
      '30000000-0000-4000-8000-000000000003'::uuid,
      '20000000-0000-4000-8000-000000000099'::uuid,
      'idempotency-09', 'criando', 10.00, 1.00
    )$$,
  '23503', null,
  'motorista inexistente é rejeitado'
);
select lives_ok(
  $$insert into private.mercadopago_webhook_eventos (
      event_key, request_id, topic, action, resource_id, payload_hash
    ) values (
      'payment:mp-payment-01:updated', 'request-01', 'payment',
      'payment.updated', 'mp-payment-01', 'sha256-test-01'
    )$$,
  'service_role cria evento válido'
);
select throws_ok(
  $$insert into private.mercadopago_webhook_eventos (
      event_key, topic, resource_id, payload_hash
    ) values (
      'payment:mp-payment-01:updated', 'payment',
      'mp-payment-01', 'sha256-test-02'
    )$$,
  '23505', null,
  'evento duplicado é rejeitado'
);
select throws_ok(
  $$insert into private.mercadopago_webhook_eventos (
      event_key, topic, resource_id, payload_hash, processing_attempts
    ) values (
      'payment:mp-payment-02:updated', 'payment',
      'mp-payment-02', 'sha256-test-03', -1
    )$$,
  '23514', null,
  'contador negativo é rejeitado'
);
select throws_ok(
  $$insert into private.mercadopago_webhook_eventos (
      event_key, topic, resource_id, payload_hash, processing_status
    ) values (
      'payment:mp-payment-03:updated', 'payment',
      'mp-payment-03', 'sha256-test-04', 'desconhecido'
    )$$,
  '23514', null,
  'estado de processamento desconhecido é rejeitado'
);

reset role;

select * from finish();

rollback;
