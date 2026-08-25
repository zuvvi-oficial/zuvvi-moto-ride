begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(23);

select ok(
  to_regprocedure('public.pix_charge_failure_compensate(uuid,uuid,uuid,text)') is not null,
  'função de compensação existe'
);

insert into public.usuarios(id, cidade_id) values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('22222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('33333333-3333-4333-8333-333333333333', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('44444444-4444-4444-8444-444444444444', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

insert into public.motoristas(id, status_aprovacao, is_disponivel) values
  ('11111111-1111-4111-8111-111111111111', 'aprovado', false),
  ('33333333-3333-4333-8333-333333333333', 'aprovado', false),
  ('44444444-4444-4444-8444-444444444444', 'aprovado', false);

insert into public.corridas(
  id, passageiro_id, motorista_id, cidade_id, status, forma_pagamento
) values
  ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aceita', 'pix'),
  ('bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aceita', 'pix'),
  ('cccccccc-1111-4111-8111-cccccccccccc', '22222222-2222-4222-8222-222222222222', '44444444-4444-4444-8444-444444444444', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aceita', 'dinheiro');

insert into public.pagamentos(
  id, corrida_id, meio, valor_total, valor_motorista, valor_comissao, status, id_transacao_mercadopago
) values
  ('aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa', 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', 'pix', 20.00, 16.00, 4.00, 'pendente', null),
  ('bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb', 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb', 'pix', 25.00, 20.00, 5.00, 'pendente', null),
  ('cccccccc-2222-4222-8222-cccccccccccc', 'cccccccc-1111-4111-8111-cccccccccccc', 'dinheiro', 15.00, 12.00, 3.00, 'pendente', null);

insert into public.pagamentos_pix_tentativas(
  id, pagamento_id, motorista_id, idempotency_key, estado_interno,
  mercadopago_payment_id, valor_total, valor_comissao
) values
  ('aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa', 'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'zuvvi-pix-a', 'criando', null, 20.00, 4.00),
  ('bbbbbbbb-3333-4333-8333-bbbbbbbbbbbb', 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb', '33333333-3333-4333-8333-333333333333', 'zuvvi-pix-b', 'criando', 'MP-EXISTENTE', 25.00, 5.00),
  ('cccccccc-3333-4333-8333-cccccccccccc', 'cccccccc-2222-4222-8222-cccccccccccc', '44444444-4444-4444-8444-444444444444', 'zuvvi-pix-c', 'criando', null, 15.00, 3.00);

select is(
  public.pix_charge_failure_compensate(
    'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa',
    'mercadopago_create_error'
  ),
  true,
  'compensação elegível retorna true'
);

select is(
  (select estado_interno from public.pagamentos_pix_tentativas where id='aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa'),
  'falhou',
  'tentativa é marcada como falhou'
);

select is(
  (select provider_status_detail from public.pagamentos_pix_tentativas where id='aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa'),
  'mercadopago_create_error',
  'detalhe técnico sanitizado é preservado'
);

select is(
  (select status::text from public.pagamentos where id='aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa'),
  'falhou',
  'agregado é marcado como falhou'
);

select is(
  (select status::text from public.corridas where id='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'),
  'cancelada',
  'corrida é cancelada tecnicamente'
);

select is(
  (select cancelado_por::text from public.corridas where id='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'),
  'operacao',
  'cancelamento é atribuído à operação'
);

select is(
  (select motivo_cancelamento from public.corridas where id='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'),
  'falha_tecnica_pagamento_pix',
  'motivo de cancelamento é fixo e sanitizado'
);

select is(
  (select is_disponivel from public.motoristas where id='11111111-1111-4111-8111-111111111111'),
  true,
  'motorista aprovado é liberado novamente'
);

select is(
  public.pix_charge_failure_compensate(
    'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa',
    'repeticao'
  ),
  false,
  'segunda compensação é idempotente'
);

select throws_ok(
  $$select public.pix_charge_failure_compensate(
    'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb',
    '33333333-3333-4333-8333-333333333333',
    'bbbbbbbb-3333-4333-8333-bbbbbbbbbbbb',
    'erro'
  )$$,
  'P0001',
  'ETAPA4_COMPENSACAO_BLOQUEADA_COBRANCA_EXTERNA',
  'identificador Mercado Pago bloqueia compensação'
);

select is(
  (select status::text from public.corridas where id='bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb'),
  'aceita',
  'corrida com cobrança externa permanece intacta'
);

select is(
  (select status::text from public.pagamentos where id='bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'),
  'pendente',
  'agregado com cobrança externa permanece intacto'
);

select is(
  (select is_disponivel from public.motoristas where id='33333333-3333-4333-8333-333333333333'),
  false,
  'motorista com cobrança externa não é liberado indevidamente'
);

select is(
  public.pix_charge_failure_compensate(
    'cccccccc-1111-4111-8111-cccccccccccc',
    '44444444-4444-4444-8444-444444444444',
    'cccccccc-3333-4333-8333-cccccccccccc',
    'erro'
  ),
  false,
  'corrida dinheiro não entra na compensação Pix'
);

select is(
  (select status::text from public.corridas where id='cccccccc-1111-4111-8111-cccccccccccc'),
  'aceita',
  'corrida dinheiro permanece intacta'
);

select is(
  public.pix_charge_failure_compensate(
    'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb',
    '11111111-1111-4111-8111-111111111111',
    'bbbbbbbb-3333-4333-8333-bbbbbbbbbbbb',
    'erro'
  ),
  false,
  'motorista incorreto não altera tentativa alheia'
);

select ok(
  not has_function_privilege('anon', 'public.pix_charge_failure_compensate(uuid,uuid,uuid,text)', 'EXECUTE'),
  'anon não executa compensação'
);

select ok(
  not has_function_privilege('authenticated', 'public.pix_charge_failure_compensate(uuid,uuid,uuid,text)', 'EXECUTE'),
  'authenticated não executa compensação'
);

select ok(
  has_function_privilege('service_role', 'public.pix_charge_failure_compensate(uuid,uuid,uuid,text)', 'EXECUTE'),
  'service_role executa compensação'
);

select is(
  (select prosecdef from pg_proc where oid='public.pix_charge_failure_compensate(uuid,uuid,uuid,text)'::regprocedure),
  false,
  'função permanece SECURITY INVOKER'
);

select ok(
  (select proconfig @> array['search_path=""']::text[] from pg_proc where oid='public.pix_charge_failure_compensate(uuid,uuid,uuid,text)'::regprocedure),
  'search_path fica fechado'
);

select is(
  (select count(*)::integer from public.pagamentos where meio <> 'pix' and status <> 'pendente'),
  0,
  'meios não Pix não tiveram estado financeiro alterado'
);

select * from finish();
rollback;
