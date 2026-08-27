create function public.pix_oauth_pending_authorization_summary(
  _motorista_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  _mercadopago_user_id text;
  _confirmation_expires_at timestamptz;
  _reconnection boolean;
begin
  if _motorista_id is null then
    raise exception using
      errcode = '22023',
      message = 'PIX_MP_PENDING_SUMMARY_MOTORISTA_INVALIDO';
  end if;

  perform 1
  from public.motoristas m
  where m.id = _motorista_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'PIX_MP_PENDING_SUMMARY_MOTORISTA_NAO_ENCONTRADO';
  end if;

  select p.mercadopago_user_id, p.confirmation_expires_at
  into _mercadopago_user_id, _confirmation_expires_at
  from private.motorista_mercadopago_autorizacoes_pendentes p
  where p.motorista_id = _motorista_id
    and p.confirmation_expires_at > now()
    and p.token_expires_at > now();

  if not found then
    return null;
  end if;

  select exists (
    select 1
    from private.mercadopago_conta_propriedade h
    where h.mercadopago_user_id = _mercadopago_user_id
      and h.motorista_id = _motorista_id
  )
  into _reconnection;

  return jsonb_build_object(
    'confirmation_expires_at', _confirmation_expires_at,
    'account_hint', right(_mercadopago_user_id, least(4, char_length(_mercadopago_user_id))),
    'reconnection', _reconnection
  );
end;
$$;

create function public.pix_oauth_pending_authorization_cancel(
  _motorista_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if _motorista_id is null then
    raise exception using
      errcode = '22023',
      message = 'PIX_MP_PENDING_CANCEL_MOTORISTA_INVALIDO';
  end if;

  perform 1
  from public.motoristas m
  where m.id = _motorista_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'PIX_MP_PENDING_CANCEL_MOTORISTA_NAO_ENCONTRADO';
  end if;

  delete from private.motorista_mercadopago_autorizacoes_pendentes
  where motorista_id = _motorista_id;

  return found;
end;
$$;

drop function public.pix_oauth_pending_authorization_confirm(uuid);

create function public.pix_oauth_pending_authorization_confirm(
  _motorista_id uuid,
  _platform_mercadopago_user_id text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  _pending private.motorista_mercadopago_autorizacoes_pendentes%rowtype;
  _active_account_id text;
  _normalized_platform_user_id text;
begin
  if _motorista_id is null then
    raise exception using
      errcode = '22023',
      message = 'PIX_MP_PENDING_CONFIRM_MOTORISTA_INVALIDO';
  end if;

  _normalized_platform_user_id := btrim(coalesce(_platform_mercadopago_user_id, ''));
  if char_length(_normalized_platform_user_id) not between 1 and 128 then
    raise exception using
      errcode = '22023',
      message = 'PIX_MP_PLATFORM_USER_ID_INVALIDO';
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

  if _pending.mercadopago_user_id = _normalized_platform_user_id then
    delete from private.motorista_mercadopago_autorizacoes_pendentes
    where motorista_id = _motorista_id;

    return 'platform_account';
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

revoke all on function public.pix_oauth_pending_authorization_summary(uuid)
  from public, anon, authenticated;
grant execute on function public.pix_oauth_pending_authorization_summary(uuid)
  to service_role;

revoke all on function public.pix_oauth_pending_authorization_cancel(uuid)
  from public, anon, authenticated;
grant execute on function public.pix_oauth_pending_authorization_cancel(uuid)
  to service_role;

revoke all on function public.pix_oauth_pending_authorization_confirm(uuid, text)
  from public, anon, authenticated;
grant execute on function public.pix_oauth_pending_authorization_confirm(uuid, text)
  to service_role;

comment on function public.pix_oauth_pending_authorization_summary(uuid) is
  'Retorna somente validade, dica mascarada da conta e indicador de reconexão histórica da autorização OAuth pendente.';
comment on function public.pix_oauth_pending_authorization_cancel(uuid) is
  'Cancela a autorização OAuth pendente do motorista sem ativar credencial ou alterar propriedade histórica.';
comment on function public.pix_oauth_pending_authorization_confirm(uuid, text) is
  'Promove atomicamente uma autorização OAuth pendente após confirmação explícita, bloqueando a conta Mercado Pago da própria plataforma/integrador.';
