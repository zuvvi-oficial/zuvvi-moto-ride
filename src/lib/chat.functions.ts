import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * ZUVVI CHAT SERVER FUNCTIONS
 * src/lib/chat.functions.ts
 */

// Helper interno para mapear mensagem (camelCase)
function mapearMensagem(m: any) {
  if (!m) return null;
  return {
    id: m.id,
    clientMessageId: m.client_message_id,
    remetenteId: m.remetente_id,
    conteudo: m.conteudo,
    createdAt: m.created_at,
    entregueAt: m.entregue_at,
    lidoAt: m.lido_at,
  };
}

// Helper interno para resolver participante e validar ownership
async function resolveParticipanteChat(corridaId: string, authUserId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1. Resolver public.usuarios.id pelo authUserId do contexto
  const { data: usuario, error: userError } = await supabaseAdmin
    .from("usuarios")
    .select("id")
    .eq("auth_user_id", authUserId)
    .single();

  if (userError || !usuario) {
    throw new Error("Usuário não encontrado.");
  }

  const meuUsuarioId = usuario.id;

  // 2. Buscar corrida somente com campos necessários
  const { data: corrida, error: corridaError } = await supabaseAdmin
    .from("corridas")
    .select("id, passageiro_id, motorista_id, status")
    .eq("id", corridaId)
    .single();

  if (corridaError || !corrida) {
    throw new Error("Corrida não encontrada.");
  }

  // 3. Validar se o usuário participa da corrida
  const souPassageiro = meuUsuarioId === corrida.passageiro_id;
  const souMotorista = meuUsuarioId === corrida.motorista_id;

  if (!souPassageiro && !souMotorista) {
    throw new Error("Você não participa desta corrida.");
  }

  // 5. Se motorista_id for NULL, chat ainda não disponível
  if (!corrida.motorista_id) {
    throw new Error("Chat indisponível (motorista não atribuído).");
  }

  const interlocutorId = souPassageiro ? corrida.motorista_id : corrida.passageiro_id;

  // 6. Determinar interlocutor (somente id, nome) e se pode enviar
  const { data: interlocutor, error: intError } = await supabaseAdmin
    .from("usuarios")
    .select("id, nome")
    .eq("id", interlocutorId)
    .single();

  if (intError || !interlocutor) {
    throw new Error("Interlocutor não encontrado.");
  }

  // podeEnviar=true somente em status específicos
  const statusPermitidos = ["aceita", "motorista_a_caminho", "motorista_chegou"];
  const podeEnviar = statusPermitidos.includes(corrida.status);

  return {
    meuUsuarioId,
    interlocutor,
    status: corrida.status,
    podeEnviar,
    supabaseAdmin,
  };
}

// 1. carregarChat
export const carregarChat = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ corridaId: z.string().uuid() }).parse(data))
  .handler(async ({ data: input, context }) => {
    const { meuUsuarioId, interlocutor, status, podeEnviar, supabaseAdmin } =
      await resolveParticipanteChat(input.corridaId, context.userId);

    // Buscar no máximo 100 mensagens da corrida
    const { data: mensagens, error: msgError } = await supabaseAdmin
      .from("chat_mensagens")
      .select("id, client_message_id, remetente_id, conteudo, created_at, entregue_at, lido_at")
      .eq("corrida_id", input.corridaId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (msgError) throw new Error("Erro ao carregar mensagens.");

    // Buscar presença do interlocutor - Tratando erro explicitamente
    const { data: presenca, error: presError } = await supabaseAdmin
      .from("chat_presenca")
      .select("ultimo_visto_at, digitando_ate")
      .eq("corrida_id", input.corridaId)
      .eq("usuario_id", interlocutor.id)
      .maybeSingle();

    if (presError) {
      throw new Error("Não foi possível carregar a presença do participante.");
    }

    // Calcular não lidas recebidas - Tratando erro explicitamente
    const { count: naoLidas, error: countError } = await supabaseAdmin
      .from("chat_mensagens")
      .select("*", { count: "exact", head: true })
      .eq("corrida_id", input.corridaId)
      .eq("remetente_id", interlocutor.id)
      .is("lido_at", null);

    if (countError) {
      throw new Error("Não foi possível carregar as mensagens não lidas.");
    }

    return {
      corridaId: input.corridaId,
      meuUsuarioId,
      interlocutor,
      status,
      podeEnviar,
      naoLidas: naoLidas || 0,
      presenca: presenca
        ? {
            ultimoVistoAt: presenca.ultimo_visto_at,
            digitandoAte: presenca.digitando_ate,
          }
        : null,
      mensagens: (mensagens || []).reverse().map(mapearMensagem),
    };
  });

// 2. enviarMensagemChat
export const enviarMensagemChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        corridaId: z.string().uuid(),
        clientMessageId: z.string().uuid(),
        conteudo: z.string().trim().min(1).max(1000),
      })
      .parse(data),
  )
  .handler(async ({ data: input, context }) => {
    const { meuUsuarioId, podeEnviar, supabaseAdmin } = await resolveParticipanteChat(
      input.corridaId,
      context.userId,
    );

    if (!podeEnviar) {
      throw new Error("O chat não está mais disponível para novas mensagens nesta corrida.");
    }

    // IDEMPOTÊNCIA: Verificar se já existe com erro real capturado
    const { data: existente, error: existError } = await supabaseAdmin
      .from("chat_mensagens")
      .select("id, client_message_id, remetente_id, conteudo, created_at, entregue_at, lido_at")
      .eq("corrida_id", input.corridaId)
      .eq("remetente_id", meuUsuarioId)
      .eq("client_message_id", input.clientMessageId)
      .maybeSingle();

    if (existError) {
      throw new Error("Não foi possível verificar o envio da mensagem.");
    }

    if (existente) return mapearMensagem(existente);

    // ANTI-SPAM: Max 8 mensagens nos últimos 10 segundos com captura de erro
    const dezSegundosAtras = new Date(Date.now() - 10000).toISOString();
    const { count: recentes, error: antiSpamError } = await supabaseAdmin
      .from("chat_mensagens")
      .select("*", { count: "exact", head: true })
      .eq("corrida_id", input.corridaId)
      .eq("remetente_id", meuUsuarioId)
      .gte("created_at", dezSegundosAtras);

    if (antiSpamError) {
      throw new Error("Não foi possível validar o envio da mensagem.");
    }

    if (recentes && recentes >= 8) {
      throw new Error("Você está enviando mensagens muito rápido. Aguarde alguns segundos.");
    }

    // INSERT com select explícito
    const { data: criada, error: insError } = await supabaseAdmin
      .from("chat_mensagens")
      .insert({
        corrida_id: input.corridaId,
        remetente_id: meuUsuarioId,
        client_message_id: input.clientMessageId,
        conteudo: input.conteudo,
      })
      .select("id, client_message_id, remetente_id, conteudo, created_at, entregue_at, lido_at")
      .single();

    if (insError) {
      // Caso ocorra uma violação de unicidade concorrente
      if (insError.code === "23505") {
        const { data: retry, error: retryError } = await supabaseAdmin
          .from("chat_mensagens")
          .select("id, client_message_id, remetente_id, conteudo, created_at, entregue_at, lido_at")
          .eq("corrida_id", input.corridaId)
          .eq("remetente_id", meuUsuarioId)
          .eq("client_message_id", input.clientMessageId)
          .single();

        if (retryError || !retry) {
          throw new Error("Não foi possível confirmar o envio da mensagem.");
        }
        return mapearMensagem(retry);
      }
      throw new Error("Erro ao enviar mensagem.");
    }

    return mapearMensagem(criada);
  });

// 3. marcarMensagensEntregues
export const marcarMensagensEntregues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ corridaId: z.string().uuid() }).parse(data))
  .handler(async ({ data: input, context }) => {
    const { meuUsuarioId, supabaseAdmin } = await resolveParticipanteChat(
      input.corridaId,
      context.userId,
    );

    const { data: atualizadas, error } = await supabaseAdmin
      .from("chat_mensagens")
      .update({ entregue_at: new Date().toISOString() })
      .eq("corrida_id", input.corridaId)
      .neq("remetente_id", meuUsuarioId)
      .is("entregue_at", null)
      .select("id");

    if (error) throw new Error("Erro ao atualizar recibos de entrega.");

    return {
      success: true,
      atualizadas: atualizadas?.length ?? 0,
    };
  });

// 4. marcarMensagensLidas
export const marcarMensagensLidas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ corridaId: z.string().uuid() }).parse(data))
  .handler(async ({ data: input, context }) => {
    const { meuUsuarioId, supabaseAdmin } = await resolveParticipanteChat(
      input.corridaId,
      context.userId,
    );

    const agora = new Date().toISOString();

    // 1. Garantir que estejam entregues primeiro
    const { error: errorEntrega } = await supabaseAdmin
      .from("chat_mensagens")
      .update({ entregue_at: agora })
      .eq("corrida_id", input.corridaId)
      .neq("remetente_id", meuUsuarioId)
      .is("entregue_at", null)
      .select("id");

    if (errorEntrega) {
      throw new Error("Não foi possível atualizar a entrega das mensagens.");
    }

    // 2. Marcar como lidas
    const { data: lidas, error: errorLido } = await supabaseAdmin
      .from("chat_mensagens")
      .update({ lido_at: agora })
      .eq("corrida_id", input.corridaId)
      .neq("remetente_id", meuUsuarioId)
      .is("lido_at", null)
      .select("id");

    if (errorLido) {
      throw new Error("Erro ao marcar mensagens como lidas.");
    }

    return {
      success: true,
      atualizadas: lidas?.length ?? 0,
    };
  });

// 5. atualizarPresencaChat
export const atualizarPresencaChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        corridaId: z.string().uuid(),
        digitando: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data: input, context }) => {
    const { meuUsuarioId, supabaseAdmin } = await resolveParticipanteChat(
      input.corridaId,
      context.userId,
    );

    const agora = new Date();
    const digitandoAte = input.digitando ? new Date(agora.getTime() + 5000).toISOString() : null;
    const ultimoVistoAt = agora.toISOString();

    const { error } = await supabaseAdmin.from("chat_presenca").upsert(
      {
        corrida_id: input.corridaId,
        usuario_id: meuUsuarioId,
        ultimo_visto_at: ultimoVistoAt,
        digitando_ate: digitandoAte,
        updated_at: ultimoVistoAt,
      },
      {
        onConflict: "corrida_id,usuario_id",
      },
    );

    if (error) throw new Error("Erro ao atualizar presença.");

    return {
      ultimoVistoAt,
      digitandoAte,
    };
  });
