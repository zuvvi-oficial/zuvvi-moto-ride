begin;

select plan(22);

select has_function(
  'public',
  'pix_oauth_disconnect_safe',
  array['uuid'],
  'função de desconexão OAuth segura existe'
);
select ok(
  not has_function_privilege('anon', 'public.pix_oauth_disconnect_safe(uuid)', 'EXECUTE'),
  'anon não executa desconexão OAuth'
);
select ok(
  not has_function_privilege('authenticated', 'public.pix_oauth_disconnect_safe(uuid)', 'EXECUTE'),
  'authenticated não executa desconexão OAuth'
);
select ok(
  has_function_privilege('service_role', 'public.pix_oauth_disconnect_safe(uuid)', 'EXECUTE'),
  'service_role executa desconexão OAuth'
);
select ok(
  not (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'pix_oauth_disconnect_safe'
  ),
  'função permanece SECURITY INVOKER'
);
select ok(
  (
    select pg_get_functiondef(p.oid) ilike '%from public.motoristas%for update%'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'pix_oauth_disconnect_safe'
  ),
  'desconexão trava a linha do motorista para serializar com o aceite'
);

select lives_ok(
  $$insert into public.usuarios(id,nome) values
    ('81000000-0000-4000-8000-000000000001','Motorista OAuth 1'),
    ('81000000-0000-4000-8000-000000000002','Motorista OAuth 2'),
    ('81000000-0000-4000-8000-000000000003','Motorista OAuth 3'),
    ('81000000-0000-4000-8000-000000000004','Motorista OAuth 4'),
    ('81000000-0000-4000-8000-000000000005','Motorista OAuth 5'),
    ('81000000-0000-4000-8000-000000000006','Motorista OAuth 6'),
    ('81000000-0000-4000-8000-000000000007','Motorista OAuth 7')$$,
  'usuários isolados são criados'
);
select lives_ok(
  $$insert into public.motoristas(id,conta_mercado_pago_id) values
    ('81000000-0000-4000-8000-000000000001','mp-8101'),
    ('81000000-0000-4000-8000-000000000002','mp-8102'),
    ('81000000-0000-4000-8000-000000000003','mp-8103'),
    ('81000000-0000-4000-8000-000000000004','mp-8104'),
    ('81000000-0000-4000-8000-000000000005','mp-8105'),
    ('81000000-0000-4000-8000-000000000006','mp-8106'),
    ('81000000-0000-4000-8000-000000000007','mp-8107')$$,
  'motoristas isolados são criados'
);
select lives_ok(
  $$insert into private.motorista_mercadopago_credenciais(
      motorista_id,mercadopago_user_id,access_token_encrypted,refresh_token_encrypted,
      encryption_version,expires_at,connection_status
    ) values
    ('81000000-0000-4000-8000-000000000001','mp-8101','a1','r1',1,now()+interval '1 hour','active'),
    ('81000000-0000-4000-8000-000000000002','mp-8102','a2','r2',1,now()+interval '1 hour','active'),
    ('81000000-0000-4000-8000-000000000003','mp-8103','a3','r3',1,now()+interval '1 hour','active'),
    ('81000000-0000-4000-8000-000000000004','mp-8104','a4','r4',1,now()+interval '1 hour','active'),
    ('81000000-0000-4000-8000-000000000005','mp-8105','a5','r5',1,now()+interval '1 hour','active'),
    ('81000000-0000-4000-8000-000000000006','mp-8106','a6','r6',1,now()+interval '1 hour','active'),
    ('81000000-0000-4000-8000-000000000007','mp-8107','a7','r7',1,now()+interval '1 hour','active')$$,
  'credenciais privadas isoladas são criadas'
);
select lives_ok(
  $$insert into public.corridas(id,passageiro_id,motorista_id,status,forma_pagamento) values
    ('82000000-0000-4000-8000-000000000002','83000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000002','aceita','pix'),
    ('82000000-0000-4000-8000-000000000003','83000000-0000-4000-8000-000000000003','81000000-0000-4000-8000-000000000003','cancelada','pix'),
    ('82000000-0000-4000-8000-000000000004','83000000-0000-4000-8000-000000000004','81000000-0000-4000-8000-000000000004','cancelada','pix'),
    ('82000000-0000-4000-8000-000000000005','83000000-0000-4000-8000-000000000005','81000000-0000-4000-8000-000000000005','cancelada','pix'),
    ('82000000-0000-4000-8000-000000000006','83000000-0000-4000-8000-000000000006','81000000-0000-4000-8000-000000000006','concluida','pix'),
    ('82000000-0000-4000-8000-000000000007','83000000-0000-4000-8000-000000000007','81000000-0000-4000-8000-000000000007','em_andamento','dinheiro')$$,
  'corridas de cenários são criadas'
);
select lives_ok(
  $$insert into public.pagamentos(id,corrida_id,meio,status) values
    ('84000000-0000-4000-8000-000000000003','82000000-0000-4000-8000-000000000003','pix','pendente'),
    ('84000000-0000-4000-8000-000000000004','82000000-0000-4000-8000-000000000004','pix','pendente'),
    ('84000000-0000-4000-8000-000000000005','82000000-0000-4000-8000-000000000005','pix','pago'),
    ('84000000-0000-4000-8000-000000000006','82000000-0000-4000-8000-000000000006','pix','pago')$$,
  'agregados financeiros de cenários são criados'
);
select lives_ok(
  $$insert into public.pagamentos_pix_tentativas(
      pagamento_id,motorista_id,idempotency_key,estado_interno,valor_total,valor_comissao
    ) values
    ('84000000-0000-4000-8000-000000000004','81000000-0000-4000-8000-000000000004','safe-disconnect-8104','pendente',20.00,4.00),
    ('84000000-0000-4000-8000-000000000006','81000000-0000-4000-8000-000000000006','safe-disconnect-8106','pago',30.00,6.00)$$,
  'tentativas Pix reais de cenários são criadas'
);

set local role service_role;

select is(
  public.pix_oauth_disconnect_safe('81000000-0000-4000-8000-000000000001'),
  'disconnected',
  'motorista sem obrigação pode desconectar'
);
select ok(
  (
    select connection_status = 'revoked'
      and access_token_encrypted is null
      and refresh_token_encrypted is null
      and revoked_at is not null
    from private.motorista_mercadopago_credenciais
    where motorista_id = '81000000-0000-4000-8000-000000000001'
  ),
  'desconexão revoga e apaga os envelopes privados'
);
select is(
  (select conta_mercado_pago_id from public.motoristas where id='81000000-0000-4000-8000-000000000001'),
  null,
  'desconexão limpa a projeção pública na mesma operação'
);
select is(
  public.pix_oauth_disconnect_safe('81000000-0000-4000-8000-000000000002'),
  'blocked_active_pix',
  'corrida Pix ativa bloqueia desconexão'
);
select ok(
  (select connection_status='active' from private.motorista_mercadopago_credenciais where motorista_id='81000000-0000-4000-8000-000000000002')
  and (select conta_mercado_pago_id='mp-8102' from public.motoristas where id='81000000-0000-4000-8000-000000000002'),
  'bloqueio preserva credencial privada e projeção pública'
);
select is(
  public.pix_oauth_disconnect_safe('81000000-0000-4000-8000-000000000003'),
  'disconnected',
  'Pix histórico cancelado e pendente sem tentativa real não bloqueia para sempre'
);
select is(
  public.pix_oauth_disconnect_safe('81000000-0000-4000-8000-000000000004'),
  'blocked_financial',
  'tentativa Pix pendente bloqueia desconexão'
);
select is(
  public.pix_oauth_disconnect_safe('81000000-0000-4000-8000-000000000005'),
  'blocked_financial',
  'Pix pago e cancelado bloqueia até resolução financeira'
);
select is(
  public.pix_oauth_disconnect_safe('81000000-0000-4000-8000-000000000006'),
  'disconnected',
  'Pix pago e corrida concluída não mantém bloqueio indefinido'
);
select is(
  public.pix_oauth_disconnect_safe('81000000-0000-4000-8000-000000000007'),
  'disconnected',
  'corrida em dinheiro não depende da conexão Mercado Pago'
);

select * from finish();
rollback;
