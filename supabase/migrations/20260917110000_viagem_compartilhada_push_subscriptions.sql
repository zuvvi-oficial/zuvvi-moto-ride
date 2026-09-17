-- Inscrições Web Push para quem acompanha uma corrida pelo link público
-- (sem conta, sem login) — mesma ideia da tabela public.push_subscriptions
-- já existente para usuários logados, mas ligada a viagens_compartilhadas
-- em vez de usuarios, já que aqui não existe usuario_id nenhum.
--
-- Nenhuma alteração em push_subscriptions, notificacoes, push_falhas_envio
-- ou qualquer política/RLS já existente — tabela nova e isolada.
create table public.viagem_compartilhada_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  viagem_compartilhada_id uuid not null references public.viagens_compartilhadas(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  constraint viagem_compartilhada_push_subscriptions_endpoint_unique unique (endpoint),
  constraint viagem_compartilhada_push_subscriptions_endpoint_not_blank check (btrim(endpoint) <> ''),
  constraint viagem_compartilhada_push_subscriptions_p256dh_not_blank check (btrim(p256dh) <> ''),
  constraint viagem_compartilhada_push_subscriptions_auth_not_blank check (btrim(auth) <> '')
);

create index viagem_compartilhada_push_subscriptions_viagem_idx
  on public.viagem_compartilhada_push_subscriptions (viagem_compartilhada_id);

alter table public.viagem_compartilhada_push_subscriptions enable row level security;
alter table public.viagem_compartilhada_push_subscriptions force row level security;

-- Sem policy nenhuma para anon/authenticated: toda escrita/leitura passa
-- pelas server functions públicas desta tela (validam o link primeiro),
-- usando o cliente admin (service_role) — igual ao padrão já usado para o
-- SOS desta mesma tela.
revoke all on table public.viagem_compartilhada_push_subscriptions from public, anon, authenticated;
grant all on table public.viagem_compartilhada_push_subscriptions to service_role;

comment on table public.viagem_compartilhada_push_subscriptions is
  'Inscrições Web Push de quem acompanha uma corrida pelo link público de viagem compartilhada (sem conta) — só escrita/leitura via server functions dedicadas, nunca direto do cliente.';
