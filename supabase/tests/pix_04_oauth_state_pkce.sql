begin;

select plan(45);

select has_schema('private', 'schema private existe');
select has_table(
  'private',
  'mercadopago_oauth_tentativas',
  'tabela privada de tentativas OAuth existe'
);
select has_column(
  'private', 'mercadopago_oauth_tentativas', 'id',
  'tentativa possui id'
);
select has_column(
  'private', 'mercadopago_oauth_tentativas', 'motorista_id',
  'tentativa possui motorista_id'
);
select has_column(
  'private', 'mercadopago_oauth_tentativas', 'state_hash',
  'tentativa possui somente hash do state'
);
select has_column(
  'private', 'mercadopago_oauth_tentativas', 'code_verifier_encrypted',
  'tentativa possui envelope cifrado do code_verifier'
);
select has_column(
  'private', 'mercadopago_oauth_tentativas', 'encryption_version',
  'tentativa possui versão da cifra'
);
select has_column(
  'private', 'mercadopago_oauth_tentativas', 'expires_at',
  'tentativa possui expiração'
);
select has_column(
  'private', 'mercadopago_oauth_tentativas', 'consumed_at',
  'tentativa possui horário de consumo'
);
select has_column(
  'private', 'mercadopago_oauth_tentativas', 'created_at',
  'tentativa possui horário de criação'
);
select col_is_pk(
  'private', 'mercadopago_oauth_tentativas', 'id',
  'id é chave primária'
);
select col_is_fk(
  'private', 'mercadopago_oauth_tentativas', 'motorista_id',
  'motorista_id é chave estrangeira'
);

select ok(
  (select relrowsecurity and relforcerowsecurity
   from pg_class
   where oid = 'private.mercadopago_oauth_tentativas'::regclass),
  'RLS está habilitada e forçada'
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
  not has_table_privilege(
    'anon', 'private.mercadopago_oauth_tentativas', 'SELECT'
  ),
  'anon não lê tentativas OAuth'
);
select ok(
  not has_table_privilege(
    'authenticated', 'private.mercadopago_oauth_tentativas', 'SELECT'
  ),
  'authenticated não lê tentativas OAuth'
);
select ok(
  has_table_privilege(
    'service_role',
    'private.mercadopago_oauth_tentativas',
    'SELECT,INSERT,UPDATE'
  ),
  'service_role possui somente o acesso operacional necessário'
);
select ok(
  not has_table_privilege(
    'service_role', 'private.mercadopago_oauth_tentativas', 'DELETE'
  ),
  'service_role não apaga evidências OAuth'
);

select has_function(
  'public',
  'pix_oauth_state_create',
  array['uuid', 'text', 'text', 'smallint', 'timestamp with time zone'],
  'função de criação existe'
);
select has_function(
  'public',
  'pix_oauth_state_consume',
  array['uuid', 'text'],
  'função de consumo existe'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.pix_oauth_state_create(uuid,text,text,smallint,timestamp with time zone)',
    'EXECUTE'
  ),
  'anon não executa criação'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.pix_oauth_state_create(uuid,text,text,smallint,timestamp with time zone)',
    'EXECUTE'
  ),
  'authenticated não executa criação'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.pix_oauth_state_create(uuid,text,text,smallint,timestamp with time zone)',
    'EXECUTE'
  ),
  'service_role executa criação'
);
select ok(
  not has_function_privilege(
    'anon', 'public.pix_oauth_state_consume(uuid,text)', 'EXECUTE'
  ),
  'anon não executa consumo'
);
select ok(
  not has_function_privilege(
    'authenticated', 'public.pix_oauth_state_consume(uuid,text)', 'EXECUTE'
  ),
  'authenticated não executa consumo'
);
select ok(
  has_function_privilege(
    'service_role', 'public.pix_oauth_state_consume(uuid,text)', 'EXECUTE'
  ),
  'service_role executa consumo'
);
select ok(
  (select count(*) = 2
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('pix_oauth_state_create', 'pix_oauth_state_consume')
     and not p.prosecdef),
  'funções OAuth são SECURITY INVOKER'
);
select ok(
  (select count(*) = 2
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('pix_oauth_state_create', 'pix_oauth_state_consume')
     and p.proconfig @> array['search_path=pg_catalog, public, private']),
  'funções OAuth possuem search_path fixo'
);
select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'private'
      and tablename = 'mercadopago_oauth_tentativas'
      and indexname = 'mercadopago_oauth_pending_expiration_idx'
      and indexdef ilike '%where (consumed_at is null)%'
  ),
  'tentativas pendentes possuem índice parcial por expiração'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.mercadopago_oauth_tentativas'::regclass
      and conname = 'mercadopago_oauth_state_hash_unique'
      and contype = 'u'
  ),
  'hash do state é globalmente único'
);
select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'private'
      and table_name = 'mercadopago_oauth_tentativas'
      and column_name = 'state'
  ),
  'state bruto não possui coluna'
);
select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'private'
      and table_name = 'mercadopago_oauth_tentativas'
      and column_name = 'code_verifier'
  ),
  'code_verifier bruto não possui coluna'
);

insert into public.usuarios (
  id, nome, perfil_ativo, is_passageiro, is_motorista
)
values
  (
    '10000000-0000-4000-8000-000000000004'::uuid,
    'Motorista Teste Pix 04 A', 'motorista', false, true
  ),
  (
    '10000000-0000-4000-8000-000000000005'::uuid,
    'Motorista Teste Pix 04 B', 'motorista', false, true
  );

insert into public.motoristas (id)
values
  ('10000000-0000-4000-8000-000000000004'::uuid),
  ('10000000-0000-4000-8000-000000000005'::uuid);

set local role service_role;

select ok(
  public.pix_oauth_state_create(
    '10000000-0000-4000-8000-000000000004'::uuid,
    repeat('a', 64),
    'aes-gcm-pkce-envelope-test-01',
    1::smallint,
    now() + interval '10 minutes'
  ) is not null,
  'service_role cria tentativa válida'
);
select is(
  (select count(*)
   from public.pix_oauth_state_consume(
     '10000000-0000-4000-8000-000000000005'::uuid,
     repeat('a', 64)
   )),
  0::bigint,
  'outro motorista não consome a tentativa'
);
select is(
  (select encrypted_code_verifier || '|' || envelope_version::text
   from public.pix_oauth_state_consume(
     '10000000-0000-4000-8000-000000000004'::uuid,
     repeat('a', 64)
   )),
  'aes-gcm-pkce-envelope-test-01|1',
  'motorista correto consome e recebe o envelope uma única vez'
);
select is(
  (select count(*)
   from public.pix_oauth_state_consume(
     '10000000-0000-4000-8000-000000000004'::uuid,
     repeat('a', 64)
   )),
  0::bigint,
  'replay do state já consumido é rejeitado'
);
select ok(
  (select consumed_at is not null
   from private.mercadopago_oauth_tentativas
   where state_hash = repeat('a', 64)),
  'consumo atômico registra consumed_at'
);
select throws_ok(
  $$select public.pix_oauth_state_create(
      '10000000-0000-4000-8000-000000000004'::uuid,
      repeat('a', 64), 'outro-envelope', 1::smallint,
      now() + interval '5 minutes'
    )$$,
  '23505', null,
  'state hash duplicado é rejeitado'
);
select throws_ok(
  $$select public.pix_oauth_state_create(
      '10000000-0000-4000-8000-000000000004'::uuid,
      'state-em-texto-bruto', 'envelope', 1::smallint,
      now() + interval '5 minutes'
    )$$,
  '23514', null,
  'hash do state fora do formato SHA-256 é rejeitado'
);
select throws_ok(
  $$select public.pix_oauth_state_create(
      '10000000-0000-4000-8000-000000000004'::uuid,
      repeat('b', 64), 'envelope', 0::smallint,
      now() + interval '5 minutes'
    )$$,
  '23514', null,
  'versão de cifra inválida é rejeitada'
);
select throws_ok(
  $$select public.pix_oauth_state_create(
      '10000000-0000-4000-8000-000000000004'::uuid,
      repeat('c', 64), 'envelope', 1::smallint,
      now() + interval '10 minutes 1 second'
    )$$,
  '23514', null,
  'janela acima de dez minutos é rejeitada'
);

insert into private.mercadopago_oauth_tentativas (
  motorista_id,
  state_hash,
  code_verifier_encrypted,
  encryption_version,
  expires_at,
  created_at
)
values (
  '10000000-0000-4000-8000-000000000004'::uuid,
  repeat('d', 64),
  'aes-gcm-pkce-envelope-expired',
  1::smallint,
  now() - interval '1 minute',
  now() - interval '10 minutes'
);

select is(
  (select count(*)
   from public.pix_oauth_state_consume(
     '10000000-0000-4000-8000-000000000004'::uuid,
     repeat('d', 64)
   )),
  0::bigint,
  'tentativa vencida não é consumida'
);
select ok(
  (select consumed_at is null
   from private.mercadopago_oauth_tentativas
   where state_hash = repeat('d', 64)),
  'tentativa vencida preserva evidência sem marcar consumo'
);

reset role;

select * from finish();

rollback;
