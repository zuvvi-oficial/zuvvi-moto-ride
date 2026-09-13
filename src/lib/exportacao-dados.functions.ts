import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const exportarMeusDados = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const authUserId = context.userId;

    if (!authUserId) {
      throw new Error("Não encontramos seu cadastro autenticado. Saia e entre novamente.");
    }

    const { data: usuario, error: usuarioError } = await supabaseAdmin
      .from("usuarios")
      .select(
        "id, nome, email, celular, cpf, data_nascimento, cidade_id, is_passageiro, is_motorista, codigo_indicacao, termos_aceitos_em, termos_versao, created_at",
      )
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (usuarioError || !usuario) {
      throw new Error("Não encontramos seu cadastro. Saia e entre novamente.");
    }

    const usuarioId = usuario.id;

    const [
      { data: motorista },
      { data: veiculos },
      { data: documentos },
      { data: corridasComoPassageiro },
      { data: corridasComoMotorista },
      { data: avaliacoesFeitas },
      { data: avaliacoesRecebidas },
      { data: gorjetas },
      { data: contatosConfianca },
      { data: enderecosFavoritos },
      { data: notificacoes },
      { data: chamadosSuporte },
      { data: mensagensSuporte },
      { data: cuponsUsados },
      { data: indicacoesComoIndicador },
      { data: indicacaoComoIndicado },
    ] = await Promise.all([
      supabaseAdmin
        .from("motoristas")
        .select(
          "cnh_numero, cnh_categoria, cnh_validade, status_aprovacao, nota_media, chave_pix, tipo_chave_pix, created_at",
        )
        .eq("id", usuarioId)
        .maybeSingle(),
      supabaseAdmin
        .from("veiculos")
        .select("placa, marca, modelo, ano, cor, status_aprovacao, ativo")
        .eq("motorista_id", usuarioId),
      supabaseAdmin
        .from("documentos_motorista")
        .select("tipo_documento, status_analise, motivo_recusa, data_envio, data_analise")
        .eq("motorista_id", usuarioId),
      supabaseAdmin
        .from("corridas")
        .select(
          "id, status, forma_pagamento, valor_estimado, valor_final, origem_nome, destino_nome, distancia_km, duracao_min, motivo_cancelamento, created_at, data_finalizacao",
        )
        .eq("passageiro_id", usuarioId),
      supabaseAdmin
        .from("corridas")
        .select(
          "id, status, forma_pagamento, valor_estimado, valor_final, origem_nome, destino_nome, distancia_km, duracao_min, motivo_cancelamento, created_at, data_finalizacao",
        )
        .eq("motorista_id", usuarioId),
      supabaseAdmin
        .from("avaliacoes")
        .select("corrida_id, nota, comentario, created_at")
        .eq("avaliador_id", usuarioId),
      supabaseAdmin
        .from("avaliacoes")
        .select("corrida_id, nota, comentario, created_at")
        .eq("avaliado_id", usuarioId),
      supabaseAdmin
        .from("gorjetas")
        .select("corrida_id, valor, status, created_at, pago_at")
        .or(`passageiro_id.eq.${usuarioId},motorista_id.eq.${usuarioId}`),
      supabaseAdmin
        .from("contatos_confianca")
        .select("nome, telefone, created_at")
        .eq("passageiro_id", usuarioId),
      supabaseAdmin
        .from("enderecos_favoritos")
        .select("nome, endereco, created_at")
        .eq("usuario_id", usuarioId),
      supabaseAdmin
        .from("notificacoes")
        .select("tipo, titulo, mensagem, lida, created_at")
        .eq("usuario_id", usuarioId),
      supabaseAdmin
        .from("chamados_suporte")
        .select("tipo, status, descricao, created_at, data_resolucao")
        .eq("usuario_id", usuarioId),
      supabaseAdmin
        .from("mensagens_suporte")
        .select("chamado_id, corpo, created_at")
        .eq("autor_usuario_id", usuarioId),
      supabaseAdmin
        .from("cupom_usos")
        .select("corrida_id, valor_desconto, created_at")
        .eq("usuario_id", usuarioId),
      supabaseAdmin
        .from("indicacoes")
        .select("codigo_usado, status, created_at, concluida_at")
        .eq("indicador_id", usuarioId),
      supabaseAdmin
        .from("indicacoes")
        .select("codigo_usado, status, created_at, concluida_at")
        .eq("indicado_id", usuarioId)
        .maybeSingle(),
    ]);

    const corridas = [...(corridasComoPassageiro ?? []), ...(corridasComoMotorista ?? [])];
    const corridaIds = corridas.map((c) => c.id);

    const { data: pagamentos } =
      corridaIds.length > 0
        ? await supabaseAdmin
            .from("pagamentos")
            .select(
              "corrida_id, meio, valor_total, valor_motorista, valor_comissao, status, created_at, pago_at, estornado_at",
            )
            .in("corrida_id", corridaIds)
        : { data: [] };

    return {
      geradoEm: new Date().toISOString(),
      perfil: {
        nome: usuario.nome,
        email: usuario.email,
        celular: usuario.celular,
        cpf: usuario.cpf,
        dataNascimento: usuario.data_nascimento,
        ehPassageiro: usuario.is_passageiro,
        ehMotorista: usuario.is_motorista,
        codigoIndicacao: usuario.codigo_indicacao,
        termosAceitosEm: usuario.termos_aceitos_em,
        termosVersao: usuario.termos_versao,
        cadastradoEm: usuario.created_at,
      },
      motorista: motorista ?? null,
      veiculos: veiculos ?? [],
      documentos: documentos ?? [],
      corridas,
      pagamentos: pagamentos ?? [],
      avaliacoesFeitas: avaliacoesFeitas ?? [],
      avaliacoesRecebidas: avaliacoesRecebidas ?? [],
      gorjetas: gorjetas ?? [],
      contatosConfianca: contatosConfianca ?? [],
      enderecosFavoritos: enderecosFavoritos ?? [],
      notificacoes: notificacoes ?? [],
      chamadosSuporte: chamadosSuporte ?? [],
      mensagensSuporte: mensagensSuporte ?? [],
      cuponsUsados: cuponsUsados ?? [],
      indicacoes: {
        feitasPorMim: indicacoesComoIndicador ?? [],
        comoIndicado: indicacaoComoIndicado ?? null,
      },
    };
  });
