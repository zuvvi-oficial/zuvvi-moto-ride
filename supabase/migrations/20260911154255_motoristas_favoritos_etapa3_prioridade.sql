-- Etapa 3 do recurso "motorista fixo/preferido": quando o passageiro tem um
-- motorista favorito disponível na mesma cidade no momento da criação da
-- corrida, ele recebe a oferta primeiro, com uma janela curta antes de virar
-- oferta geral. Essa janela é reforçada em três camadas independentes:
-- (1) criarCorrida escolhe o favorito e grava a janela nestas colunas;
-- (2) getOfertasDisponiveis esconde a corrida de outros motoristas enquanto
--     a janela não expirar; (3) accept_corrida_atomic (abaixo) bloqueia o
--     aceite de qualquer motorista que não seja o favorito enquanto a janela
--     estiver aberta — defesa em profundidade, já que (1) e (2) são só
--     aplicação, e um motorista poderia chamar a RPC de aceite diretamente.

alter table public.corridas
  add column motorista_favorito_id uuid null references public.motoristas(id),
  add column prioridade_favorito_expira_em timestamptz null;

create index corridas_motorista_favorito_id_idx
  on public.corridas (motorista_favorito_id)
  where motorista_favorito_id is not null;

create or replace function public.accept_corrida_atomic(
  p_corrida_id uuid,
  p_motorista_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_motorista_aprovacao public.motorista_status_aprovacao;
  v_is_disponivel boolean;
  v_cidade_id uuid;
  v_count_ativas integer;
  v_forma_pagamento public.forma_pagamento;
  v_conta_mercado_pago_id text;
  v_credential_status text;
  v_credential_user_id text;
  v_credential_expires_at timestamptz;
  v_credential_revoked_at timestamptz;
begin
  -- Mantém exatamente as travas operacionais preexistentes do motorista.
  select
    m.status_aprovacao,
    m.is_disponivel,
    u.cidade_id,
    m.conta_mercado_pago_id
  into
    v_motorista_aprovacao,
    v_is_disponivel,
    v_cidade_id,
    v_conta_mercado_pago_id
  from public.motoristas m
  join public.usuarios u on u.id = m.id
  where m.id = p_motorista_id
  for update;

  if v_motorista_aprovacao is null then
    raise exception 'Motorista não encontrado' using errcode = 'P0002';
  end if;

  if v_motorista_aprovacao::text != 'aprovado' then
    raise exception 'Motorista não está aprovado' using errcode = 'P0001';
  end if;

  if not v_is_disponivel then
    raise exception 'Motorista não está disponível' using errcode = 'P0001';
  end if;

  if v_cidade_id is null then
    raise exception 'Motorista não possui cidade vinculada' using errcode = 'P0001';
  end if;

  select count(*) into v_count_ativas
  from public.corridas
  where motorista_id = p_motorista_id
    and status in ('aceita', 'motorista_a_caminho', 'motorista_chegou', 'em_andamento');

  if v_count_ativas > 0 then
    raise exception 'Motorista já possui uma corrida ativa' using errcode = 'P0001';
  end if;

  -- Bloqueia a corrida candidata antes da validação Pix e preserva os mesmos
  -- critérios do UPDATE preexistente. Etapa 3: se houver motorista favorito
  -- com prioridade ainda aberta, só ele pode passar por este SELECT — para
  -- qualquer outro motorista a corrida simplesmente não é encontrada aqui,
  -- caindo no mesmo "not found" de sempre.
  select c.forma_pagamento
    into v_forma_pagamento
    from public.corridas c
   where c.id = p_corrida_id
     and c.status = 'solicitada'
     and c.motorista_id is null
     and c.cidade_id = v_cidade_id
     and (
       c.motorista_favorito_id is null
       or c.motorista_favorito_id = p_motorista_id
       or now() >= c.prioridade_favorito_expira_em
     )
   for update;

  if not found then
    raise exception 'Corrida indisponível ou cidade incompatível' using errcode = 'P0001';
  end if;

  -- Única alteração comportamental da Etapa 4: somente Pix exige revalidação
  -- da projeção pública contra a credencial privada ativa do mesmo motorista.
  if v_forma_pagamento = 'pix'::public.forma_pagamento then
    select
      c.connection_status,
      c.mercadopago_user_id,
      c.expires_at,
      c.revoked_at
    into
      v_credential_status,
      v_credential_user_id,
      v_credential_expires_at,
      v_credential_revoked_at
    from private.motorista_mercadopago_credenciais c
    where c.motorista_id = p_motorista_id;

    if v_conta_mercado_pago_id is null
       or v_credential_status is distinct from 'active'
       or v_credential_user_id is distinct from v_conta_mercado_pago_id
       or v_credential_expires_at is null
       or v_credential_expires_at <= now()
       or v_credential_revoked_at is not null then
      raise exception 'Conta Mercado Pago inválida para corrida Pix' using errcode = 'P0001';
    end if;
  end if;

  update public.corridas
  set
    motorista_id = p_motorista_id,
    status = 'aceita',
    data_aceite = now(),
    updated_at = now()
  where id = p_corrida_id
    and status = 'solicitada'
    and motorista_id is null
    and cidade_id = v_cidade_id
    and (
      motorista_favorito_id is null
      or motorista_favorito_id = p_motorista_id
      or now() >= prioridade_favorito_expira_em
    );

  if not found then
    raise exception 'Corrida indisponível ou cidade incompatível' using errcode = 'P0001';
  end if;

  update public.motoristas
  set
    is_disponivel = false,
    updated_at = now()
  where id = p_motorista_id;
end;
$$;
