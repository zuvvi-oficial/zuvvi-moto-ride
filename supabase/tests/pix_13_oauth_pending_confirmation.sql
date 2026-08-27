begin;

select no_plan();

select has_function(
  'public',
  'pix_oauth_pending_authorization_status',
  array['uuid'],
  'RPC de status da autorização pendente existe'
);
select has_function(
  'public',
  'pix_oauth_pending_authorization_confirm',
  array['uuid'],
  'RPC de confirmação explícita existe'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.pix_oauth_pending_authorization_status(uuid)',
    'EXECUTE'
  ),
  'anon não consulta pendência'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.pix_oauth_pending_authorization_status(uuid)',
    'EXECUTE'
  ),
  'authenticated não consulta pendência diretamente'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.pix_oauth_pending_authorization_status(uuid)',
    'EXECUTE'
  ),
  'service_role consulta pendência'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.pix_oauth_pending_authorization_confirm(uuid)',
    'EXECUTE'
  ),
  'anon não confirma pendência'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.pix_oauth_pending_authorization_confirm(uuid)',
    'EXECUTE'
  ),
  'authenticated não confirma pendência diretamente'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.pix_oauth_pending_authorization_confirm(uuid)',
    'EXECUTE'
  ),
  'service_role confirma pendência'
);
select ok(
  (select p.prosecdef
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'pix_oauth_pending_authorization_confirm'),
  'confirmação é SECURITY DEFINER'
);
select ok(
  (select p.proconfig @> array['search_path=pg_catalog, public, private']
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'pix_oauth_pending_authorization_confirm'),
  'confirmação possui search_path fixo'
);

insert into public.usuarios (
  id, nome, perfil_ativo, is_passageiro, is_motorista
) values
  ('13000000-0000-4000-8000-000000000001'::uuid, 'Motorista PIX 13 A', 'motorista', false, true),
  ('13000000-0000-4000-8000-000000000002'::uuid, 'Motorista PIX 13 B', 'motorista', false, true),
  ('13000000-0000-4000-8000-000000000003'::uuid, 'Motorista PIX 13 C', 'motorista', false, true),
  ('13000000-0000-4000-8000-000000000004'::uuid, 'Motorista PIX 13 D', 'motorista', false, true);

insert into public.motoristas (id) values
  ('13000000-0000-4000-8000-000000000001'::uuid),
  ('13000000-0000-4000-8000-000000000002'::uuid),
  ('13000000-0000-4000-8000-000000000003'::uuid),
  ('13000000-0000-4000-8000-000000000004'::uuid);

set local role service_role;

select lives_ok(
  $$select public.pix_oauth_pending_authorization_upsert(
      '13000000-0000-4000-8000-000000000001'::uuid,
      'mp-confirm-a',
      'v1.encrypted-access-a',
      'v1.encrypted-refresh-a',
      1::smallint,
      now() + interval '6 months',
      'offline_access read write',
      'Bearer'
    )$$,
  'A cria autorização pendente sem ativar a conta'
);

select ok(
  public.pix_oauth_pending_authorization_status(
    '13000000-0000-4000-8000-000000000001'::uuid
  ) > now(),
  'status informa pendência válida antes da confirmação'
);

reset role;

select ok(
  not exists (
    select 1
    from private.mercadopago_conta_propriedade
    where mercadopago_user_id = 'mp-confirm-a'
  ),
  'antes da confirmação não existe propriedade histórica nova'
);
select ok(
  not exists (
    select 1
    from private.motorista_mercadopago_credenciais
    where motorista_id = '13000000-0000-4000-8000-000000000001'::uuid
  ),
  'antes da confirmação não existe credencial ativa'
);
select is(
  (select conta_mercado_pago_id
   from public.motoristas
   where id = '13000000-0000-4000-8000-000000000001'::uuid),
  null::text,
  'antes da confirmação projeção pública continua vazia'
);

set local role service_role;

select is(
  public.pix_oauth_pending_authorization_confirm(
    '13000000-0000-4000-8000-000000000001'::uuid
  ),
  'connected',
  'clique explícito promove a pendência para conexão ativa'
);

reset role;

select ok(
  not exists (
    select 1
    from private.motorista_mercadopago_autorizacoes_pendentes
    where motorista_id = '13000000-0000-4000-8000-000000000001'::uuid
  ),
  'pendência é consumida após confirmação'
);
select is(
  (select motorista_id
   from private.mercadopago_conta_propriedade
   where mercadopago_user_id = 'mp-confirm-a'),
  '13000000-0000-4000-8000-000000000001'::uuid,
  'confirmação reivindica propriedade histórica para A'
);
select is(
  (select connection_status
   from private.motorista_mercadopago_credenciais
   where motorista_id = '13000000-0000-4000-8000-000000000001'::uuid),
  'active',
  'confirmação ativa a credencial privada'
);
select is(
  (select access_token_encrypted
   from private.motorista_mercadopago_credenciais
   where motorista_id = '13000000-0000-4000-8000-000000000001'::uuid),
  'v1.encrypted-access-a',
  'confirmação reaproveita apenas o envelope cifrado da pendência'
);
select is(
  (select conta_mercado_pago_id
   from public.motoristas
   where id = '13000000-0000-4000-8000-000000000001'::uuid),
  'mp-confirm-a',
  'confirmação atualiza a projeção pública somente depois do clique'
);

set local role service_role;

select is(
  public.pix_oauth_pending_authorization_confirm(
    '13000000-0000-4000-8000-000000000001'::uuid
  ),
  'already_connected',
  'repetição após sucesso é idempotente'
);

select lives_ok(
  $$select public.pix_oauth_pending_authorization_upsert(
      '13000000-0000-4000-8000-000000000002'::uuid,
      'mp-expired-b',
      'v1.encrypted-access-b',
      'v1.encrypted-refresh-b',
      1::smallint,
      now() + interval '6 months',
      null,
      null
    )$$,
  'B cria pendência que será simulada como expirada'
);

reset role;

update private.motorista_mercadopago_autorizacoes_pendentes
set created_at = now() - interval '20 minutes',
    confirmation_expires_at = now() - interval '10 minutes',
    updated_at = now() - interval '10 minutes'
where motorista_id = '13000000-0000-4000-8000-000000000002'::uuid;

set local role service_role;

select is(
  public.pix_oauth_pending_authorization_status(
    '13000000-0000-4000-8000-000000000002'::uuid
  ),
  null::timestamptz,
  'status não apresenta pendência expirada como utilizável'
);
select is(
  public.pix_oauth_pending_authorization_confirm(
    '13000000-0000-4000-8000-000000000002'::uuid
  ),
  'expired',
  'confirmação expirada é recusada e limpa'
);
select is(
  public.pix_oauth_pending_authorization_confirm(
    '13000000-0000-4000-8000-000000000003'::uuid
  ),
  'not_found',
  'motorista sem pendência não é conectado'
);

select is(
  public.pix_oauth_account_owner_claim(
    '13000000-0000-4000-8000-000000000001'::uuid,
    'mp-race-owned-a'
  ),
  'claimed',
  'prepara propriedade histórica concorrente de A'
);

reset role;

insert into private.motorista_mercadopago_autorizacoes_pendentes (
  motorista_id,
  mercadopago_user_id,
  access_token_encrypted,
  refresh_token_encrypted,
  encryption_version,
  token_expires_at,
  scope,
  token_type,
  confirmation_expires_at,
  created_at,
  updated_at
) values (
  '13000000-0000-4000-8000-000000000004'::uuid,
  'mp-race-owned-a',
  'v1.encrypted-access-d',
  'v1.encrypted-refresh-d',
  1,
  now() + interval '6 months',
  null,
  null,
  now() + interval '10 minutes',
  now(),
  now()
);

set local role service_role;

select is(
  public.pix_oauth_pending_authorization_confirm(
    '13000000-0000-4000-8000-000000000004'::uuid
  ),
  'ownership_conflict',
  'corrida de propriedade é bloqueada na confirmação'
);

reset role;

select ok(
  not exists (
    select 1
    from private.motorista_mercadopago_autorizacoes_pendentes
    where motorista_id in (
      '13000000-0000-4000-8000-000000000002'::uuid,
      '13000000-0000-4000-8000-000000000004'::uuid
    )
  ),
  'pendência expirada e conflito de propriedade são removidos'
);
select ok(
  not exists (
    select 1
    from private.motorista_mercadopago_credenciais
    where motorista_id in (
      '13000000-0000-4000-8000-000000000002'::uuid,
      '13000000-0000-4000-8000-000000000003'::uuid,
      '13000000-0000-4000-8000-000000000004'::uuid
    )
  ),
  'B, C e D continuam sem credencial ativa'
);
select ok(
  not exists (
    select 1
    from public.motoristas
    where id in (
      '13000000-0000-4000-8000-000000000002'::uuid,
      '13000000-0000-4000-8000-000000000003'::uuid,
      '13000000-0000-4000-8000-000000000004'::uuid
    )
      and conta_mercado_pago_id is not null
  ),
  'B, C e D não recebem projeção pública por falha ou ausência de confirmação'
);

select * from finish();

rollback;
