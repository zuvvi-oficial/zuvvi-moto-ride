begin;

select plan(33);

select has_schema('private', 'schema private existe');
select has_table(
  'private',
  'motorista_mercadopago_credenciais',
  'tabela privada de credenciais existe'
);
select has_column(
  'private',
  'motorista_mercadopago_credenciais',
  'motorista_id',
  'credenciais possuem motorista_id'
);
select col_is_pk(
  'private',
  'motorista_mercadopago_credenciais',
  'motorista_id',
  'motorista_id é chave primária'
);
select col_is_fk(
  'private',
  'motorista_mercadopago_credenciais',
  'motorista_id',
  'motorista_id é chave estrangeira'
);

select ok(
  (select relrowsecurity and relforcerowsecurity
   from pg_class
   where oid = 'private.motorista_mercadopago_credenciais'::regclass),
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
    'anon',
    'private.motorista_mercadopago_credenciais',
    'SELECT'
  ),
  'anon não lê credenciais'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'private.motorista_mercadopago_credenciais',
    'SELECT'
  ),
  'authenticated não lê credenciais'
);
select ok(
  has_table_privilege(
    'service_role',
    'private.motorista_mercadopago_credenciais',
    'SELECT,INSERT,UPDATE,DELETE'
  ),
  'service_role possui apenas o acesso operacional necessário'
);

select has_function(
  'public',
  'pix_oauth_credentials_upsert',
  array['uuid', 'text', 'text', 'text', 'smallint', 'timestamp with time zone', 'text', 'text'],
  'função de gravação existe'
);
select has_function(
  'public',
  'pix_oauth_credentials_get',
  array['uuid'],
  'função de leitura existe'
);
select has_function(
  'public',
  'pix_oauth_credentials_revoke',
  array['uuid'],
  'função de revogação existe'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.pix_oauth_credentials_upsert(uuid,text,text,text,smallint,timestamp with time zone,text,text)',
    'EXECUTE'
  ),
  'anon não executa gravação'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.pix_oauth_credentials_upsert(uuid,text,text,text,smallint,timestamp with time zone,text,text)',
    'EXECUTE'
  ),
  'authenticated não executa gravação'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.pix_oauth_credentials_upsert(uuid,text,text,text,smallint,timestamp with time zone,text,text)',
    'EXECUTE'
  ),
  'service_role executa gravação'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.pix_oauth_credentials_get(uuid)',
    'EXECUTE'
  ),
  'anon não executa leitura'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.pix_oauth_credentials_get(uuid)',
    'EXECUTE'
  ),
  'authenticated não executa leitura'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.pix_oauth_credentials_get(uuid)',
    'EXECUTE'
  ),
  'service_role executa leitura'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.pix_oauth_credentials_revoke(uuid)',
    'EXECUTE'
  ),
  'anon não executa revogação'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.pix_oauth_credentials_revoke(uuid)',
    'EXECUTE'
  ),
  'authenticated não executa revogação'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.pix_oauth_credentials_revoke(uuid)',
    'EXECUTE'
  ),
  'service_role executa revogação'
);

select ok(
  (select count(*) = 3
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in (
       'pix_oauth_credentials_upsert',
       'pix_oauth_credentials_get',
       'pix_oauth_credentials_revoke'
     )
     and not p.prosecdef),
  'todas as funções são SECURITY INVOKER'
);
select ok(
  (select count(*) = 3
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in (
       'pix_oauth_credentials_upsert',
       'pix_oauth_credentials_get',
       'pix_oauth_credentials_revoke'
     )
     and p.proconfig @> array['search_path=pg_catalog, public, private']),
  'todas as funções possuem search_path fixo'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'private'
      and tablename = 'motorista_mercadopago_credenciais'
      and indexname = 'motorista_mp_active_user_unique_idx'
      and indexdef ilike '%unique%where (connection_status = ''active''::text)%'
  ),
  'conta Mercado Pago ativa possui unicidade parcial'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'private'
      and tablename = 'motorista_mercadopago_credenciais'
      and indexname = 'motorista_mp_active_expires_at_idx'
  ),
  'expiração de credenciais ativas possui índice parcial'
);

insert into public.usuarios (
  id,
  nome,
  perfil_ativo,
  is_passageiro,
  is_motorista
)
values (
  '10000000-0000-4000-8000-000000000001'::uuid,
  'Motorista Teste Pix 01',
  'motorista',
  false,
  true
);

insert into public.motoristas (id)
values ('10000000-0000-4000-8000-000000000001'::uuid);

set local role service_role;

select public.pix_oauth_credentials_upsert(
  '10000000-0000-4000-8000-000000000001'::uuid,
  'mp-user-test-01',
  'aes-gcm-access-envelope-test',
  'aes-gcm-refresh-envelope-test',
  1,
  now() + interval '1 hour',
  'offline_access read write',
  'Bearer'
);

select is(
  (select connection_status
   from public.pix_oauth_credentials_get(
     '10000000-0000-4000-8000-000000000001'::uuid
   )),
  'active',
  'credencial criada como ativa pelo service_role'
);
select is(
  (select mercadopago_user_id
   from public.pix_oauth_credentials_get(
     '10000000-0000-4000-8000-000000000001'::uuid
   )),
  'mp-user-test-01',
  'leitura retorna somente a credencial do motorista solicitado'
);
select ok(
  public.pix_oauth_credentials_revoke(
    '10000000-0000-4000-8000-000000000001'::uuid
  ),
  'revogação altera uma credencial ativa'
);
select is(
  (select connection_status
   from public.pix_oauth_credentials_get(
     '10000000-0000-4000-8000-000000000001'::uuid
   )),
  'revoked',
  'credencial revogada possui estado correto'
);
select ok(
  (select access_token_encrypted is null
          and refresh_token_encrypted is null
          and revoked_at is not null
   from public.pix_oauth_credentials_get(
     '10000000-0000-4000-8000-000000000001'::uuid
   )),
  'revogação apaga envelopes e registra horário'
);

reset role;

select * from finish();

rollback;
