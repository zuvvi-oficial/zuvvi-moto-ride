begin;

select plan(24);

select has_function(
  'public',
  'pix_oauth_credentials_upsert',
  array['uuid', 'text', 'text', 'text', 'smallint', 'timestamp with time zone', 'text', 'text'],
  'função de conexão OAuth atômica existe'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.pix_oauth_credentials_upsert(uuid,text,text,text,smallint,timestamp with time zone,text,text)',
    'EXECUTE'
  ),
  'anon não executa conexão OAuth'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.pix_oauth_credentials_upsert(uuid,text,text,text,smallint,timestamp with time zone,text,text)',
    'EXECUTE'
  ),
  'authenticated não executa conexão OAuth'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.pix_oauth_credentials_upsert(uuid,text,text,text,smallint,timestamp with time zone,text,text)',
    'EXECUTE'
  ),
  'service_role executa conexão OAuth'
);
select ok(
  not (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'pix_oauth_credentials_upsert'
  ),
  'função permanece SECURITY INVOKER'
);
select ok(
  (
    select p.proconfig @> array['search_path=pg_catalog, public, private']
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'pix_oauth_credentials_upsert'
  ),
  'função mantém search_path fixo'
);
select ok(
  (
    select pg_get_functiondef(p.oid) ilike
      '%update public.motoristas%set conta_mercado_pago_id%'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'pix_oauth_credentials_upsert'
  ),
  'função atualiza a projeção pública na mesma chamada'
);

select lives_ok(
  $$insert into public.usuarios (
      id, nome, perfil_ativo, is_passageiro, is_motorista
    ) values
      ('80000000-0000-4000-8000-000000000001'::uuid, 'Motorista PIX-08 1', 'motorista', false, true),
      ('80000000-0000-4000-8000-000000000002'::uuid, 'Motorista PIX-08 2', 'motorista', false, true),
      ('80000000-0000-4000-8000-000000000003'::uuid, 'Motorista PIX-08 3', 'motorista', false, true)$$,
  'usuários isolados de teste são criados'
);
select lives_ok(
  $$insert into public.motoristas (id, conta_mercado_pago_id) values
      ('80000000-0000-4000-8000-000000000001'::uuid, null),
      ('80000000-0000-4000-8000-000000000002'::uuid, 'mp-legacy-8002'),
      ('80000000-0000-4000-8000-000000000003'::uuid, null)$$,
  'motoristas isolados são criados com projeções controladas'
);

set local role service_role;

select lives_ok(
  $$select public.pix_oauth_credentials_upsert(
      '80000000-0000-4000-8000-000000000001'::uuid,
      '  mp-user-8001  ',
      'access-envelope-8001-v1',
      'refresh-envelope-8001-v1',
      1::smallint,
      now() + interval '1 hour',
      'offline_access read write',
      'Bearer'
    )$$,
  'conexão inicial é concluída em uma chamada'
);
select is(
  (
    select conta_mercado_pago_id
    from public.motoristas
    where id = '80000000-0000-4000-8000-000000000001'::uuid
  ),
  'mp-user-8001',
  'projeção pública recebe o identificador normalizado'
);
select ok(
  (
    select mercadopago_user_id = 'mp-user-8001'
      and access_token_encrypted = 'access-envelope-8001-v1'
      and refresh_token_encrypted = 'refresh-envelope-8001-v1'
      and connection_status = 'active'
    from public.pix_oauth_credentials_get(
      '80000000-0000-4000-8000-000000000001'::uuid
    )
  ),
  'credencial privada corresponde à mesma conta pública'
);
select lives_ok(
  $$select public.pix_oauth_credentials_upsert(
      '80000000-0000-4000-8000-000000000001'::uuid,
      'mp-user-8001',
      'access-envelope-8001-v2',
      'refresh-envelope-8001-v2',
      1::smallint,
      now() + interval '2 hours',
      'offline_access read write',
      'Bearer'
    )$$,
  'renovação atualiza a conexão existente'
);
select ok(
  (
    select count(*) = 1
      and min(access_token_encrypted) = 'access-envelope-8001-v2'
      and min(refresh_token_encrypted) = 'refresh-envelope-8001-v2'
    from private.motorista_mercadopago_credenciais
    where motorista_id = '80000000-0000-4000-8000-000000000001'::uuid
  ),
  'renovação não duplica a linha e rotaciona os dois envelopes'
);

select throws_ok(
  $$select public.pix_oauth_credentials_upsert(
      '80000000-0000-4000-8000-000000000003'::uuid,
      'mp-legacy-8002',
      'access-envelope-8003',
      'refresh-envelope-8003',
      1::smallint,
      now() + interval '1 hour',
      null,
      null
    )$$,
  '23505',
  null,
  'unicidade pública rejeita conta já projetada em outro motorista'
);
select is(
  (
    select count(*)::integer
    from private.motorista_mercadopago_credenciais
    where motorista_id = '80000000-0000-4000-8000-000000000003'::uuid
  ),
  0,
  'falha pública reverte a credencial privada intermediária'
);
select is(
  (
    select conta_mercado_pago_id
    from public.motoristas
    where id = '80000000-0000-4000-8000-000000000003'::uuid
  ),
  null,
  'falha pública mantém a projeção do motorista solicitante vazia'
);

select throws_ok(
  $$select public.pix_oauth_credentials_upsert(
      '80000000-0000-4000-8000-000000000001'::uuid,
      'mp-user-changed-invalid',
      '',
      'refresh-envelope-invalid-change',
      1::smallint,
      now() + interval '1 hour',
      null,
      null
    )$$,
  '23514',
  null,
  'envelope inválido reprova a atualização'
);
select ok(
  (
    select conta_mercado_pago_id = 'mp-user-8001'
    from public.motoristas
    where id = '80000000-0000-4000-8000-000000000001'::uuid
  )
  and (
    select mercadopago_user_id = 'mp-user-8001'
      and access_token_encrypted = 'access-envelope-8001-v2'
    from public.pix_oauth_credentials_get(
      '80000000-0000-4000-8000-000000000001'::uuid
    )
  ),
  'falha privada preserva projeção e credencial anteriores'
);

select throws_ok(
  $$select public.pix_oauth_credentials_upsert(
      '80000000-0000-4000-8000-000000000002'::uuid,
      'mp-user-8001',
      'access-envelope-8002',
      'refresh-envelope-8002',
      1::smallint,
      now() + interval '1 hour',
      null,
      null
    )$$,
  '23505',
  null,
  'unicidade privada rejeita conta ativa de outro motorista'
);
select is(
  (
    select conta_mercado_pago_id
    from public.motoristas
    where id = '80000000-0000-4000-8000-000000000002'::uuid
  ),
  'mp-legacy-8002',
  'falha privada preserva a projeção pública legada'
);

select throws_ok(
  $$select public.pix_oauth_credentials_upsert(
      '80000000-0000-4000-8000-000000000099'::uuid,
      'mp-user-unknown',
      'access-envelope-unknown',
      'refresh-envelope-unknown',
      1::smallint,
      now() + interval '1 hour',
      null,
      null
    )$$,
  '23503',
  null,
  'motorista inexistente é rejeitado pela chave estrangeira'
);
select is(
  (
    select count(*)::integer
    from private.motorista_mercadopago_credenciais
    where motorista_id = '80000000-0000-4000-8000-000000000099'::uuid
  ),
  0,
  'motorista inexistente não deixa credencial órfã'
);
select is(
  (
    select count(*)::integer
    from public.motoristas m
    join private.motorista_mercadopago_credenciais c on c.motorista_id = m.id
    where c.connection_status = 'active'
      and m.conta_mercado_pago_id is distinct from c.mercadopago_user_id
  ),
  0,
  'todas as credenciais ativas de teste permanecem coerentes com a projeção pública'
);

reset role;

select * from finish();

rollback;
