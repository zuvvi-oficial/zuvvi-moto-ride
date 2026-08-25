-- Fixture exclusiva do teste isolado PIX-07R.
-- Não é migration, seed oficial nem reprodução completa do schema Zuvvi.

alter table public.motoristas
  add column conta_mercado_pago_id text;
