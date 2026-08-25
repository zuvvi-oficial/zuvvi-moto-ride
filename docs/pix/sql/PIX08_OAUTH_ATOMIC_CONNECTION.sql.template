create or replace function public.pix_oauth_credentials_upsert(
  _motorista_id uuid,
  _mercadopago_user_id text,
  _access_token_encrypted text,
  _refresh_token_encrypted text,
  _encryption_version smallint,
  _expires_at timestamptz,
  _scope text default null,
  _token_type text default null
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  _normalized_mercadopago_user_id text;
begin
  _normalized_mercadopago_user_id := btrim(_mercadopago_user_id);

  insert into private.motorista_mercadopago_credenciais (
    motorista_id,
    mercadopago_user_id,
    access_token_encrypted,
    refresh_token_encrypted,
    encryption_version,
    expires_at,
    scope,
    token_type,
    connection_status,
    connected_at,
    last_refreshed_at,
    revoked_at,
    created_at,
    updated_at
  )
  values (
    _motorista_id,
    _normalized_mercadopago_user_id,
    _access_token_encrypted,
    _refresh_token_encrypted,
    _encryption_version,
    _expires_at,
    nullif(btrim(_scope), ''),
    nullif(btrim(_token_type), ''),
    'active',
    now(),
    now(),
    null,
    now(),
    now()
  )
  on conflict (motorista_id) do update
  set mercadopago_user_id = excluded.mercadopago_user_id,
      access_token_encrypted = excluded.access_token_encrypted,
      refresh_token_encrypted = excluded.refresh_token_encrypted,
      encryption_version = excluded.encryption_version,
      expires_at = excluded.expires_at,
      scope = excluded.scope,
      token_type = excluded.token_type,
      connection_status = 'active',
      connected_at = case
        when private.motorista_mercadopago_credenciais.connection_status = 'revoked'
          then now()
        else private.motorista_mercadopago_credenciais.connected_at
      end,
      last_refreshed_at = now(),
      revoked_at = null,
      updated_at = now();

  update public.motoristas
  set conta_mercado_pago_id = _normalized_mercadopago_user_id
  where id = _motorista_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Motorista OAuth inexistente.';
  end if;
end;
$$;

revoke all on function public.pix_oauth_credentials_upsert(
  uuid, text, text, text, smallint, timestamptz, text, text
) from public, anon, authenticated;

grant execute on function public.pix_oauth_credentials_upsert(
  uuid, text, text, text, smallint, timestamptz, text, text
) to service_role;

comment on function public.pix_oauth_credentials_upsert(
  uuid, text, text, text, smallint, timestamptz, text, text
) is 'Uso exclusivo do servidor para gravar atomicamente credenciais OAuth criptografadas e sua projeção pública.';
