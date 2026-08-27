create or replace function public.pix_oauth_disconnect_safe(
  _motorista_id uuid
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform 1
  from public.motoristas m
  where m.id = _motorista_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'PIX_OAUTH_MOTORISTA_NAO_ENCONTRADO';
  end if;

  if exists (
    select 1
    from public.corridas c
    where c.motorista_id = _motorista_id
      and c.forma_pagamento = 'pix'::public.forma_pagamento
      and c.status in (
        'aceita'::public.corrida_status,
        'motorista_a_caminho'::public.corrida_status,
        'motorista_chegou'::public.corrida_status,
        'em_andamento'::public.corrida_status
      )
  ) then
    return 'blocked_active_pix';
  end if;

  if exists (
    select 1
    from public.pagamentos_pix_tentativas t
    join public.pagamentos p on p.id = t.pagamento_id
    join public.corridas c on c.id = p.corrida_id
    where t.motorista_id = _motorista_id
      and (
        t.estado_interno in ('criando', 'pendente')
        or (
          t.estado_interno = 'pago'
          and p.status <> 'estornado'::public.pagamento_status
          and not (
            p.status = 'pago'::public.pagamento_status
            and c.status = 'concluida'::public.corrida_status
          )
        )
      )
  ) then
    return 'blocked_financial';
  end if;

  if exists (
    select 1
    from public.corridas c
    join public.pagamentos p on p.corrida_id = c.id
    where c.motorista_id = _motorista_id
      and c.forma_pagamento = 'pix'::public.forma_pagamento
      and p.meio = 'pix'::public.forma_pagamento
      and p.status = 'pago'::public.pagamento_status
      and c.status <> 'concluida'::public.corrida_status
  ) then
    return 'blocked_financial';
  end if;

  update private.motorista_mercadopago_credenciais
  set access_token_encrypted = null,
      refresh_token_encrypted = null,
      connection_status = 'revoked',
      revoked_at = now(),
      updated_at = now()
  where motorista_id = _motorista_id
    and connection_status <> 'revoked';

  update public.motoristas
  set conta_mercado_pago_id = null,
      updated_at = now()
  where id = _motorista_id;

  return 'disconnected';
end;
$$;

revoke all on function public.pix_oauth_disconnect_safe(uuid)
  from public, anon, authenticated;
grant execute on function public.pix_oauth_disconnect_safe(uuid)
  to service_role;

comment on function public.pix_oauth_disconnect_safe(uuid) is
  'Etapa 2: desconecta OAuth atomicamente somente sem corrida Pix ativa ou obrigação financeira pendente.';
