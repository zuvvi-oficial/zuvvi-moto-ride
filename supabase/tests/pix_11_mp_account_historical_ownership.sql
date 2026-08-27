begin;

select plan(37);

select has_table(
  'private',
  'mercadopago_conta_propriedade',
  'tabela privada de propriedade histórica existe'
);
select has_column(
  'private',
  'mercadopago_conta_propriedade',
  'mercadopago_user_id',
  'propriedade possui mercadopago_user_id'
);
select col_is_pk(
  'private',
  'mercadopago_conta_propriedade',
  'mercadopago_user_id',
  'mercadopago_user_id é chave primária permanente'
);
select has_column(
  'private',
  'mercadopago_conta_propriedade',
  'motorista_id',
  'propriedade possui motorista_id'
);
select ok(
  not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'private.mercadopago_conta_propriedade'::regclass
      and c.contype = 'f'
  ),
  'tabela histórica não cria FK que altere deleção do core'
);
select has_column(
  'private',
  'mercadopago_conta_propriedade',
  'claimed_at',
  'propriedade registra claimed_at'
);
select has_column(
  'private',
  'mercadopago_conta_propriedade',
  'last_seen_at',
  'propriedade registra last_seen_at'
);
select ok(
  (select relrowsecurity and relforcerowsecurity
   from pg_class
   where oid = 'private.mercadopago_conta_propriedade'::regclass),
  'RLS da propriedade histórica está habilitada e forçada'
);
select ok(
  not has_schema_privilege('anon', 'private', 'USAGE'),
  'anon não usa schema private'
);
select ok(
  not has_schema_privilege('authenticated', 'private', 'USAGE'),
  'authenticated não usa schema private'
);
select ok(
  not has_table_privilege('anon', 'private.mercadopago_conta_propriedade', 'SELECT'),
  'anon não lê propriedade histórica'
);
select ok(
  not has_table_privilege('authenticated', 'private.mercadopago_conta_propriedade', 'SELECT'),
  'authenticated não lê propriedade histórica'
);
select ok(
  not has_table_privilege('service_role', 'private.mercadopago_conta_propriedade', 'SELECT'),
  'service_role não possui leitura direta da tabela histórica'
);
select ok(
  not has_table_privilege('service_role', 'private.mercadopago_conta_propriedade', 'INSERT'),
  'service_role não possui inserção direta na tabela histórica'
);
select ok(
  not has_table_privilege('service_role', 'private.mercadopago_conta_propriedade', 'UPDATE'),
  'service_role não possui atualização direta da tabela histórica'
);
select ok(
  not has_table_privilege('service_role', 'private.mercadopago_conta_propriedade', 'DELETE'),
  'service_role não pode apagar propriedade histórica diretamente'
);

select has_function(
  'public',
  'pix_oauth_account_owner_claim',
  array['uuid', 'text'],
  'RPC de reivindicação histórica existe'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.pix_oauth_account_owner_claim(uuid,text)',
    'EXECUTE'
  ),
  'anon não executa reivindicação'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.pix_oauth_account_owner_claim(uuid,text)',
    'EXECUTE'
  ),
  'authenticated não executa reivindicação'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.pix_oauth_account_owner_claim(uuid,text)',
    'EXECUTE'
  ),
  'service_role executa reivindicação'
);
select ok(
  (select p.prosecdef
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'pix_oauth_account_owner_claim'
     and pg_get_function_identity_arguments(p.oid) = '_motorista_id uuid, _mercadopago_user_id text'),
  'reivindicação é SECURITY DEFINER para impedir escrita direta na tabela'
);
select ok(
  (select p.proconfig @> array['search_path=pg_catalog, public, private']
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'pix_oauth_account_owner_claim'
     and pg_get_function_identity_arguments(p.oid) = '_motorista_id uuid, _mercadopago_user_id text'),
  'reivindicação possui search_path fixo'
);

select ok(
  exists (
    select 1
    from private.mercadopago_conta_propriedade
    where mercadopago_user_id = 'mp-preexisting-active'
      and motorista_id = '11000000-0000-4000-8000-000000000001'::uuid
  ),
  'backfill incorpora credencial ativa preexistente'
);
select ok(
  not exists (
    select 1
    from private.mercadopago_conta_propriedade
    where mercadopago_user_id = 'mp-preexisting-revoked'
  ),
  'backfill não transforma credencial revogada preexistente em propriedade permanente'
);

insert into public.usuarios (
  id,
  nome,
  perfil_ativo,
  is_passageiro,
  is_motorista
)
values (
  '11000000-0000-4000-8000-000000000003'::uuid,
  'Motorista PIX 11 C',
  'motorista',
  false,
  true
);

insert into public.motoristas (id)
values ('11000000-0000-4000-8000-000000000003'::uuid);

set local role service_role;

select is(
  public.pix_oauth_account_owner_claim(
    '11000000-0000-4000-8000-000000000001'::uuid,
    'mp-preexisting-active'
  ),
  'owned_by_same_motorista',
  'mesmo motorista pode reconhecer sua conta já apropriada'
);
select is(
  public.pix_oauth_account_owner_claim(
    '11000000-0000-4000-8000-000000000003'::uuid,
    'mp-preexisting-active'
  ),
  'owned_by_other_motorista',
  'outro motorista não pode reivindicar conta histórica de A'
);
select is(
  public.pix_oauth_account_owner_claim(
    '11000000-0000-4000-8000-000000000003'::uuid,
    'mp-new-owner-c'
  ),
  'claimed',
  'motorista C pode reivindicar uma conta MP nova'
);
select is(
  public.pix_oauth_account_owner_claim(
    '11000000-0000-4000-8000-000000000003'::uuid,
    'mp-new-owner-c'
  ),
  'owned_by_same_motorista',
  'repetição da reivindicação pelo mesmo motorista é idempotente'
);

select throws_ok(
  $$select public.pix_oauth_credentials_upsert(
      '11000000-0000-4000-8000-000000000003'::uuid,
      'mp-preexisting-active',
      'aes-access-c-invalid',
      'aes-refresh-c-invalid',
      1::smallint,
      now() + interval '1 hour',
      'offline_access read write',
      'Bearer'
    )$$,
  '23505',
  'PIX_MP_ACCOUNT_OWNED_BY_OTHER_MOTORISTA',
  'upsert OAuth bloqueia ativação de conta historicamente pertencente a outro motorista'
);
select lives_ok(
  $$select public.pix_oauth_credentials_upsert(
      '11000000-0000-4000-8000-000000000003'::uuid,
      'mp-new-owner-c',
      'aes-access-c-valid',
      'aes-refresh-c-valid',
      1::smallint,
      now() + interval '1 hour',
      'offline_access read write',
      'Bearer'
    )$$,
  'upsert OAuth permite conta pertencente ao próprio motorista'
);
select ok(
  public.pix_oauth_credentials_revoke(
    '11000000-0000-4000-8000-000000000003'::uuid
  ),
  'credencial de C pode ser revogada normalmente'
);
select is(
  public.pix_oauth_account_owner_claim(
    '11000000-0000-4000-8000-000000000001'::uuid,
    'mp-new-owner-c'
  ),
  'owned_by_other_motorista',
  'revogação não libera propriedade histórica para outro motorista'
);

reset role;

select is(
  (select motorista_id
   from private.mercadopago_conta_propriedade
   where mercadopago_user_id = 'mp-new-owner-c'),
  '11000000-0000-4000-8000-000000000003'::uuid,
  'proprietário histórico de MP C continua sendo o motorista C'
);
select ok(
  exists (
    select 1
    from private.mercadopago_conta_propriedade
    where mercadopago_user_id = 'mp-new-owner-c'
  ),
  'linha histórica permanece após revogação'
);
select throws_ok(
  $$select public.pix_oauth_account_owner_claim(
      '11000000-0000-4000-8000-000000000099'::uuid,
      'mp-inexistente'
    )$$,
  'P0002',
  'PIX_MP_OWNER_MOTORISTA_NAO_ENCONTRADO',
  'motorista inexistente não pode criar propriedade histórica'
);
select throws_ok(
  $$select public.pix_oauth_account_owner_claim(
      '11000000-0000-4000-8000-000000000003'::uuid,
      '   '
    )$$,
  '22023',
  'PIX_MP_OWNER_USER_ID_INVALIDO',
  'mercadopago_user_id vazio é rejeitado'
);
select ok(
  (select count(*) = count(distinct mercadopago_user_id)
   from private.mercadopago_conta_propriedade),
  'cada mercadopago_user_id possui uma única propriedade histórica'
);

select * from finish();

rollback;
