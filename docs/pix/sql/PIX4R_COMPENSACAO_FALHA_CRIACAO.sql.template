create or replace function public.pix_charge_failure_compensate(
  _corrida_id uuid,
  _motorista_id uuid,
  _tentativa_id uuid,
  _provider_status_detail text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  _pagamento_id uuid;
  _attempt_status text;
  _attempt_mp_id text;
  _payment_status public.pagamento_status;
  _payment_mp_id text;
  _ride_status public.corrida_status;
  _ride_method public.forma_pagamento;
  _ride_driver uuid;
begin
  perform 1
  from public.motoristas m
  where m.id = _motorista_id
  for update;

  if not found then
    return false;
  end if;

  select
    p.id,
    t.estado_interno,
    t.mercadopago_payment_id,
    p.status,
    p.id_transacao_mercadopago,
    c.status,
    c.forma_pagamento,
    c.motorista_id
  into
    _pagamento_id,
    _attempt_status,
    _attempt_mp_id,
    _payment_status,
    _payment_mp_id,
    _ride_status,
    _ride_method,
    _ride_driver
  from public.pagamentos_pix_tentativas t
  join public.pagamentos p on p.id = t.pagamento_id
  join public.corridas c on c.id = p.corrida_id
  where t.id = _tentativa_id
    and t.motorista_id = _motorista_id
    and c.id = _corrida_id
  for update of t, p, c;

  if not found then
    return false;
  end if;

  if _attempt_mp_id is not null or _payment_mp_id is not null then
    raise exception using
      errcode = 'P0001',
      message = 'ETAPA4_COMPENSACAO_BLOQUEADA_COBRANCA_EXTERNA';
  end if;

  if _ride_method <> 'pix'::public.forma_pagamento
     or _ride_driver is distinct from _motorista_id then
    return false;
  end if;

  if _ride_status = 'cancelada'::public.corrida_status
     and _payment_status = 'falhou'::public.pagamento_status
     and _attempt_status = 'falhou' then
    return false;
  end if;

  if _ride_status <> 'aceita'::public.corrida_status
     or _payment_status <> 'pendente'::public.pagamento_status
     or _attempt_status <> 'criando' then
    return false;
  end if;

  update public.pagamentos_pix_tentativas
  set estado_interno = 'falhou',
      provider_status_detail = coalesce(
        nullif(btrim(_provider_status_detail), ''),
        'mercadopago_create_error'
      ),
      failed_at = now(),
      updated_at = now()
  where id = _tentativa_id;

  update public.pagamentos
  set status = 'falhou'::public.pagamento_status,
      updated_at = now()
  where id = _pagamento_id;

  update public.corridas
  set status = 'cancelada'::public.corrida_status,
      cancelado_por = 'operacao'::public.cancelado_por,
      motivo_cancelamento = 'falha_tecnica_pagamento_pix',
      data_cancelamento = now(),
      updated_at = now()
  where id = _corrida_id;

  update public.motoristas
  set is_disponivel = case
        when status_aprovacao = 'aprovado'::public.motorista_status_aprovacao then true
        else false
      end,
      updated_at = now()
  where id = _motorista_id;

  return true;
end;
$$;

revoke all on function public.pix_charge_failure_compensate(uuid, uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.pix_charge_failure_compensate(uuid, uuid, uuid, text)
  to service_role;

comment on function public.pix_charge_failure_compensate(uuid, uuid, uuid, text) is
  'Etapa 4-R: compensa atomicamente falha de criação Pix sem identificador Mercado Pago conhecido.';
