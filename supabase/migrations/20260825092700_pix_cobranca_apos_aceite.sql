do $$
begin
  if to_regclass('private.motorista_mercadopago_credenciais') is null then
    raise exception using
      errcode = '55000',
      message = 'ETAPA4_REQUER_PIX_OAUTH_CREDENTIALS';
  end if;

  if to_regclass('public.pagamentos_pix_tentativas') is null then
    raise exception using
      errcode = '55000',
      message = 'ETAPA4_REQUER_PIX_TENTATIVAS';
  end if;
end
$$;

create or replace function public.accept_corrida_atomic(
  p_corrida_id uuid,
  p_motorista_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_motorista_aprovacao public.motorista_status_aprovacao;
  v_is_disponivel boolean;
  v_cidade_id uuid;
  v_count_ativas integer;
  v_forma_pagamento public.forma_pagamento;
  v_conta_mercado_pago_id text;
  v_credential_status text;
  v_credential_user_id text;
  v_credential_expires_at timestamptz;
  v_credential_revoked_at timestamptz;
begin
  -- Mantém exatamente as travas operacionais preexistentes do motorista.
  select
    m.status_aprovacao,
    m.is_disponivel,
    u.cidade_id,
    m.conta_mercado_pago_id
  into
    v_motorista_aprovacao,
    v_is_disponivel,
    v_cidade_id,
    v_conta_mercado_pago_id
  from public.motoristas m
  join public.usuarios u on u.id = m.id
  where m.id = p_motorista_id
  for update;

  if v_motorista_aprovacao is null then
    raise exception 'Motorista não encontrado' using errcode = 'P0002';
  end if;

  if v_motorista_aprovacao::text != 'aprovado' then
    raise exception 'Motorista não está aprovado' using errcode = 'P0001';
  end if;

  if not v_is_disponivel then
    raise exception 'Motorista não está disponível' using errcode = 'P0001';
  end if;

  if v_cidade_id is null then
    raise exception 'Motorista não possui cidade vinculada' using errcode = 'P0001';
  end if;

  select count(*) into v_count_ativas
  from public.corridas
  where motorista_id = p_motorista_id
    and status in ('aceita', 'motorista_a_caminho', 'motorista_chegou', 'em_andamento');

  if v_count_ativas > 0 then
    raise exception 'Motorista já possui uma corrida ativa' using errcode = 'P0001';
  end if;

  -- Bloqueia a corrida candidata antes da validação Pix e preserva os mesmos
  -- critérios do UPDATE preexistente.
  select c.forma_pagamento
    into v_forma_pagamento
    from public.corridas c
   where c.id = p_corrida_id
     and c.status = 'solicitada'
     and c.motorista_id is null
     and c.cidade_id = v_cidade_id
   for update;

  if not found then
    raise exception 'Corrida indisponível ou cidade incompatível' using errcode = 'P0001';
  end if;

  -- Única alteração comportamental da Etapa 4: somente Pix exige revalidação
  -- da projeção pública contra a credencial privada ativa do mesmo motorista.
  if v_forma_pagamento = 'pix'::public.forma_pagamento then
    select
      c.connection_status,
      c.mercadopago_user_id,
      c.expires_at,
      c.revoked_at
    into
      v_credential_status,
      v_credential_user_id,
      v_credential_expires_at,
      v_credential_revoked_at
    from private.motorista_mercadopago_credenciais c
    where c.motorista_id = p_motorista_id;

    if v_conta_mercado_pago_id is null
       or v_credential_status is distinct from 'active'
       or v_credential_user_id is distinct from v_conta_mercado_pago_id
       or v_credential_expires_at is null
       or v_credential_expires_at <= now()
       or v_credential_revoked_at is not null then
      raise exception 'Conta Mercado Pago inválida para corrida Pix' using errcode = 'P0001';
    end if;
  end if;

  update public.corridas
  set
    motorista_id = p_motorista_id,
    status = 'aceita',
    data_aceite = now(),
    updated_at = now()
  where id = p_corrida_id
    and status = 'solicitada'
    and motorista_id is null
    and cidade_id = v_cidade_id;

  if not found then
    raise exception 'Corrida indisponível ou cidade incompatível' using errcode = 'P0001';
  end if;

  update public.motoristas
  set
    is_disponivel = false,
    updated_at = now()
  where id = p_motorista_id;
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
  select
    p.id,
    c.passageiro_id,
    p.valor_total,
    p.valor_comissao
  into
    _pagamento_id,
    _passageiro_id,
    _valor_total,
    _valor_comissao
  from public.corridas c
  join public.pagamentos p on p.corrida_id = c.id
  where c.id = _corrida_id
    and c.motorista_id = _motorista_id
    and c.forma_pagamento = 'pix'::public.forma_pagamento
    and c.status = 'aceita'::public.corrida_status
    and p.meio = 'pix'::public.forma_pagamento
    and p.status = 'pendente'::public.pagamento_status
    and p.id_transacao_mercadopago is null
  for update of p;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'ETAPA4_COBRANCA_NAO_ELEGIVEL';
  end if;

  _idempotency_key := 'zuvvi-pix-' || _pagamento_id::text;

  begin
    insert into public.pagamentos_pix_tentativas (
      pagamento_id,
      motorista_id,
      idempotency_key,
      estado_interno,
      valor_total,
      valor_comissao
    ) values (
      _pagamento_id,
      _motorista_id,
      _idempotency_key,
      'criando',
      _valor_total,
      _valor_comissao
    )
    returning id into _tentativa_id;
  exception
    when unique_violation then
      raise exception using
        errcode = '23505',
        message = 'ETAPA4_COBRANCA_JA_REQUISITADA';
  end;

  return query
  select
    _tentativa_id,
    _pagamento_id,
    _passageiro_id,
    _idempotency_key,
    _valor_total,
    _valor_comissao;
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
begin
  if nullif(btrim(_mercadopago_payment_id), '') is null
     or nullif(btrim(_pix_copia_cola), '') is null then
    raise exception using
      errcode = '22023',
      message = 'ETAPA4_RESPOSTA_MERCADOPAGO_INVALIDA';
  end if;

  select t.pagamento_id
    into _pagamento_id
    from public.pagamentos_pix_tentativas t
   where t.id = _tentativa_id
     and t.estado_interno = 'criando'
     and t.mercadopago_payment_id is null
   for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'ETAPA4_TENTATIVA_NAO_FINALIZAVEL';
  end if;

  update public.pagamentos p
     set id_transacao_mercadopago = _mercadopago_payment_id,
         updated_at = now()
   where p.id = _pagamento_id
     and p.status = 'pendente'::public.pagamento_status
     and p.id_transacao_mercadopago is null;

  if not found then
    raise exception using
      errcode = '23505',
      message = 'ETAPA4_PAGAMENTO_JA_POSSUI_COBRANCA';
  end if;

  update public.pagamentos_pix_tentativas
     set mercadopago_payment_id = _mercadopago_payment_id,
         estado_interno = 'pendente',
         provider_status = nullif(btrim(_provider_status), ''),
         provider_status_detail = nullif(btrim(_provider_status_detail), ''),
         pix_copia_cola = _pix_copia_cola,
         expires_at = _expires_at,
         updated_at = now()
   where id = _tentativa_id;
end;
$$;

create or replace function public.pix_charge_attempt_fail(
  _tentativa_id uuid,
  _provider_status_detail text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.pagamentos_pix_tentativas
     set estado_interno = 'falhou',
         provider_status_detail = nullif(btrim(_provider_status_detail), ''),
         failed_at = now(),
         updated_at = now()
   where id = _tentativa_id
     and estado_interno = 'criando'
     and mercadopago_payment_id is null;

  return found;
end;
$$;

revoke all on function public.pix_charge_attempt_claim(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.pix_charge_attempt_complete(
  uuid, text, text, text, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.pix_charge_attempt_fail(uuid, text)
  from public, anon, authenticated;

grant execute on function public.pix_charge_attempt_claim(uuid, uuid)
  to service_role;
grant execute on function public.pix_charge_attempt_complete(
  uuid, text, text, text, text, timestamptz
) to service_role;
grant execute on function public.pix_charge_attempt_fail(uuid, text)
  to service_role;

comment on function public.pix_charge_attempt_claim(uuid, uuid) is
  'Etapa 4: reserva idempotente de uma única cobrança Pix após aceite.';
comment on function public.pix_charge_attempt_complete(uuid, text, text, text, text, timestamptz) is
  'Etapa 4: finaliza tentativa Pix e vincula o ID Mercado Pago ao agregado na mesma transação.';
comment on function public.pix_charge_attempt_fail(uuid, text) is
  'Etapa 4: registra falha de criação sem apagar evidência da tentativa.';
