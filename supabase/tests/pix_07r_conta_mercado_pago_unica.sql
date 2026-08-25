begin;

select plan(10);

select has_column(
  'public',
  'motoristas',
  'conta_mercado_pago_id',
  'motoristas possui identificador da conta Mercado Pago'
);
select col_type_is(
  'public',
  'motoristas',
  'conta_mercado_pago_id',
  'text',
  'identificador Mercado Pago usa text'
);
select col_is_null(
  'public',
  'motoristas',
  'conta_mercado_pago_id',
  'conta Mercado Pago permanece opcional'
);
select has_index(
  'public',
  'motoristas',
  'idx_motoristas_conta_mercado_pago_unica',
  'índice de unicidade da conta Mercado Pago existe'
);
select ok(
  (
    select indexdef ilike
      '%unique index%conta_mercado_pago_id%where (conta_mercado_pago_id is not null)%'
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'motoristas'
      and indexname = 'idx_motoristas_conta_mercado_pago_unica'
  ),
  'índice é único e se aplica somente a contas preenchidas'
);

select lives_ok(
  $$insert into public.usuarios (
      id, nome, perfil_ativo, is_passageiro, is_motorista
    ) values
      ('70000000-0000-4000-8000-000000000001'::uuid, 'Motorista PIX-07R 1', 'motorista', false, true),
      ('70000000-0000-4000-8000-000000000002'::uuid, 'Motorista PIX-07R 2', 'motorista', false, true)$$,
  'usuários isolados de teste são criados'
);
select lives_ok(
  $$insert into public.motoristas (id, conta_mercado_pago_id) values
      ('70000000-0000-4000-8000-000000000001'::uuid, null),
      ('70000000-0000-4000-8000-000000000002'::uuid, null)$$,
  'múltiplos motoristas desconectados continuam permitidos'
);
select lives_ok(
  $$update public.motoristas
    set conta_mercado_pago_id = case id
      when '70000000-0000-4000-8000-000000000001'::uuid then '700000001'
      when '70000000-0000-4000-8000-000000000002'::uuid then '700000002'
    end
    where id in (
      '70000000-0000-4000-8000-000000000001'::uuid,
      '70000000-0000-4000-8000-000000000002'::uuid
    )$$,
  'contas Mercado Pago distintas continuam permitidas'
);
select throws_ok(
  $$update public.motoristas
    set conta_mercado_pago_id = '700000001'
    where id = '70000000-0000-4000-8000-000000000002'::uuid$$,
  '23505',
  null,
  'a mesma conta Mercado Pago em dois motoristas é rejeitada'
);
select is(
  (
    select conta_mercado_pago_id
    from public.motoristas
    where id = '70000000-0000-4000-8000-000000000002'::uuid
  ),
  '700000002',
  'tentativa duplicada não altera a conta anteriormente válida'
);

select * from finish();

rollback;
