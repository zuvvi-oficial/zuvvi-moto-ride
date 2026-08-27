create table private.mercadopago_conta_propriedade (
  mercadopago_user_id text primary key,
  motorista_id uuid not null,
  claimed_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint mercadopago_conta_propriedade_user_id_check
    check (
      mercadopago_user_id = btrim(mercadopago_user_id)
      and char_length(mercadopago_user_id) between 1 and 128
    ),
  constraint mercadopago_conta_propriedade_timestamps_check
    check (last_seen_at >= claimed_at)
);

create index mercadopago_conta_propriedade_motorista_idx
  on private.mercadopago_conta_propriedade (motorista_id);

alter table private.mercadopago_conta_propriedade enable row level security;
alter table private.mercadopago_conta_propriedade force row level security;

revoke all on table private.mercadopago_conta_propriedade
  from public, anon, authenticated, service_role;

-- Backfill deliberadamente limitado a conexões ativas.
-- Credenciais revogadas anteriores a esta migration podem representar testes/erros
-- históricos e não são transformadas automaticamente em propriedade permanente.
do $$
begin
  if exists (
    select 1
    from private.motorista_mercadopago_credenciais c
    where c.connection_status = 'active'
    group by c.mercadopago_user_id
    having count(distinct c.motorista_id) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'PIX_MP_HISTORICAL_OWNERSHIP_BACKFILL_CONFLICT';
  end if;
end;
$$;

insert into private.mercadopago_conta_propriedade (
  mercadopago_user_id,
  motorista_id,
  claimed_at,
  last_seen_at
)
select
  btrim(c.mercadopago_user_id),
  c.motorista_id,
  least(c.created_at, c.connected_at),
  greatest(c.created_at, c.connected_at, c.last_refreshed_at, c.updated_at)
from private.motorista_mercadopago_credenciais c
where c.connection_status = 'active'
on conflict (mercadopago_user_id) do update
set last_seen_at = greatest(
      private.mercadopago_conta_propriedade.last_seen_at,
      excluded.last_seen_at
    )
where private.mercadopago_conta_propriedade.motorista_id = excluded.motorista_id;

create function public.pix_oauth_account_owner_claim(
  _motorista_id uuid,
  _mercadopago_user_id text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  _normalized_mercadopago_user_id text;
  _existing_motorista_id uuid;
  _inserted_count integer;
begin
  if _motorista_id is null then
    raise exception using
      errcode = '22023',
      message = 'PIX_MP_OWNER_MOTORISTA_INVALIDO';
  end if;

  _normalized_mercadopago_user_id := btrim(coalesce(_mercadopago_user_id, ''));

  if char_length(_normalized_mercadopago_user_id) not between 1 and 128 then
    raise exception using
      errcode = '22023',
      message = 'PIX_MP_OWNER_USER_ID_INVALIDO';
  end if;

  perform 1
  from public.motoristas m
  where m.id = _motorista_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'PIX_MP_OWNER_MOTORISTA_NAO_ENCONTRADO';
  end if;

  insert into private.mercadopago_conta_propriedade (
    mercadopago_user_id,
    motorista_id,
    claimed_at,
    last_seen_at
  )
  values (
    _normalized_mercadopago_user_id,
    _motorista_id,
    now(),
    now()
  )
  on conflict (mercadopago_user_id) do nothing;

  get diagnostics _inserted_count = row_count;

  if _inserted_count = 1 then
    return 'claimed';
  end if;

  select p.motorista_id
  into _existing_motorista_id
  from private.mercadopago_conta_propriedade p
  where p.mercadopago_user_id = _normalized_mercadopago_user_id
  for update;

  if _existing_motorista_id = _motorista_id then
    update private.mercadopago_conta_propriedade
    set last_seen_at = now()
    where mercadopago_user_id = _normalized_mercadopago_user_id;

    return 'owned_by_same_motorista';
  end if;

  return 'owned_by_other_motorista';
end;
$$;

revoke all on function public.pix_oauth_account_owner_claim(uuid, text)
  from public, anon, authenticated;
grant execute on function public.pix_oauth_account_owner_claim(uuid, text)
  to service_role;

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
  _ownership_status text;
begin
  _normalized_mercadopago_user_id := btrim(_mercadopago_user_id);

  _ownership_status := public.pix_oauth_account_owner_claim(
    _motorista_id,
    _normalized_mercadopago_user_id
  );

  if _ownership_status = 'owned_by_other_motorista' then
    raise exception using
      errcode = '23505',
      message = 'PIX_MP_ACCOUNT_OWNED_BY_OTHER_MOTORISTA';
  end if;

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

comment on table private.mercadopago_conta_propriedade is
  'Reserva histórica permanente da conta Mercado Pago por motorista. Sem tokens. Não apagar na desconexão.';
comment on column private.mercadopago_conta_propriedade.motorista_id is
  'Sem FK deliberadamente: a reserva histórica deve sobreviver ao ciclo de vida do cadastro sem bloquear deleção do core.';
comment on function public.pix_oauth_account_owner_claim(uuid, text) is
  'Uso exclusivo do servidor para reivindicar ou validar a propriedade histórica de uma conta Mercado Pago.';
comment on function public.pix_oauth_credentials_upsert(
  uuid, text, text, text, smallint, timestamptz, text, text
) is 'Grava credenciais OAuth e projeção pública somente após validar propriedade histórica da conta Mercado Pago.';
