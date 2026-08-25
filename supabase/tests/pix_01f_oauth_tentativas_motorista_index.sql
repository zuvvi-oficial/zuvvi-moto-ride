begin;

select plan(4);

select has_index(
  'private',
  'mercadopago_oauth_tentativas',
  'mercadopago_oauth_tentativas_motorista_id_idx',
  'índice de cobertura da FK motorista_id existe'
);

select ok(
  (
    select array_agg(a.attname order by x.ordinality) = array['motorista_id']::name[]
    from pg_index i
    join lateral unnest(i.indkey::smallint[]) with ordinality as x(attnum, ordinality)
      on true
    join pg_attribute a
      on a.attrelid = i.indrelid
     and a.attnum = x.attnum
    where i.indexrelid = 'private.mercadopago_oauth_tentativas_motorista_id_idx'::regclass
  ),
  'índice cobre exatamente motorista_id'
);

select ok(
  not (
    select i.indisunique
    from pg_index i
    where i.indexrelid = 'private.mercadopago_oauth_tentativas_motorista_id_idx'::regclass
  ),
  'índice não introduz unicidade nova'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_index i
      on i.indrelid = c.conrelid
     and i.indkey::smallint[] @> c.conkey
    where c.conrelid = 'private.mercadopago_oauth_tentativas'::regclass
      and c.conname = 'mercadopago_oauth_tentativas_motorista_id_fkey'
      and c.contype = 'f'
      and i.indexrelid = 'private.mercadopago_oauth_tentativas_motorista_id_idx'::regclass
  ),
  'FK motorista_id possui índice de cobertura'
);

select * from finish();

rollback;
