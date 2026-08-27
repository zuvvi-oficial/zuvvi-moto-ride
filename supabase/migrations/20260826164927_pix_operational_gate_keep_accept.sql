drop trigger if exists pix_hold_corrida_until_payment_trigger on public.corridas;

create or replace function public.pix_guard_operational_before_payment()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_payment_status public.pagamento_status;
begin
  if old.forma_pagamento = 'pix'::public.forma_pagamento
     and old.status in (
       'aceita'::public.corrida_status,
       'aguardando_pagamento'::public.corrida_status
     )
     and new.status in (
       'motorista_a_caminho'::public.corrida_status,
       'motorista_chegou'::public.corrida_status,
       'em_andamento'::public.corrida_status,
       'concluida'::public.corrida_status
     ) then
    select p.status
      into v_payment_status
      from public.pagamentos p
     where p.corrida_id = old.id
       and p.meio = 'pix'::public.forma_pagamento;

    if v_payment_status is distinct from 'pago'::public.pagamento_status then
      raise exception using
        errcode = 'P0001',
        message = 'PIX_PAYMENT_NOT_CONFIRMED';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists pix_guard_operational_before_payment_trigger on public.corridas;
create trigger pix_guard_operational_before_payment_trigger
before update of status on public.corridas
for each row
execute function public.pix_guard_operational_before_payment();
