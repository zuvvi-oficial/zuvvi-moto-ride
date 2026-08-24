-- Fixture exclusiva do teste isolado PIX-01.
-- Não é migration, seed oficial nem reprodução completa do schema Zuvvi.

create table public.usuarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  perfil_ativo text not null default 'passageiro',
  is_passageiro boolean default true,
  is_motorista boolean default false
);

create table public.motoristas (
  id uuid primary key
    references public.usuarios(id) on delete cascade
);
