-- Personalização do card do motorista na tela pública de acompanhamento
-- (viagem compartilhada): adiciona nota média do motorista e cor do
-- veículo. Ambos já eram dados internos não-sensíveis (a nota já é
-- pública dentro do app pro passageiro antes de aceitar a corrida; a cor
-- do veículo já era parcialmente exposta via modelo/placa). Nenhum dado
-- novo de identificação pessoal (nome completo, telefone, foto) é
-- exposto — mantém a mesma política de minimização já documentada nesta
-- função.
-- Postgres não permite adicionar colunas de retorno via CREATE OR REPLACE
-- quando a função usa RETURNS TABLE — precisa recriar do zero. Feito dentro
-- da mesma migration/transação: não existe janela em que a função fica
-- ausente para chamadores concorrentes.
drop function if exists public.get_viagem_compartilhada_publica(text);

create function public.get_viagem_compartilhada_publica(p_link_publico text)
returns table (
  status public.corrida_status,
  origem_nome text,
  destino_nome text,
  motorista_nome text,
  veiculo_placa text,
  veiculo_modelo text,
  motorista_lat numeric,
  motorista_lng numeric,
  expira_em timestamptz,
  motorista_nota numeric,
  veiculo_cor text
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
    vc.expira_em,
    m.nota_media as motorista_nota,
    v.cor as veiculo_cor
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
