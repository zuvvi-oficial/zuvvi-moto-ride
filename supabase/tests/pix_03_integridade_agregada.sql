begin;

select plan(22);

select has_column(
  'public',
  'pagamentos',
  'pago_at',
  'pagamentos possui data de aprovação'
);
select has_column(
  'public',
  'pagamentos',
  'estornado_at',
  'pagamentos possui data de estorno'
);
select col_type_is(
  'public',
  'pagamentos',
  'pago_at',
  'timestamp with time zone',
  'pago_at usa timestamptz'
);
select col_type_is(
  'public',
  'pagamentos',
  'estornado_at',
  'timestamp with time zone',
  'estornado_at usa timestamptz'
);
select col_is_null(
  'public',
  'pagamentos',
  'pago_at',
  'pago_at permanece opcional'
);
select col_is_null(
  'public',
  'pagamentos',
  'estornado_at',
  'estornado_at permanece opcional'
);

select has_index(
  'public',
  'pagamentos',
  'pagamentos_corrida_id_idx',
  'corrida_id possui índice de cobertura'
);
select has_index(
  'public',
  'pagamentos',
  'pagamentos_pix_corrida_unique_idx',
  'corrida Pix possui índice único parcial'
);
select has_index(
  'public',
  'pagamentos',
  'pagamentos_mp_transaction_unique_idx',
  'ID Mercado Pago possui índice único parcial'
);
select ok(
  (
    select indexdef ilike '%unique%where%meio%pix%'
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'pagamentos'
      and indexname = 'pagamentos_pix_corrida_unique_idx'
  ),
  'unicidade por corrida se aplica somente ao Pix'
);
select ok(
  (
    select indexdef ilike '%unique%where%id_transacao_mercadopago%is not null%'
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'pagamentos'
      and indexname = 'pagamentos_mp_transaction_unique_idx'
  ),
  'unicidade externa se aplica somente a IDs preenchidos'
);

select is(
  (
    select count(*)::integer
    from public.pagamentos
    where id in (
      '31000000-0000-4000-8000-000000000001'::uuid,
      '31000000-0000-4000-8000-000000000002'::uuid,
      '31000000-0000-4000-8000-000000000003'::uuid
    )
  ),
  3,
  'registros anteriores permanecem intactos'
);
select is(
  (
    select count(*)::integer
    from public.pagamentos
    where id in (
      '31000000-0000-4000-8000-000000000001'::uuid,
      '31000000-0000-4000-8000-000000000002'::uuid,
      '31000000-0000-4000-8000-000000000003'::uuid
    )
      and pago_at is null
      and estornado_at is null
  ),
  3,
  'novas colunas não fazem backfill'
);
select ok(
  not (
    select relrowsecurity
    from pg_class
    where oid = 'public.pagamentos'::regclass
  ),
  'migration não altera RLS preexistente da fixture'
);

select throws_ok(
  $$insert into public.pagamentos (id, corrida_id, meio)
    values (
      '31000000-0000-4000-8000-000000000004'::uuid,
      '41000000-0000-4000-8000-000000000003'::uuid,
      'pix'
    )$$,
  '23505',
  null,
  'segunda cobrança Pix para a mesma corrida é rejeitada'
);
select lives_ok(
  $$insert into public.pagamentos (id, corrida_id, meio)
    values (
      '31000000-0000-4000-8000-000000000005'::uuid,
      '41000000-0000-4000-8000-000000000001'::uuid,
      'dinheiro'
    )$$,
  'dinheiro mantém comportamento sem unicidade por corrida'
);
select lives_ok(
  $$insert into public.pagamentos (id, corrida_id, meio)
    values (
      '31000000-0000-4000-8000-000000000006'::uuid,
      '41000000-0000-4000-8000-000000000002'::uuid,
      'cartao'
    )$$,
  'cartão mantém comportamento sem unicidade por corrida'
);
select lives_ok(
  $$insert into public.pagamentos (id, corrida_id, meio)
    values (
      '31000000-0000-4000-8000-000000000007'::uuid,
      '41000000-0000-4000-8000-000000000003'::uuid,
      'dinheiro'
    )$$,
  'outra forma pode coexistir com o Pix da corrida'
);
select throws_ok(
  $$insert into public.pagamentos (
      id, corrida_id, meio, id_transacao_mercadopago
    ) values (
      '31000000-0000-4000-8000-000000000008'::uuid,
      '41000000-0000-4000-8000-000000000008'::uuid,
      'pix',
      'mp-pix-existing-01'
    )$$,
  '23505',
  null,
  'ID Mercado Pago duplicado é rejeitado'
);
select lives_ok(
  $$insert into public.pagamentos (
      id, corrida_id, meio, id_transacao_mercadopago
    ) values (
      '31000000-0000-4000-8000-000000000009'::uuid,
      '41000000-0000-4000-8000-000000000009'::uuid,
      'pix',
      null
    )$$,
  'múltiplos IDs externos nulos são permitidos'
);
select lives_ok(
  $$update public.pagamentos
    set pago_at = now()
    where id = '31000000-0000-4000-8000-000000000003'::uuid$$,
  'data de aprovação pode ser registrada'
);
select lives_ok(
  $$update public.pagamentos
    set estornado_at = now()
    where id = '31000000-0000-4000-8000-000000000003'::uuid$$,
  'data de estorno pode ser registrada'
);

select * from finish();

rollback;
