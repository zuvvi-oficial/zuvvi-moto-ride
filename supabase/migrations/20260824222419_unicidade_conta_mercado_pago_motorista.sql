create unique index idx_motoristas_conta_mercado_pago_unica
  on public.motoristas using btree (conta_mercado_pago_id)
  where conta_mercado_pago_id is not null;
