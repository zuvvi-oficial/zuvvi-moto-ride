-- Etapa 4 da adequação à LGPD: exclusão de conta a pedido da própria
-- pessoa. Apaga os dados pessoais (identificação, documentos, contatos de
-- confiança, credenciais Pix/Mercado Pago), mas preserva o histórico
-- financeiro (corridas/pagamentos) — que a legislação fiscal brasileira
-- exige guardar — já desvinculado do nome da pessoa (a linha de
-- public.usuarios continua existindo, só com os campos de identificação
-- nulos). O login é encerrado à parte, pelo servidor, via Admin API do
-- Supabase Auth (não é possível apagar auth.users direto daqui).

create or replace function public.excluir_conta_usuario(p_usuario_id uuid)
returns table (documento_storage_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eh_motorista boolean;
begin
  -- Trava: não deixa excluir com corrida em andamento, pra não sumir com o
  -- passageiro/motorista no meio de um trajeto ou de uma cobrança Pix ativa.
  if exists (
    select 1
    from public.corridas c
    where (c.passageiro_id = p_usuario_id or c.motorista_id = p_usuario_id)
      and c.status not in ('concluida', 'cancelada', 'sem_motorista')
  ) then
    raise exception
      'Não é possível excluir a conta com uma corrida em andamento. Finalize ou cancele antes de tentar novamente.';
  end if;

  select exists(select 1 from public.motoristas m where m.id = p_usuario_id) into v_eh_motorista;

  -- Devolve os caminhos dos documentos ANTES de apagar as linhas: o
  -- servidor (chamador) usa essa lista pra remover os arquivos do Storage,
  -- que esta função não alcança.
  return query
  select dm.storage_path
  from public.documentos_motorista dm
  where dm.motorista_id = p_usuario_id;

  if v_eh_motorista then
    delete from public.documentos_motorista where motorista_id = p_usuario_id;
    delete from private.motorista_mercadopago_credenciais where motorista_id = p_usuario_id;
    delete from private.motorista_mercadopago_autorizacoes_pendentes where motorista_id = p_usuario_id;
    delete from private.mercadopago_conta_propriedade where motorista_id = p_usuario_id;

    update public.veiculos
    set placa = null, marca = null, modelo = null, ano = null, cor = null, ativo = false
    where motorista_id = p_usuario_id;

    update public.motoristas
    set cnh_numero = null,
        cnh_categoria = null,
        cnh_validade = null,
        chave_pix = null,
        tipo_chave_pix = null,
        conta_mercado_pago_id = null,
        is_disponivel = false,
        ultima_lat = null,
        ultima_lng = null,
        ultima_localizacao_at = null
    where id = p_usuario_id;
  end if;

  delete from public.contatos_confianca where passageiro_id = p_usuario_id;
  delete from public.enderecos_favoritos where usuario_id = p_usuario_id;
  delete from public.push_subscriptions where usuario_id = p_usuario_id;
  delete from public.pagamentos_pix_device_sessions where passageiro_id = p_usuario_id;
  delete from public.motoristas_favoritos
  where passageiro_id = p_usuario_id or motorista_id = p_usuario_id;

  update public.usuarios
  set nome = 'Usuário excluído',
      email = null,
      celular = null,
      cpf = null,
      data_nascimento = null,
      foto_perfil_path = null,
      codigo_indicacao = null,
      is_passageiro = false,
      is_motorista = false
  where id = p_usuario_id;
end;
$$;

revoke all on function public.excluir_conta_usuario(uuid) from public, anon, authenticated;
grant execute on function public.excluir_conta_usuario(uuid) to service_role;

comment on function public.excluir_conta_usuario is
  'Apaga os dados pessoais de uma conta (LGPD), mantendo o histórico financeiro anonimizado pelo prazo legal. Bloqueia se houver corrida em andamento. Só o servidor (service_role) pode chamar.';
