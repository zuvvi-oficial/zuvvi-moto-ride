-- Exibe o nome e a foto de perfil já cadastrados do passageiro na tela
-- pública de viagem compartilhada, junto do que já é mostrado do motorista.
-- Não altera nenhum campo existente, join existente, política de segurança,
-- máquina de estados, localização, SOS ou qualquer outra regra da corrida.
--
-- Mesmo padrão de recriação da função das migrations anteriores desta mesma
-- RPC (20260906215902, 20260907233444, 20260915120000, 20260915130000,
-- 20260915220000): drop + create dentro da mesma transação, sem janela de
-- indisponibilidade pra chamadores concorrentes.
drop function if exists public.get_viagem_compartilhada_publica(text);

create function public.get_viagem_compartilhada_publica(p_link_publico text)
returns table (
  status public.corrida_status,
  origem_nome text,
  destino_nome text,
  origem_lat numeric,
  origem_lng numeric,
  destino_lat numeric,
  destino_lng numeric,
  motorista_nome text,
  motorista_foto_perfil_path text,
  veiculo_placa text,
  veiculo_modelo text,
  motorista_lat numeric,
  motorista_lng numeric,
  motorista_ultima_localizacao_at timestamptz,
  expira_em timestamptz,
  motorista_nota numeric,
  veiculo_cor text,
  passageiro_nome text,
  passageiro_foto_perfil_path text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if btrim(coalesce(p_link_publico, '')) = '' then
    return;
  end if;

  return query
  select
    c.status,
    c.origem_nome,
    c.destino_nome,
    c.origem_lat,
    c.origem_lng,
    c.destino_lat,
    c.destino_lng,
    split_part(u.nome, ' ', 1) as motorista_nome,
    u.foto_perfil_path as motorista_foto_perfil_path,
    v.placa as veiculo_placa,
    v.modelo as veiculo_modelo,
    case
      when c.status in ('aceita', 'motorista_a_caminho', 'motorista_chegou', 'em_andamento')
      then m.ultima_lat
      else null
    end as motorista_lat,
    case
      when c.status in ('aceita', 'motorista_a_caminho', 'motorista_chegou', 'em_andamento')
      then m.ultima_lng
      else null
    end as motorista_lng,
    case
      when c.status in ('aceita', 'motorista_a_caminho', 'motorista_chegou', 'em_andamento')
      then m.ultima_localizacao_at
      else null
    end as motorista_ultima_localizacao_at,
    vc.expira_em,
    m.nota_media as motorista_nota,
    v.cor as veiculo_cor,
    split_part(u_passageiro.nome, ' ', 1) as passageiro_nome,
    u_passageiro.foto_perfil_path as passageiro_foto_perfil_path
  from public.viagens_compartilhadas vc
  join public.corridas c on c.id = vc.corrida_id
  left join public.motoristas m on m.id = c.motorista_id
  left join public.usuarios u on u.id = m.id
  left join public.veiculos v on v.motorista_id = m.id
  left join public.usuarios u_passageiro on u_passageiro.id = c.passageiro_id
  where vc.link_publico = p_link_publico
    and vc.expira_em > now()
  limit 1;
end;
$$;

revoke all on function public.get_viagem_compartilhada_publica(text) from public, authenticated;
grant execute on function public.get_viagem_compartilhada_publica(text) to anon, authenticated;

comment on function public.get_viagem_compartilhada_publica is
  'Leitura pública e minimalista de uma viagem compartilhada, incluindo somente as referências de foto do motorista e do passageiro para URL assinada no servidor.';
