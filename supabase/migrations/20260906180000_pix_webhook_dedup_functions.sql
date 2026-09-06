-- O schema private não é exposto via PostgREST, então o handler HTTP do
-- webhook (service_role) só consegue registrar/finalizar eventos em
-- private.mercadopago_webhook_eventos através de funções SECURITY DEFINER
-- em public, seguindo o mesmo padrão já usado pelas funções pix_oauth_*.

create or replace function public.pix_mercadopago_webhook_register_event(
  p_event_key text,
  p_request_id text,
  p_topic text,
  p_action text,
  p_resource_id text,
  p_payload_hash text
)
returns table (is_new boolean, processing_status text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_status text;
begin
  if btrim(coalesce(p_event_key, '')) = '' then
    raise exception 'event_key não pode ser vazio';
  end if;

  insert into private.mercadopago_webhook_eventos (
    event_key, request_id, topic, action, resource_id, payload_hash
  ) values (
    p_event_key, p_request_id, p_topic, p_action, p_resource_id, p_payload_hash
  )
  on conflict (event_key) do nothing;

  if found then
    return query select true, 'received'::text;
    return;
  end if;

  select mwe.processing_status into v_status
  from private.mercadopago_webhook_eventos mwe
  where mwe.event_key = p_event_key;

  return query select false, v_status;
end;
$$;

revoke all on function public.pix_mercadopago_webhook_register_event(text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.pix_mercadopago_webhook_register_event(text, text, text, text, text, text)
  to service_role;

create or replace function public.pix_mercadopago_webhook_finalizar_evento(
  p_event_key text,
  p_status text,
  p_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_status not in ('processed', 'failed') then
    raise exception 'status inválido para finalização de evento: %', p_status;
  end if;

  update private.mercadopago_webhook_eventos
  set processing_status = p_status,
      processing_attempts = processing_attempts + 1,
      processed_at = case when p_status = 'processed' then now() else processed_at end,
      error_code = p_error_code
  where event_key = p_event_key;
end;
$$;

revoke all on function public.pix_mercadopago_webhook_finalizar_evento(text, text, text)
  from public, anon, authenticated;
grant execute on function public.pix_mercadopago_webhook_finalizar_evento(text, text, text)
  to service_role;

comment on function public.pix_mercadopago_webhook_register_event is
  'Registra uma notificação webhook do Mercado Pago de forma deduplicada por event_key; retorna se é um evento novo e o status de processamento atual.';
comment on function public.pix_mercadopago_webhook_finalizar_evento is
  'Marca um evento de webhook do Mercado Pago já registrado como processado ou falho, incrementando processing_attempts.';
