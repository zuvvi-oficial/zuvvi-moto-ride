create function public.pix_oauth_pending_authorization_status(
  _motorista_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  _confirmation_expires_at timestamptz;
begin
  if _motorista_id is null then
    raise exception using
      errcode = '22023',
      message = 'PIX_MP_PENDING_STATUS_MOTORISTA_INVALIDO';
  end if;

  perform 1
  from public.motoristas m
  where m.id = _motorista_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'PIX_MP_PENDING_STATUS_MOTORISTA_NAO_ENCONTRADO';
  end if;

  select p.confirmation_expires_at
  into _confirmation_expires_at
  from private.motorista_mercadopago_autorizacoes_pendentes p
  where p.motorista_id = _motorista_id
    and p.confirmation_expires_at > now()
    and p.token_expires_at > now();

  return _confirmation_expires_at;
end;
$$;

create function public.pix_oauth_pending_authorization_confirm(
  _motorista_id uuid
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  _pending private.motorista_mercadopago_autorizacoes_pendentes%rowtype;
  _active_account_id text;
begin
  if _motorista_id is null then
    raise exception using
      errcode = '22023',
      message = 'PIX_MP_PENDING_CONFIRM_MOTORISTA_INVALIDO';
  end if;

  perform 1
  from public.motoristas m
  where m.id = _motorista_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'PIX_MP_PENDING_CONFIRM_MOTORISTA_NAO_ENCONTRADO';
  end if;

  select p.*
  into _pending
  from private.motorista_mercadopago_autorizacoes_pendentes p
  where p.motorista_id = _motorista_id
  for update;

  if not found then
    select c.mercadopago_user_id
    into _active_account_id
    from private.motorista_mercadopago_credenciais c
    join public.motoristas m on m.id = c.motorista_id
    where c.motorista_id = _motorista_id
      and c.connection_status = 'active'
      and c.revoked_at is null
      and c.encryption_version > 0
      and c.access_token_encrypted is not null
      and c.refresh_token_encrypted is not null
      and m.conta_mercado_pago_id = c.mercadopago_user_id;

    if found then
      return 'already_connected';
    end if;

    return 'not_found';
  end if;

  if _pending.confirmation_expires_at <= now()
     or _pending.token_expires_at <= now() then
    delete from private.motorista_mercadopago_autorizacoes_pendentes
    where motorista_id = _motorista_id;

    return 'expired';
  end if;

  begin
    perform public.pix_oauth_credentials_upsert(
      _motorista_id,
      _pending.mercadopago_user_id,
      _pending.access_token_encrypted,
      _pending.refresh_token_encrypted,
      _pending.encryption_version,
      _pending.token_expires_at,
      _pending.scope,
      _pending.token_type
    );
  exception
    when unique_violation then
      if sqlerrm = 'PIX_MP_ACCOUNT_OWNED_BY_OTHER_MOTORISTA' then
        delete from private.motorista_mercadopago_autorizacoes_pendentes
        where motorista_id = _motorista_id;

        return 'ownership_conflict';
      end if;

      raise;
  end;

  delete from private.motorista_mercadopago_autorizacoes_pendentes
  where motorista_id = _motorista_id
    and mercadopago_user_id = _pending.mercadopago_user_id;

  return 'connected';
end;
$$;

revoke all on function public.pix_oauth_pending_authorization_status(uuid)
  from public, anon, authenticated;
grant execute on function public.pix_oauth_pending_authorization_status(uuid)
  to service_role;

revoke all on function public.pix_oauth_pending_authorization_confirm(uuid)
  from public, anon, authenticated;
grant execute on function public.pix_oauth_pending_authorization_confirm(uuid)
  to service_role;

comment on function public.pix_oauth_pending_authorization_status(uuid) is
  'Retorna somente a validade de uma autorização OAuth pendente ainda utilizável, sem expor conta ou tokens.';
comment on function public.pix_oauth_pending_authorization_confirm(uuid) is
  'Promove atomicamente uma autorização OAuth pendente para conexão ativa somente após confirmação explícita do motorista autenticado.';
