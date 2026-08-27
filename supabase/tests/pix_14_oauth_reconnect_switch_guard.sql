begin;

select no_plan();

select has_function(
  'public',
  'pix_oauth_pending_authorization_summary',
  array['uuid'],
  'RPC de resumo seguro da pendência existe'
);
select has_function(
  'public',
  'pix_oauth_pending_authorization_cancel',
  array['uuid'],
  'RPC de cancelamento da pendência existe'
);
select has_function(
  'public',
  'pix_oauth_pending_authorization_confirm',
  array['uuid', 'text'],
  'RPC de confirmação com trava da conta integradora existe'
);
select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'pix_oauth_pending_authorization_confirm'
      and pg_get_function_identity_arguments(p.oid) = '_motorista_id uuid'
  ),
  'RPC antiga de confirmação sem trava da plataforma não existe'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.pix_oauth_pending_authorization_summary(uuid)',
    'EXECUTE'
  ),
  'anon não consulta resumo de pendência'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.pix_oauth_pending_authorization_summary(uuid)',
    'EXECUTE'
  ),
  'authenticated não consulta resumo diretamente'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.pix_oauth_pending_authorization_cancel(uuid)',
    'EXECUTE'
  ),
  'authenticated não cancela pendência diretamente'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.pix_oauth_pending_authorization_confirm(uuid,text)',
    'EXECUTE'
  ),
  'authenticated não confirma pendência diretamente'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.pix_oauth_pending_authorization_summary(uuid)',
    'EXECUTE'
  ),
  'service_role consulta resumo de pendência'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.pix_oauth_pending_authorization_cancel(uuid)',
    'EXECUTE'
  ),
  'service_role cancela pendência'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.pix_oauth_pending_authorization_confirm(uuid,text)',
    'EXECUTE'
  ),
  'service_role confirma pendência com trava da plataforma'
);

insert into public.usuarios (
  id, nome, perfil_ativo, is_passageiro, is_motorista
) values
  ('14000000-0000-4000-8000-000000000001'::uuid, 'Motorista PIX 14 A', 'motorista', false, true),
  ('14000000-0000-4000-8000-000000000002'::uuid, 'Motorista PIX 14 B', 'motorista', false, true),
  ('14000000-0000-4000-8000-000000000003'::uuid, 'Motorista PIX 14 C', 'motorista', false, true),
  ('14000000-0000-4000-8000-000000000004'::uuid, 'Motorista PIX 14 D', 'motorista', false, true);

insert into public.motoristas (id) values
  ('14000000-0000-4000-8000-000000000001'::uuid),
  ('14000000-0000-4000-8000-000000000002'::uuid),
  ('14000000-0000-4000-8000-000000000003'::uuid),
  ('14000000-0000-4000-8000-000000000004'::uuid);

set local role service_role;

select is(
  public.pix_oauth_account_owner_claim(
    '14000000-0000-4000-8000-000000000001'::uuid,
    '1001001001'
  ),
  'claimed',
  'prepara propriedade histórica da conta de A'
);

select lives_ok(
  $$select public.pix_oauth_pending_authorization_upsert(
      '14000000-0000-4000-8000-000000000001'::uuid,
      '1001001001',
      'v1.encrypted-access-a',
      'v1.encrypted-refresh-a',
      1::smallint,
      now() + interval '6 months',
      'offline_access read write',
      'Bearer'
    )$$,
  'A cria pendência para a mesma conta histórica'
);

select is(
  public.pix_oauth_pending_authorization_summary(
    '14000000-0000-4000-8000-000000000001'::uuid
  )->>'account_hint',
  '1001',
  'resumo expõe somente os quatro últimos caracteres da conta autorizada'
);
select is(
  public.pix_oauth_pending_authorization_summary(
    '14000000-0000-4000-8000-000000000001'::uuid
  )->>'reconnection',
  'true',
  'mesma conta histórica é marcada como reconexão'
);

reset role;

select ok(
  not exists (
    select 1
    from private.motorista_mercadopago_credenciais
    where motorista_id = '14000000-0000-4000-8000-000000000001'::uuid
  ),
  'reconexão continua sem credencial ativa antes do clique'
);
select is(
  (select conta_mercado_pago_id from public.motoristas
   where id = '14000000-0000-4000-8000-000000000001'::uuid),
  null::text,
  'reconexão não atualiza projeção pública silenciosamente'
);

set local role service_role;

select is(
  public.pix_oauth_pending_authorization_cancel(
    '14000000-0000-4000-8000-000000000001'::uuid
  ),
  true,
  'trocar de conta cancela a autorização pendente'
);
select is(
  public.pix_oauth_pending_authorization_cancel(
    '14000000-0000-4000-8000-000000000001'::uuid
  ),
  false,
  'cancelamento repetido é idempotente'
);

reset role;

select ok(
  not exists (
    select 1
    from private.motorista_mercadopago_autorizacoes_pendentes
    where motorista_id = '14000000-0000-4000-8000-000000000001'::uuid
  ),
  'cancelamento remove a pendência'
);
select ok(
  not exists (
    select 1
    from private.motorista_mercadopago_credenciais
    where motorista_id = '14000000-0000-4000-8000-000000000001'::uuid
  ),
  'cancelamento não ativa credencial'
);
select is(
  (select motorista_id from private.mercadopago_conta_propriedade
   where mercadopago_user_id = '1001001001'),
  '14000000-0000-4000-8000-000000000001'::uuid,
  'cancelamento preserva a propriedade histórica existente'
);

set local role service_role;

select lives_ok(
  $$select public.pix_oauth_pending_authorization_upsert(
      '14000000-0000-4000-8000-000000000002'::uuid,
      '5555555555',
      'v1.encrypted-access-platform',
      'v1.encrypted-refresh-platform',
      1::smallint,
      now() + interval '6 months',
      null,
      null
    )$$,
  'B recebe autorização pendente da conta que será identificada como integradora'
);
select is(
  public.pix_oauth_pending_authorization_summary(
    '14000000-0000-4000-8000-000000000002'::uuid
  )->>'reconnection',
  'false',
  'conta sem propriedade histórica não é marcada como reconexão'
);
select is(
  public.pix_oauth_pending_authorization_confirm(
    '14000000-0000-4000-8000-000000000002'::uuid,
    '5555555555'
  ),
  'platform_account',
  'conta integradora é bloqueada antes da ativação'
);

reset role;

select ok(
  not exists (
    select 1
    from private.motorista_mercadopago_autorizacoes_pendentes
    where motorista_id = '14000000-0000-4000-8000-000000000002'::uuid
  ),
  'pendência da conta integradora é removida após o bloqueio'
);
select ok(
  not exists (
    select 1
    from private.motorista_mercadopago_credenciais
    where motorista_id = '14000000-0000-4000-8000-000000000002'::uuid
  ),
  'conta integradora não cria credencial de motorista'
);
select ok(
  not exists (
    select 1
    from private.mercadopago_conta_propriedade
    where mercadopago_user_id = '5555555555'
  ),
  'conta integradora não ganha propriedade histórica de motorista'
);
select is(
  (select conta_mercado_pago_id from public.motoristas
   where id = '14000000-0000-4000-8000-000000000002'::uuid),
  null::text,
  'conta integradora não atualiza projeção pública'
);

set local role service_role;

select lives_ok(
  $$select public.pix_oauth_pending_authorization_upsert(
      '14000000-0000-4000-8000-000000000003'::uuid,
      '7777777777',
      'v1.encrypted-access-seller',
      'v1.encrypted-refresh-seller',
      1::smallint,
      now() + interval '6 months',
      null,
      null
    )$$,
  'C recebe autorização pendente de vendedor diferente da plataforma'
);
select is(
  public.pix_oauth_pending_authorization_confirm(
    '14000000-0000-4000-8000-000000000003'::uuid,
    '5555555555'
  ),
  'connected',
  'vendedor diferente da plataforma continua confirmável'
);
select is(
  public.pix_oauth_pending_authorization_confirm(
    '14000000-0000-4000-8000-000000000003'::uuid,
    '5555555555'
  ),
  'already_connected',
  'repetição da confirmação do vendedor é idempotente'
);

reset role;

select is(
  (select connection_status from private.motorista_mercadopago_credenciais
   where motorista_id = '14000000-0000-4000-8000-000000000003'::uuid),
  'active',
  'vendedor diferente da plataforma recebe credencial ativa'
);
select is(
  (select conta_mercado_pago_id from public.motoristas
   where id = '14000000-0000-4000-8000-000000000003'::uuid),
  '7777777777',
  'vendedor diferente da plataforma atualiza projeção pública'
);

set local role service_role;

select lives_ok(
  $$select public.pix_oauth_pending_authorization_upsert(
      '14000000-0000-4000-8000-000000000004'::uuid,
      '8888881234',
      'v1.encrypted-access-d',
      'v1.encrypted-refresh-d',
      1::smallint,
      now() + interval '6 months',
      null,
      null
    )$$,
  'D cria pendência de conta nova apenas para validar resumo mascarado'
);
select is(
  public.pix_oauth_pending_authorization_summary(
    '14000000-0000-4000-8000-000000000004'::uuid
  )->>'account_hint',
  '1234',
  'conta nova também mostra somente dica mascarada'
);

select * from finish();

rollback;
