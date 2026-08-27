begin;

select no_plan();

select has_table(
  'private',
  'motorista_mercadopago_autorizacoes_pendentes',
  'tabela privada de autorização OAuth pendente existe'
);
select has_column(
  'private',
  'motorista_mercadopago_autorizacoes_pendentes',
  'motorista_id',
  'pendência possui motorista_id'
);
select col_is_pk(
  'private',
  'motorista_mercadopago_autorizacoes_pendentes',
  'motorista_id',
  'há uma pendência por motorista'
);
select has_column(
  'private',
  'motorista_mercadopago_autorizacoes_pendentes',
  'mercadopago_user_id',
  'pendência possui mercadopago_user_id'
);
select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'private'
      and tablename = 'motorista_mercadopago_autorizacoes_pendentes'
      and indexdef ilike '%unique%mercadopago_user_id%'
  ),
  'uma mesma conta Mercado Pago não fica pendente para dois motoristas'
);
select ok(
  (select relrowsecurity and relforcerowsecurity
   from pg_class
   where oid = 'private.motorista_mercadopago_autorizacoes_pendentes'::regclass),
  'RLS da pendência está habilitada e forçada'
);
select ok(
  not has_table_privilege('anon', 'private.motorista_mercadopago_autorizacoes_pendentes', 'SELECT'),
  'anon não lê pendências'
);
select ok(
  not has_table_privilege('authenticated', 'private.motorista_mercadopago_autorizacoes_pendentes', 'SELECT'),
  'authenticated não lê pendências'
);
select ok(
  not has_table_privilege('service_role', 'private.motorista_mercadopago_autorizacoes_pendentes', 'SELECT'),
  'service_role não lê a tabela diretamente'
);
select ok(
  not has_table_privilege('service_role', 'private.motorista_mercadopago_autorizacoes_pendentes', 'INSERT'),
  'service_role não insere diretamente'
);
select ok(
  not has_table_privilege('service_role', 'private.motorista_mercadopago_autorizacoes_pendentes', 'UPDATE'),
  'service_role não atualiza diretamente'
);
select ok(
  not has_table_privilege('service_role', 'private.motorista_mercadopago_autorizacoes_pendentes', 'DELETE'),
  'service_role não apaga diretamente'
);
select has_function(
  'public',
  'pix_oauth_pending_authorization_upsert',
  array['uuid', 'text', 'text', 'text', 'smallint', 'timestamp with time zone', 'text', 'text'],
  'RPC de autorização pendente existe'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.pix_oauth_pending_authorization_upsert(uuid,text,text,text,smallint,timestamp with time zone,text,text)',
    'EXECUTE'
  ),
  'anon não executa RPC pendente'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.pix_oauth_pending_authorization_upsert(uuid,text,text,text,smallint,timestamp with time zone,text,text)',
    'EXECUTE'
  ),
  'authenticated não executa RPC pendente'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.pix_oauth_pending_authorization_upsert(uuid,text,text,text,smallint,timestamp with time zone,text,text)',
    'EXECUTE'
  ),
  'service_role executa RPC pendente'
);
select ok(
  (select p.prosecdef
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'pix_oauth_pending_authorization_upsert'),
  'RPC pendente é SECURITY DEFINER'
);
select ok(
  (select p.proconfig @> array['search_path=pg_catalog, public, private']
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'pix_oauth_pending_authorization_upsert'),
  'RPC pendente possui search_path fixo'
);

insert into public.usuarios (
  id, nome, perfil_ativo, is_passageiro, is_motorista
) values
  ('12000000-0000-4000-8000-000000000001'::uuid, 'Motorista PIX 12 A', 'motorista', false, true),
  ('12000000-0000-4000-8000-000000000002'::uuid, 'Motorista PIX 12 B', 'motorista', false, true),
  ('12000000-0000-4000-8000-000000000003'::uuid, 'Motorista PIX 12 C', 'motorista', false, true);

insert into public.motoristas (id) values
  ('12000000-0000-4000-8000-000000000001'::uuid),
  ('12000000-0000-4000-8000-000000000002'::uuid),
  ('12000000-0000-4000-8000-000000000003'::uuid);

set local role service_role;

select is(
  public.pix_oauth_account_owner_claim(
    '12000000-0000-4000-8000-000000000001'::uuid,
    'mp-owned-a'
  ),
  'claimed',
  'prepara conta histórica do motorista A'
);

select lives_ok(
  $$select public.pix_oauth_pending_authorization_upsert(
      '12000000-0000-4000-8000-000000000001'::uuid,
      'mp-owned-a',
      'v1.encrypted-access-a',
      'v1.encrypted-refresh-a',
      1::smallint,
      now() + interval '6 months',
      'offline_access read write',
      'Bearer'
    )$$,
  'mesmo proprietário histórico pode criar autorização pendente'
);

select throws_ok(
  $$select public.pix_oauth_pending_authorization_upsert(
      '12000000-0000-4000-8000-000000000002'::uuid,
      'mp-owned-a',
      'v1.encrypted-access-b-invalid',
      'v1.encrypted-refresh-b-invalid',
      1::smallint,
      now() + interval '6 months',
      'offline_access read write',
      'Bearer'
    )$$,
  '23505',
  'PIX_MP_ACCOUNT_OWNED_BY_OTHER_MOTORISTA',
  'outro motorista não cria pendência para conta historicamente de A'
);

select lives_ok(
  $$select public.pix_oauth_pending_authorization_upsert(
      '12000000-0000-4000-8000-000000000002'::uuid,
      'mp-new-b',
      'v1.encrypted-access-b',
      'v1.encrypted-refresh-b',
      1::smallint,
      now() + interval '6 months',
      'offline_access read write',
      'Bearer'
    )$$,
  'conta sem proprietário pode ficar pendente para B'
);

select throws_ok(
  $$select public.pix_oauth_pending_authorization_upsert(
      '12000000-0000-4000-8000-000000000003'::uuid,
      'mp-new-b',
      'v1.encrypted-access-c-invalid',
      'v1.encrypted-refresh-c-invalid',
      1::smallint,
      now() + interval '6 months',
      'offline_access read write',
      'Bearer'
    )$$,
  '23505',
  'PIX_MP_ACCOUNT_PENDING_BY_OTHER_MOTORISTA',
  'mesma conta não fica pendente simultaneamente para C'
);

select lives_ok(
  $$select public.pix_oauth_pending_authorization_upsert(
      '12000000-0000-4000-8000-000000000002'::uuid,
      'mp-new-b',
      'v1.encrypted-access-b-2',
      'v1.encrypted-refresh-b-2',
      1::smallint,
      now() + interval '6 months',
      'offline_access read write',
      'Bearer'
    )$$,
  'mesmo motorista pode renovar a própria pendência'
);

select throws_ok(
  $$select public.pix_oauth_pending_authorization_upsert(
      '12000000-0000-4000-8000-000000000099'::uuid,
      'mp-invalid-driver',
      'v1.access',
      'v1.refresh',
      1::smallint,
      now() + interval '6 months',
      null,
      null
    )$$,
  'P0002',
  'PIX_MP_PENDING_MOTORISTA_NAO_ENCONTRADO',
  'motorista inexistente é rejeitado'
);

select throws_ok(
  $$select public.pix_oauth_pending_authorization_upsert(
      '12000000-0000-4000-8000-000000000002'::uuid,
      '   ',
      'v1.access',
      'v1.refresh',
      1::smallint,
      now() + interval '6 months',
      null,
      null
    )$$,
  '22023',
  'PIX_MP_PENDING_USER_ID_INVALIDO',
  'mercadopago_user_id vazio é rejeitado'
);

select throws_ok(
  $$select public.pix_oauth_pending_authorization_upsert(
      '12000000-0000-4000-8000-000000000002'::uuid,
      'mp-expired-token',
      'v1.access',
      'v1.refresh',
      1::smallint,
      now() - interval '1 second',
      null,
      null
    )$$,
  '22023',
  'PIX_MP_PENDING_PAYLOAD_INVALIDO',
  'token já expirado é rejeitado'
);

reset role;

select is(
  (select motorista_id
   from private.motorista_mercadopago_autorizacoes_pendentes
   where mercadopago_user_id = 'mp-owned-a'),
  '12000000-0000-4000-8000-000000000001'::uuid,
  'pendência da conta histórica pertence ao mesmo motorista A'
);
select is(
  (select motorista_id
   from private.motorista_mercadopago_autorizacoes_pendentes
   where mercadopago_user_id = 'mp-new-b'),
  '12000000-0000-4000-8000-000000000002'::uuid,
  'conta nova está pendente somente para B'
);
select is(
  (select access_token_encrypted
   from private.motorista_mercadopago_autorizacoes_pendentes
   where mercadopago_user_id = 'mp-new-b'),
  'v1.encrypted-access-b-2',
  'pendência guarda somente o envelope cifrado recebido do servidor'
);
select ok(
  (select confirmation_expires_at >= created_at + interval '9 minutes 55 seconds'
          and confirmation_expires_at <= created_at + interval '10 minutes 5 seconds'
   from private.motorista_mercadopago_autorizacoes_pendentes
   where mercadopago_user_id = 'mp-new-b'),
  'prazo de confirmação é de aproximadamente 10 minutos'
);
select ok(
  not exists (
    select 1
    from private.mercadopago_conta_propriedade
    where mercadopago_user_id = 'mp-new-b'
  ),
  'autorização pendente de conta nova não cria propriedade histórica'
);
select is(
  (select count(*) from private.motorista_mercadopago_credenciais),
  0::bigint,
  'autorização pendente não cria credencial ativa ou revogada'
);
select ok(
  not exists (
    select 1
    from public.motoristas
    where id in (
      '12000000-0000-4000-8000-000000000001'::uuid,
      '12000000-0000-4000-8000-000000000002'::uuid,
      '12000000-0000-4000-8000-000000000003'::uuid
    )
      and conta_mercado_pago_id is not null
  ),
  'autorização pendente não atualiza a projeção pública do motorista'
);

update private.motorista_mercadopago_autorizacoes_pendentes
set confirmation_expires_at = now() - interval '1 second'
where mercadopago_user_id = 'mp-new-b';

set local role service_role;

select lives_ok(
  $$select public.pix_oauth_pending_authorization_upsert(
      '12000000-0000-4000-8000-000000000003'::uuid,
      'mp-new-b',
      'v1.encrypted-access-c',
      'v1.encrypted-refresh-c',
      1::smallint,
      now() + interval '6 months',
      'offline_access read write',
      'Bearer'
    )$$,
  'pendência expirada é liberada e C pode iniciar nova autorização'
);

reset role;

select is(
  (select motorista_id
   from private.motorista_mercadopago_autorizacoes_pendentes
   where mercadopago_user_id = 'mp-new-b'),
  '12000000-0000-4000-8000-000000000003'::uuid,
  'após expiração existe somente a nova pendência de C'
);
select is(
  (select count(*)
   from private.motorista_mercadopago_autorizacoes_pendentes
   where mercadopago_user_id = 'mp-new-b'),
  1::bigint,
  'não há duplicidade da conta pendente após limpeza de expirada'
);
select ok(
  not exists (
    select 1
    from private.mercadopago_conta_propriedade
    where mercadopago_user_id = 'mp-new-b'
  ),
  'troca de pendência após expiração continua sem reivindicar propriedade histórica'
);

select * from finish();

rollback;
