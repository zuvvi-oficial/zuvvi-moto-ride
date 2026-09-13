-- viagens_compartilhadas tinha uma policy pública de SELECT sem filtro por
-- link_publico ("Leitura pública do link de acompanhamento"): qualquer
-- cliente anônimo podia listar TODAS as viagens compartilhadas ativas
-- (corrida_id + link_publico de todo mundo), quebrando o modelo de "link
-- secreto e imprevisível" que a própria tabela pretende implementar. A
-- tabela está vazia em produção (a funcionalidade nunca foi construída na
-- aplicação), então não há dado a migrar ao corrigir isso agora.
drop policy if exists "Leitura pública do link de acompanhamento (somente leitura, sem login)" on public.viagens_compartilhadas;

revoke select on public.viagens_compartilhadas from anon;

-- Única porta de leitura pública: busca exata por link_publico (nunca
-- lista), e retorna apenas o mínimo necessário para o acompanhamento —
-- nunca o passageiro, pagamento, código de embarque ou a corrida inteira.
create or replace function public.get_viagem_compartilhada_publica(p_link_publico text)
returns table (
  status public.corrida_status,
  origem_nome text,
  destino_nome text,
  motorista_nome text,
  veiculo_placa text,
  veiculo_modelo text,
  motorista_lat numeric,
  motorista_lng numeric,
  expira_em timestamptz
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
    split_part(u.nome, ' ', 1) as motorista_nome,
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
    vc.expira_em
  from public.viagens_compartilhadas vc
  join public.corridas c on c.id = vc.corrida_id
  left join public.motoristas m on m.id = c.motorista_id
  left join public.usuarios u on u.id = m.id
  left join public.veiculos v on v.motorista_id = m.id
  where vc.link_publico = p_link_publico
    and vc.expira_em > now()
  limit 1;
end;
$$;

revoke all on function public.get_viagem_compartilhada_publica(text) from public, authenticated;
grant execute on function public.get_viagem_compartilhada_publica(text) to anon, authenticated;

comment on function public.get_viagem_compartilhada_publica is
  'Leitura pública e minimalista de uma viagem compartilhada, buscada pelo token exato — nunca permite listar viagens compartilhadas.';
