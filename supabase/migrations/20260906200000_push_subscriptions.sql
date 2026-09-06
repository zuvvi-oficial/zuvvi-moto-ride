-- B5: notificações eram só in-app (tabela notificacoes lida via Realtime),
-- sem nenhum jeito de alcançar o usuário com o app fechado. Esta tabela
-- guarda as inscrições Web Push (endpoint + chaves p256dh/auth) por
-- usuário/dispositivo, usadas por src/lib/web-push.server.ts para enviar
-- notificações reais além do sino in-app.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_unique unique (endpoint),
  constraint push_subscriptions_endpoint_not_blank check (btrim(endpoint) <> ''),
  constraint push_subscriptions_p256dh_not_blank check (btrim(p256dh) <> ''),
  constraint push_subscriptions_auth_not_blank check (btrim(auth) <> '')
);

create index push_subscriptions_usuario_idx on public.push_subscriptions (usuario_id);

alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;

revoke all on table public.push_subscriptions from public, anon;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;
grant all on table public.push_subscriptions to service_role;

create policy "Usuarios gerenciam sua propria inscricao push"
on public.push_subscriptions
for all
to authenticated
using (usuario_id in (select id from public.usuarios where auth_user_id = auth.uid()))
with check (usuario_id in (select id from public.usuarios where auth_user_id = auth.uid()));

comment on table public.push_subscriptions is
  'Inscrições Web Push (endpoint + chaves p256dh/auth) por usuário/dispositivo, para notificações reais além do sino in-app.';
