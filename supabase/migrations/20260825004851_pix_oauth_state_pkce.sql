create table private.mercadopago_oauth_tentativas (
  id uuid primary key default gen_random_uuid(),
  motorista_id uuid not null
    references public.motoristas(id) on delete cascade,
  state_hash text not null,
  code_verifier_encrypted text not null,
  encryption_version smallint not null default 1,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint mercadopago_oauth_state_hash_unique
    unique (state_hash),
  constraint mercadopago_oauth_state_hash_check
    check (state_hash ~ '^[0-9a-f]{64}$'),
  constraint mercadopago_oauth_verifier_envelope_check
    check (
      char_length(btrim(code_verifier_encrypted)) between 1 and 8192
    ),
  constraint mercadopago_oauth_encryption_version_check
    check (encryption_version > 0),
  constraint mercadopago_oauth_expiration_window_check
    check (
      expires_at > created_at
      and expires_at <= created_at + interval '10 minutes'
    ),
  constraint mercadopago_oauth_consumed_at_check
    check (consumed_at is null or consumed_at >= created_at)
);

create index mercadopago_oauth_pending_expiration_idx
  on private.mercadopago_oauth_tentativas (expires_at)
  where consumed_at is null;

alter table private.mercadopago_oauth_tentativas enable row level security;
alter table private.mercadopago_oauth_tentativas force row level security;

revoke all on table private.mercadopago_oauth_tentativas
  from public, anon, authenticated;
grant select, insert, update
  on table private.mercadopago_oauth_tentativas
  to service_role;

create function public.pix_oauth_state_create(
  _motorista_id uuid,
  _state_hash text,
  _code_verifier_encrypted text,
  _encryption_version smallint,
  _expires_at timestamptz
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  insert into private.mercadopago_oauth_tentativas (
    motorista_id,
    state_hash,
    code_verifier_encrypted,
    encryption_version,
    expires_at
  )
  values (
    _motorista_id,
    _state_hash,
    _code_verifier_encrypted,
    _encryption_version,
    _expires_at
  )
  returning id;
$$;

create function public.pix_oauth_state_consume(
  _motorista_id uuid,
  _state_hash text
)
returns table (
  encrypted_code_verifier text,
  envelope_version smallint
)
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  update private.mercadopago_oauth_tentativas t
  set consumed_at = now()
  where t.motorista_id = _motorista_id
    and t.state_hash = _state_hash
    and t.consumed_at is null
    and t.expires_at > now()
  returning t.code_verifier_encrypted, t.encryption_version;
$$;

revoke all on function public.pix_oauth_state_create(
  uuid, text, text, smallint, timestamptz
) from public, anon, authenticated;
revoke all on function public.pix_oauth_state_consume(uuid, text)
  from public, anon, authenticated;

grant execute on function public.pix_oauth_state_create(
  uuid, text, text, smallint, timestamptz
) to service_role;
grant execute on function public.pix_oauth_state_consume(uuid, text)
  to service_role;

comment on table private.mercadopago_oauth_tentativas is
  'Tentativas OAuth Mercado Pago de uso único. Guarda apenas hash do state e envelope cifrado do code_verifier PKCE.';
comment on function public.pix_oauth_state_create(
  uuid, text, text, smallint, timestamptz
) is 'Uso exclusivo do servidor para registrar state OAuth e code_verifier PKCE cifrado por até dez minutos.';
comment on function public.pix_oauth_state_consume(uuid, text) is
  'Uso exclusivo do servidor para consumir atomicamente uma tentativa OAuth válida uma única vez.';
