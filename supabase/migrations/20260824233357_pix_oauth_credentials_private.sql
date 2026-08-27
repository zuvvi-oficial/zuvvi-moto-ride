create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table private.motorista_mercadopago_credenciais (
  motorista_id uuid primary key
    references public.motoristas(id) on delete cascade,
  mercadopago_user_id text not null,
  access_token_encrypted text,
  refresh_token_encrypted text,
  encryption_version smallint not null default 1,
  expires_at timestamptz not null,
  scope text,
  token_type text,
  connection_status text not null default 'active',
  connected_at timestamptz not null default now(),
  last_refreshed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint motorista_mp_user_id_trimmed_check
    check (
      mercadopago_user_id = btrim(mercadopago_user_id)
      and char_length(mercadopago_user_id) between 1 and 128
    ),
  constraint motorista_mp_encryption_version_check
    check (encryption_version > 0),
  constraint motorista_mp_connection_status_check
    check (connection_status in ('active', 'revoked', 'error')),
  constraint motorista_mp_token_state_check
    check (
      (
        connection_status in ('active', 'error')
        and access_token_encrypted is not null
        and char_length(access_token_encrypted) > 0
        and refresh_token_encrypted is not null
        and char_length(refresh_token_encrypted) > 0
        and revoked_at is null
      )
      or
      (
        connection_status = 'revoked'
        and access_token_encrypted is null
        and refresh_token_encrypted is null
        and revoked_at is not null
      )
    ),
  constraint motorista_mp_updated_after_created_check
    check (updated_at >= created_at)
);

create unique index motorista_mp_active_user_unique_idx
  on private.motorista_mercadopago_credenciais (mercadopago_user_id)
  where connection_status = 'active';

create index motorista_mp_active_expires_at_idx
  on private.motorista_mercadopago_credenciais (expires_at)
  where connection_status = 'active';

alter table private.motorista_mercadopago_credenciais enable row level security;
alter table private.motorista_mercadopago_credenciais force row level security;

revoke all on table private.motorista_mercadopago_credenciais
  from public, anon, authenticated;
grant select, insert, update, delete
  on table private.motorista_mercadopago_credenciais
  to service_role;

create function public.pix_oauth_credentials_upsert(
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
begin
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
    btrim(_mercadopago_user_id),
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
end;
$$;

create function public.pix_oauth_credentials_get(_motorista_id uuid)
returns table (
  motorista_id uuid,
  mercadopago_user_id text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  encryption_version smallint,
  expires_at timestamptz,
  scope text,
  token_type text,
  connection_status text,
  connected_at timestamptz,
  last_refreshed_at timestamptz,
  revoked_at timestamptz
)
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $$
  select
    c.motorista_id,
    c.mercadopago_user_id,
    c.access_token_encrypted,
    c.refresh_token_encrypted,
    c.encryption_version,
    c.expires_at,
    c.scope,
    c.token_type,
    c.connection_status,
    c.connected_at,
    c.last_refreshed_at,
    c.revoked_at
  from private.motorista_mercadopago_credenciais c
  where c.motorista_id = _motorista_id;
$$;

create function public.pix_oauth_credentials_revoke(_motorista_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  _updated boolean;
begin
  update private.motorista_mercadopago_credenciais
  set access_token_encrypted = null,
      refresh_token_encrypted = null,
      connection_status = 'revoked',
      revoked_at = now(),
      updated_at = now()
  where motorista_id = _motorista_id
    and connection_status <> 'revoked';

  _updated := found;
  return _updated;
end;
$$;

revoke all on function public.pix_oauth_credentials_upsert(
  uuid, text, text, text, smallint, timestamptz, text, text
) from public, anon, authenticated;
revoke all on function public.pix_oauth_credentials_get(uuid)
  from public, anon, authenticated;
revoke all on function public.pix_oauth_credentials_revoke(uuid)
  from public, anon, authenticated;

grant execute on function public.pix_oauth_credentials_upsert(
  uuid, text, text, text, smallint, timestamptz, text, text
) to service_role;
grant execute on function public.pix_oauth_credentials_get(uuid)
  to service_role;
grant execute on function public.pix_oauth_credentials_revoke(uuid)
  to service_role;

comment on table private.motorista_mercadopago_credenciais is
  'Envelopes OAuth Mercado Pago criptografados no servidor. Nunca expor à Data API pública.';
comment on function public.pix_oauth_credentials_upsert(
  uuid, text, text, text, smallint, timestamptz, text, text
) is 'Uso exclusivo do servidor para gravar credenciais OAuth já criptografadas.';
comment on function public.pix_oauth_credentials_get(uuid) is
  'Uso exclusivo do servidor para obter credenciais OAuth criptografadas.';
comment on function public.pix_oauth_credentials_revoke(uuid) is
  'Uso exclusivo do servidor para revogar e apagar envelopes OAuth persistidos.';
