import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Funções de Servidor para Avaliações - Zuvvi
 * MICROETAPA 4.5
 */

export const criarAvaliacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => 
    z.object({
      rideId: z.string(),
      nota: z.number().int().min(1).max(5),
      comentario: z.string().max(500).optional()
    }).parse(data)
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const authUserId = context.userId;

    // 1. Resolver o usuário logado (usuarios.id via auth_user_id)
    const { data: user, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", authUserId)
      .single();

    if (userError || !user) {
      throw new Error("Usuário não encontrado.");
    }
    const usuarioId = user.id;

    // 2. Buscar a corrida
    const { data: ride, error: rideError } = await supabaseAdmin
      .from("corridas")
      .select("passageiro_id, motorista_id, status")
      .eq("id", data.rideId)
      .maybeSingle();

    if (rideError || !ride) {
      throw new Error("Corrida não encontrada.");
    }

    // 3. Validações de estado
    if (ride.status !== 'concluida') {
      throw new Error("Esta corrida ainda não pode ser avaliada.");
    }

    // 4. Determinar avaliador e avaliado
    let avaliadoId: string;
    if (usuarioId === ride.passageiro_id) {
      if (!ride.motorista_id) throw new Error("Corrida sem motorista atribuído.");
      avaliadoId = ride.motorista_id;
    } else if (usuarioId === ride.motorista_id) {
      avaliadoId = ride.passageiro_id;
    } else {
      throw new Error("Você não participou desta corrida.");
    }

    // 5. Inserir avaliação
    const { error: insertError } = await supabaseAdmin
      .from("avaliacoes")
      .insert({
        corrida_id: data.rideId,
        avaliador_id: usuarioId,
        avaliado_id: avaliadoId,
        nota: data.nota,
        comentario: data.comentario
      } as any);

    if (insertError) {
      if ((insertError as any).code === '23505') {
        throw new Error("Você já avaliou esta corrida.");
      }
      throw new Error("Erro ao salvar avaliação.");
    }

    return { success: true };
  });

export const getAvaliacaoStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => 
    z.object({
      rideId: z.string()
    }).parse(data)
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const authUserId = context.userId;

    // 1. Resolver o usuário logado
    const { data: user, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", authUserId)
      .single();

    if (userError || !user) {
      throw new Error("Usuário não encontrado.");
    }

    // 2. Verificar se já existe avaliação
    const { data: avaliacao } = await supabaseAdmin
      .from("avaliacoes")
      .select("id")
      .eq("corrida_id", data.rideId)
      .eq("avaliador_id", user.id)
      .maybeSingle();

    return { jaAvaliado: !!avaliacao };
  });
