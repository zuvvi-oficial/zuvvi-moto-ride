do $$
begin
  if exists (
    select 1
    from public.pagamentos
    group by corrida_id
    having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'ETAPA3_PAGAMENTO_AGREGADO_DUPLICADO';
  end if;
end
$$;

create unique index pagamentos_corrida_unique_idx
  on public.pagamentos (corrida_id);

create or replace function public.criar_corrida_financeira_atomica(
  p_passageiro_id uuid,
  p_cidade_id uuid,
  p_origem_lat numeric,
  p_origem_lng numeric,
  p_destino_lat numeric,
  p_destino_lng numeric,
  p_valor_estimado numeric,
  p_forma_pagamento public.forma_pagamento,
  p_codigo_embarque text,
  p_origem_nome text,
  p_destino_nome text,
  p_valor_total numeric,
  p_valor_motorista numeric,
  p_valor_comissao numeric
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_corrida_id uuid;
  v_corrida_existente record;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('zuvvi:create-ride:' || p_passageiro_id::text, 0)
  );

  select c.id,
         c.origem_lat,
         c.origem_lng,
         c.destino_lat,
         c.destino_lng,
         c.valor_estimado,
         c.forma_pagamento,
         c.created_at
    into v_corrida_existente
    from public.corridas c
   where c.passageiro_id = p_passageiro_id
     and c.status in (
       'solicitada'::public.corrida_status,
       'buscando_motorista'::public.corrida_status,
       'aceita'::public.corrida_status,
       'motorista_a_caminho'::public.corrida_status,
       'motorista_chegou'::public.corrida_status,
       'em_andamento'::public.corrida_status
     )
   order by c.created_at desc
   limit 1;

  if found then
    if v_corrida_existente.created_at >= now() - interval '2 minutes'
       and v_corrida_existente.origem_lat = p_origem_lat
       and v_corrida_existente.origem_lng = p_origem_lng
       and v_corrida_existente.destino_lat = p_destino_lat
       and v_corrida_existente.destino_lng = p_destino_lng
       and v_corrida_existente.valor_estimado = p_valor_estimado
       and v_corrida_existente.forma_pagamento = p_forma_pagamento
       and exists (
         select 1
           from public.pagamentos p
          where p.corrida_id = v_corrida_existente.id
       ) then
      return v_corrida_existente.id;
    end if;

    raise exception using
      errcode = '23505',
      message = 'ETAPA3_PASSAGEIRO_JA_POSSUI_CORRIDA_ATIVA';
  end if;

  insert into public.corridas (
    passageiro_id,
    cidade_id,
    origem_lat,
    origem_lng,
    destino_lat,
    destino_lng,
    valor_estimado,
    forma_pagamento,
    codigo_embarque,
    status,
    origem_nome,
    destino_nome
  ) values (
    p_passageiro_id,
    p_cidade_id,
    p_origem_lat,
    p_origem_lng,
    p_destino_lat,
    p_destino_lng,
    p_valor_estimado,
    p_forma_pagamento,
    p_codigo_embarque,
    'solicitada'::public.corrida_status,
    p_origem_nome,
    p_destino_nome
  )
  returning id into v_corrida_id;

  insert into public.pagamentos (
    corrida_id,
    meio,
    valor_total,
    valor_motorista,
    valor_comissao,
    status
  ) values (
    v_corrida_id,
    p_forma_pagamento,
    p_valor_total,
    p_valor_motorista,
    p_valor_comissao,
    'pendente'::public.pagamento_status
  );

  return v_corrida_id;
end;
$$;

revoke execute on function public.criar_corrida_financeira_atomica(
  uuid, uuid, numeric, numeric, numeric, numeric, numeric,
  public.forma_pagamento, text, text, text, numeric, numeric, numeric
) from public, anon, authenticated;

grant execute on function public.criar_corrida_financeira_atomica(
  uuid, uuid, numeric, numeric, numeric, numeric, numeric,
  public.forma_pagamento, text, text, text, numeric, numeric, numeric
) to service_role;
