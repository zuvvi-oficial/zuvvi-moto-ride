do $$
begin
  if exists (
    select 1
    from public.pagamentos
    where meio = 'pix'
    group by corrida_id
    having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'PIX03_DUPLICATE_PIX_CORRIDA';
  end if;

  if exists (
    select 1
    from public.pagamentos
    where id_transacao_mercadopago is not null
    group by id_transacao_mercadopago
    having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'PIX03_DUPLICATE_MERCADOPAGO_TRANSACTION';
  end if;
end
$$;

alter table public.pagamentos
  add column pago_at timestamptz,
  add column estornado_at timestamptz;

create index pagamentos_corrida_id_idx
  on public.pagamentos (corrida_id);

create unique index pagamentos_pix_corrida_unique_idx
  on public.pagamentos (corrida_id)
  where meio = 'pix';

create unique index pagamentos_mp_transaction_unique_idx
  on public.pagamentos (id_transacao_mercadopago)
  where id_transacao_mercadopago is not null;
