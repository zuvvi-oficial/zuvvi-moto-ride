create table if not exists public.pagamentos_pix_device_sessions (
  passageiro_id uuid primary key references public.usuarios(id) on delete cascade,
  device_id text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pagamentos_pix_device_sessions_device_id_check
    check (
      device_id = btrim(device_id)
      and char_length(device_id) between 8 and 512
      and device_id !~ '[[:cntrl:]]'
    )
);

comment on table public.pagamentos_pix_device_sessions is
  'Device ID Mercado Pago temporario do passageiro, usado apenas no antifraude da cobranca Pix.';

alter table public.pagamentos_pix_device_sessions enable row level security;
revoke all on table public.pagamentos_pix_device_sessions from anon, authenticated;
grant select, insert, update, delete on table public.pagamentos_pix_device_sessions to service_role;

create index if not exists pagamentos_pix_device_sessions_expires_at_idx
  on public.pagamentos_pix_device_sessions(expires_at);
