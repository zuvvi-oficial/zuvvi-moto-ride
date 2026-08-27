create or replace function public.pix_hold_corrida_until_payment()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if old.status = 'solicitada'::public.corrida_status
     and new.status = 'aceita'::public.corrida_status
     and new.forma_pagamento = 'pix'::public.forma_pagamento then
    new.status := 'aguardando_pagamento'::public.corrida_status;
  end if;
  return new;
end;
$$;

drop trigger if exists pix_hold_corrida_until_payment_trigger on public.corridas;
create trigger pix_hold_corrida_until_payment_trigger
before update of status on public.corridas
for each row
execute function public.pix_hold_corrida_until_payment();

create or replace function public.set_motorista_online_atomic(p_motorista_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_exists boolean;
  v_active_ride_exists boolean;
begin
  select exists (
    select 1 from public.motoristas where id = p_motorista_id for update
  ) into v_exists;

  if not v_exists then
    raise exception 'MOTORISTA_NOT_FOUND';
  end if;

  select exists (
    select 1
    from public.corridas
    where motorista_id = p_motorista_id
      and status in (
        'aguardando_pagamento'::public.corrida_status,
        'aceita'::public.corrida_status,
        'motorista_a_caminho'::public.corrida_status,
        'motorista_chegou'::public.corrida_status,
        'em_andamento'::public.corrida_status
      )
  ) into v_active_ride_exists;

  if v_active_ride_exists then
    return 'ACTIVE_RIDE_EXISTS';
  end if;

  update public.motoristas
  set is_disponivel = true,
      updated_at = now()
  where id = p_motorista_id;

  return 'OK';
end;
$$;

create or replace function public.pix_charge_attempt_claim(
  _corrida_id uuid,
  _motorista_id uuid
)
returns table (
  tentativa_id uuid,
  pagamento_id uuid,
  passageiro_id uuid,
  idempotency_key text,
  valor_total numeric,
  valor_comissao numeric
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  _pagamento_id uuid;
  _passageiro_id uuid;
  _valor_total numeric;
  _valor_comissao numeric;
  _idempotency_key text;
  _tentativa_id uuid;
begin
  select p.id, c.passageiro_id, p.valor_total, p.valor_comissao
    into _pagamento_id, _passageiro_id, _valor_total, _valor_comissao
    from public.corridas c
    join public.pagamentos p on p.corrida_id = c.id
   where c.id = _corrida_id
     and c.motorista_id = _motorista_id
     and c.forma_pagamento = 'pix'::public.forma_pagamento
     and c.status in (
       'aguardando_pagamento'::public.corrida_status,
       'aceita'::public.corrida_status
     )
     and p.meio = 'pix'::public.forma_pagamento
     and p.status = 'pendente'::public.pagamento_status
     and p.id_transacao_mercadopago is null
   for update of p;

  if not found then
    raise exception using errcode = 'P0001', message = 'ETAPA4_COBRANCA_NAO_ELEGIVEL';
  end if;

  _idempotency_key := 'zuvvi-pix-' || _pagamento_id::text;

  begin
    insert into public.pagamentos_pix_tentativas (
      pagamento_id, motorista_id, idempotency_key, estado_interno, valor_total, valor_comissao
    ) values (
      _pagamento_id, _motorista_id, _idempotency_key, 'criando', _valor_total, _valor_comissao
    )
    returning id into _tentativa_id;
  exception
    when unique_violation then
      raise exception using errcode = '23505', message = 'ETAPA4_COBRANCA_JA_REQUISITADA';
  end;

  return query
  select _tentativa_id, _pagamento_id, _passageiro_id, _idempotency_key, _valor_total, _valor_comissao;
end;
$$;

create or replace function public.pix_charge_attempt_complete(
  _tentativa_id uuid,
  _mercadopago_payment_id text,
  _provider_status text,
  _provider_status_detail text,
  _pix_copia_cola text,
  _expires_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  _pagamento_id uuid;
  _corrida_id uuid;
  _motorista_id uuid;
  _status text := lower(coalesce(nullif(btrim(_provider_status), ''), 'pending'));
begin
  if nullif(btrim(_mercadopago_payment_id), '') is null
     or nullif(btrim(_pix_copia_cola), '') is null then
    raise exception using errcode = '22023', message = 'ETAPA4_RESPOSTA_MERCADOPAGO_INVALIDA';
  end if;

  select t.pagamento_id, p.corrida_id, t.motorista_id
    into _pagamento_id, _corrida_id, _motorista_id
    from public.pagamentos_pix_tentativas t
    join public.pagamentos p on p.id = t.pagamento_id
   where t.id = _tentativa_id
     and t.estado_interno = 'criando'
     and t.mercadopago_payment_id is null
   for update of t, p;

  if not found then
    raise exception using errcode = 'P0001', message = 'ETAPA4_TENTATIVA_NAO_FINALIZAVEL';
  end if;

  perform 1 from public.corridas c where c.id = _corrida_id for update;
  perform 1 from public.motoristas m where m.id = _motorista_id for update;

  update public.pagamentos p
     set id_transacao_mercadopago = _mercadopago_payment_id,
         updated_at = now()
   where p.id = _pagamento_id
     and p.status = 'pendente'::public.pagamento_status
     and p.id_transacao_mercadopago is null;

  if not found then
    raise exception using errcode = '23505', message = 'ETAPA4_PAGAMENTO_JA_POSSUI_COBRANCA';
  end if;

  if _status = 'approved' then
    update public.pagamentos_pix_tentativas
       set mercadopago_payment_id = _mercadopago_payment_id,
           estado_interno = 'pago',
           provider_status = _status,
           provider_status_detail = nullif(btrim(_provider_status_detail), ''),
           pix_copia_cola = _pix_copia_cola,
           expires_at = _expires_at,
           approved_at = coalesce(approved_at, now()),
           updated_at = now()
     where id = _tentativa_id;

    update public.pagamentos
       set status = 'pago'::public.pagamento_status,
           pago_at = coalesce(pago_at, now()),
           updated_at = now()
     where id = _pagamento_id;

    update public.corridas
       set status = 'aceita'::public.corrida_status,
           updated_at = now()
     where id = _corrida_id
       and status = 'aguardando_pagamento'::public.corrida_status;

  elsif _status in ('rejected', 'cancelled') then
    update public.pagamentos_pix_tentativas
       set mercadopago_payment_id = _mercadopago_payment_id,
           estado_interno = 'falhou',
           provider_status = _status,
           provider_status_detail = nullif(btrim(_provider_status_detail), ''),
           pix_copia_cola = _pix_copia_cola,
           expires_at = _expires_at,
           failed_at = coalesce(failed_at, now()),
           updated_at = now()
     where id = _tentativa_id;

    update public.pagamentos
       set status = 'falhou'::public.pagamento_status,
           updated_at = now()
     where id = _pagamento_id;

    update public.corridas
       set status = 'cancelada'::public.corrida_status,
           cancelado_por = 'operacao'::public.cancelado_por,
           motivo_cancelamento = 'pagamento_pix_rejeitado',
           data_cancelamento = coalesce(data_cancelamento, now()),
           updated_at = now()
     where id = _corrida_id
       and status in (
         'aguardando_pagamento'::public.corrida_status,
         'aceita'::public.corrida_status
       );

    update public.motoristas m
       set is_disponivel = case
             when m.status_aprovacao = 'aprovado'::public.motorista_status_aprovacao
              and not exists (
                select 1 from public.corridas c
                 where c.motorista_id = m.id
                   and c.status in (
                     'aguardando_pagamento'::public.corrida_status,
                     'aceita'::public.corrida_status,
                     'motorista_a_caminho'::public.corrida_status,
                     'motorista_chegou'::public.corrida_status,
                     'em_andamento'::public.corrida_status
                   )
              ) then true
             else false
           end,
           updated_at = now()
     where m.id = _motorista_id;

  else
    update public.pagamentos_pix_tentativas
       set mercadopago_payment_id = _mercadopago_payment_id,
           estado_interno = 'pendente',
           provider_status = nullif(btrim(_provider_status), ''),
           provider_status_detail = nullif(btrim(_provider_status_detail), ''),
           pix_copia_cola = _pix_copia_cola,
           expires_at = _expires_at,
           updated_at = now()
     where id = _tentativa_id;
  end if;
end;
$$;

create or replace function public.pix_payment_status_project(
  _tentativa_id uuid,
  _mercadopago_payment_id text,
  _provider_status text,
  _provider_status_detail text
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  _pagamento_id uuid;
  _corrida_id uuid;
  _motorista_id uuid;
  _attempt_state text;
  _stored_mp_id text;
  _status text := lower(coalesce(nullif(btrim(_provider_status), ''), 'pending'));
begin
  if nullif(btrim(_mercadopago_payment_id), '') is null then
    raise exception using errcode = '22023', message = 'PIX_STATUS_PAYMENT_ID_INVALIDO';
  end if;

  select t.pagamento_id, p.corrida_id, t.motorista_id, t.estado_interno, t.mercadopago_payment_id
    into _pagamento_id, _corrida_id, _motorista_id, _attempt_state, _stored_mp_id
    from public.pagamentos_pix_tentativas t
    join public.pagamentos p on p.id = t.pagamento_id
   where t.id = _tentativa_id
   for update of t, p;

  if not found or _stored_mp_id is distinct from _mercadopago_payment_id then
    raise exception using errcode = 'P0001', message = 'PIX_STATUS_TENTATIVA_INVALIDA';
  end if;

  perform 1 from public.corridas c where c.id = _corrida_id for update;
  perform 1 from public.motoristas m where m.id = _motorista_id for update;

  if _attempt_state = 'pago' then
    return 'pago';
  elsif _attempt_state in ('falhou', 'estornado') then
    return _attempt_state;
  end if;

  if _status = 'approved' then
    update public.pagamentos_pix_tentativas
       set estado_interno = 'pago',
           provider_status = _status,
           provider_status_detail = nullif(btrim(_provider_status_detail), ''),
           approved_at = coalesce(approved_at, now()),
           updated_at = now()
     where id = _tentativa_id;

    update public.pagamentos
       set status = 'pago'::public.pagamento_status,
           pago_at = coalesce(pago_at, now()),
           updated_at = now()
     where id = _pagamento_id
       and status = 'pendente'::public.pagamento_status;

    update public.corridas
       set status = 'aceita'::public.corrida_status,
           updated_at = now()
     where id = _corrida_id
       and status = 'aguardando_pagamento'::public.corrida_status;

    return 'pago';

  elsif _status in ('rejected', 'cancelled') then
    update public.pagamentos_pix_tentativas
       set estado_interno = 'falhou',
           provider_status = _status,
           provider_status_detail = nullif(btrim(_provider_status_detail), ''),
           failed_at = coalesce(failed_at, now()),
           updated_at = now()
     where id = _tentativa_id;

    update public.pagamentos
       set status = 'falhou'::public.pagamento_status,
           updated_at = now()
     where id = _pagamento_id
       and status = 'pendente'::public.pagamento_status;

    update public.corridas
       set status = 'cancelada'::public.corrida_status,
           cancelado_por = 'operacao'::public.cancelado_por,
           motivo_cancelamento = 'pagamento_pix_rejeitado',
           data_cancelamento = coalesce(data_cancelamento, now()),
           updated_at = now()
     where id = _corrida_id
       and status in (
         'aguardando_pagamento'::public.corrida_status,
         'aceita'::public.corrida_status
       );

    update public.motoristas m
       set is_disponivel = case
             when m.status_aprovacao = 'aprovado'::public.motorista_status_aprovacao
              and not exists (
                select 1 from public.corridas c
                 where c.motorista_id = m.id
                   and c.status in (
                     'aguardando_pagamento'::public.corrida_status,
                     'aceita'::public.corrida_status,
                     'motorista_a_caminho'::public.corrida_status,
                     'motorista_chegou'::public.corrida_status,
                     'em_andamento'::public.corrida_status
                   )
              ) then true
             else false
           end,
           updated_at = now()
     where m.id = _motorista_id;

    return 'falhou';
  end if;

  update public.pagamentos_pix_tentativas
     set provider_status = nullif(btrim(_provider_status), ''),
         provider_status_detail = nullif(btrim(_provider_status_detail), ''),
         updated_at = now()
   where id = _tentativa_id;

  return 'pendente';
end;
$$;

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
  perform 1 from public.motoristas m where m.id = _motorista_id for update;
  if not found then return false; end if;

  select p.id, t.estado_interno, t.mercadopago_payment_id,
         p.status, p.id_transacao_mercadopago,
         c.status, c.forma_pagamento, c.motorista_id
    into _pagamento_id, _attempt_status, _attempt_mp_id,
         _payment_status, _payment_mp_id,
         _ride_status, _ride_method, _ride_driver
    from public.pagamentos_pix_tentativas t
    join public.pagamentos p on p.id = t.pagamento_id
    join public.corridas c on c.id = p.corrida_id
   where t.id = _tentativa_id
     and t.motorista_id = _motorista_id
     and c.id = _corrida_id
   for update of t, p, c;

  if not found then return false; end if;

  if _attempt_mp_id is not null or _payment_mp_id is not null then
    raise exception using errcode = 'P0001', message = 'ETAPA4_COMPENSACAO_BLOQUEADA_COBRANCA_EXTERNA';
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

  if _ride_status not in (
       'aguardando_pagamento'::public.corrida_status,
       'aceita'::public.corrida_status
     )
     or _payment_status <> 'pendente'::public.pagamento_status
     or _attempt_status <> 'criando' then
    return false;
  end if;

  update public.pagamentos_pix_tentativas
     set estado_interno = 'falhou',
         provider_status_detail = coalesce(nullif(btrim(_provider_status_detail), ''), 'mercadopago_create_error'),
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

revoke all on function public.pix_payment_status_project(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.pix_payment_status_project(uuid, text, text, text)
  to service_role;

revoke all on function public.pix_charge_attempt_claim(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.pix_charge_attempt_claim(uuid, uuid)
  to service_role;

revoke all on function public.pix_charge_attempt_complete(uuid, text, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.pix_charge_attempt_complete(uuid, text, text, text, text, timestamptz)
  to service_role;

revoke all on function public.pix_charge_failure_compensate(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.pix_charge_failure_compensate(uuid, uuid, uuid, text)
  to service_role;
