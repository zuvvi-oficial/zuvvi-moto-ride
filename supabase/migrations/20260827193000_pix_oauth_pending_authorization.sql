create table private.motorista_mercadopago_autorizacoes_pendentes (
  motorista_id uuid primary key,
  mercadopago_user_id text not null unique,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  encryption_version smallint not null,
  token_expires_at timestamptz not null,
  scope text,
  token_type text,
  confirmation_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mp_oauth_pending_user_id_check
    check (
      mercadopago_user_id = btrim(mercadopago_user_id)
      and char_length(mercadopago_user_id) between 1 and 128
    ),
  constraint mp_oauth_pending_access_envelope_check
    check (char_length(access_token_encrypted) between 1 and 8192),
  constraint mp_oauth_pending_refresh_envelope_check
    check (char_length(refresh_token_encrypted) between 1 and 8192),
  constraint mp_oauth_pending_encryption_version_check
    check (encryption_version > 0),
  constraint mp_oauth_pending_confirmation_window_check
    check (confirmation_expires_at > created_at)
);

create index mp_oauth_pending_confirmation_expires_idx
  on private.motorista_mercadopago_autorizacoes_pendentes (confirmation_expires_at);

alter table private.motorista_mercadopago_autorizacoes_pendentes enable row level security;
alter table private.motorista_mercadopago_autorizacoes_pendentes force row level security;

revoke all on table private.motorista_mercadopago_autorizacoes_pendentes
  from public, anon, authenticated, service_role;

create function public.pix_oauth_pending_authorization_upsert(
  _motorista_id uuid,
  _mercadopago_user_id text,
  _access_token_encrypted text,
  _refresh_token_encrypted text,
  _encryption_version smallint,
  _token_expires_at timestamptz,
  _scope text default null,
  _token_type text default null
)
returns timestamptz
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  _normalized_mercadopago_user_id text;
  _historical_owner uuid;
  _pending_owner uuid;
  _confirmation_expires_at timestamptz;
begin
  if _motorista_id is null then
    raise exception using
      errcode = '22023',
      message = 'PIX_MP_PENDING_MOTORISTA_INVALIDO';
  end if;

  _normalized_mercadopago_user_id := btrim(coalesce(_mercadopago_user_id, ''));

  if char_length(_normalized_mercadopago_user_id) not between 1 and 128 then
    raise exception using
      errcode = '22023',
      message = 'PIX_MP_PENDING_USER_ID_INVALIDO';
  end if;

  if coalesce(char_length(_access_token_encrypted), 0) not between 1 and 8192
     or coalesce(char_length(_refresh_token_encrypted), 0) not between 1 and 8192
     or coalesce(_encryption_version, 0) < 1
     or _token_expires_at is null
     or _token_expires_at <= now() then
    raise exception using
      errcode = '22023',
      message = 'PIX_MP_PENDING_PAYLOAD_INVALIDO';
  end if;

  perform 1
  from public.motoristas m
  where m.id = _motorista_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'PIX_MP_PENDING_MOTORISTA_NAO_ENCONTRADO';
  end if;

  delete from private.motorista_mercadopago_autorizacoes_pendentes
  where confirmation_expires_at <= now();

  select p.motorista_id
  into _historical_owner
  from private.mercadopago_conta_propriedade p
  where p.mercadopago_user_id = _normalized_mercadopago_user_id;

  if found and _historical_owner <> _motorista_id then
    raise exception using
      errcode = '23505',
      message = 'PIX_MP_ACCOUNT_OWNED_BY_OTHER_MOTORISTA';
  end if;

  select p.motorista_id
  into _pending_owner
  from private.motorista_mercadopago_autorizacoes_pendentes p
  where p.mercadopago_user_id = _normalized_mercadopago_user_id
    and p.confirmation_expires_at > now()
    and p.motorista_id <> _motorista_id;

  if found then
    raise exception using
      errcode = '23505',
      message = 'PIX_MP_ACCOUNT_PENDING_BY_OTHER_MOTORISTA';
  end if;

  _confirmation_expires_at := now() + interval '10 minutes';

  insert into private.motorista_mercadopago_autorizacoes_pendentes (
    motorista_id,
    mercadopago_user_id,
    access_token_encrypted,
    refresh_token_encrypted,
    encryption_version,
    token_expires_at,
    scope,
    token_type,
    confirmation_expires_at,
    created_at,
    updated_at
  ) values (
    _motorista_id,
    _normalized_mercadopago_user_id,
    _access_token_encrypted,
    _refresh_token_encrypted,
    _encryption_version,
    _token_expires_at,
    nullif(btrim(_scope), ''),
    nullif(btrim(_token_type), ''),
    _confirmation_expires_at,
    now(),
    now()
  )
  on conflict (motorista_id) do update
  set mercadopago_user_id = excluded.mercadopago_user_id,
      access_token_encrypted = excluded.access_token_encrypted,
      refresh_token_encrypted = excluded.refresh_token_encrypted,
      encryption_version = excluded.encryption_version,
      token_expires_at = excluded.token_expires_at,
      scope = excluded.scope,
      token_type = excluded.token_type,
      confirmation_expires_at = excluded.confirmation_expires_at,
      created_at = now(),
      updated_at = now();

  return _confirmation_expires_at;
exception
  when unique_violation then
    raise exception using
      errcode = '23505',
      message = 'PIX_MP_ACCOUNT_PENDING_BY_OTHER_MOTORISTA';
end;
$$;

revoke all on function public.pix_oauth_pending_authorization_upsert(
  uuid, text, text, text, smallint, timestamptz, text, text
) from public, anon, authenticated;
grant execute on function public.pix_oauth_pending_authorization_upsert(
  uuid, text, text, text, smallint, timestamptz, text, text
) to service_role;

comment on table private.motorista_mercadopago_autorizacoes_pendentes is
  'Autorização OAuth Mercado Pago temporária e cifrada. Não representa conta conectada e expira antes da confirmação explícita.';
comment on function public.pix_oauth_pending_authorization_upsert(
  uuid, text, text, text, smallint, timestamptz, text, text
) is
  'Persiste autorização OAuth pendente por 10 minutos sem ativar credencial, sem atualizar motorista e sem reivindicar propriedade histórica nova.';
