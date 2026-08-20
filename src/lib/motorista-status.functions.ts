import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ACTIVE_RIDE_STATUSES = [
  "aceita",
  "motorista_a_caminho",
  "motorista_chegou",
  "em_andamento",
] as const;

/**
 * Busca a corrida ativa vinculada ao motorista (ID derivado server-side).
 * FAIL CLOSED se houver mais de uma corrida ativa.
 */
async function fetchActiveRide(supabaseAdmin: any, motoristaId: string) {
  const { data, error } = await supabaseAdmin
    .from("corridas")
    .select("id, status, origem_nome, destino_nome, valor_estimado, forma_pagamento")
    .eq("motorista_id", motoristaId)
    .in("status", ACTIVE_RIDE_STATUSES as unknown as string[]);

  if (error) {
    throw new Error("Não foi possível verificar sua corrida atual.");
  }

  if ((data?.length ?? 0) > 1) {
    throw new Error("Inconsistência operacional detectada. Contate o suporte.");
  }

  return data?.[0] ?? null;
}

/**
 * Função para atualizar a disponibilidade do motorista.
 * Localizada em src/lib/motorista-status.functions.ts para evitar conflitos com admin.functions.ts
 */
export const updateMotoristaDisponibilidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ disponivel: z.boolean() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // REGRA 1: Sempre permitir ficar OFFLINE
    if (!data.disponivel) {
      const { data: usuario, error: uError } = await supabaseAdmin
        .from("usuarios")
        .select("id, is_motorista")
        .eq("auth_user_id", userId)
        .single();
      
      if (uError || !usuario || !usuario.is_motorista) {
        throw new Error("Perfil de motorista não encontrado.");
      }
      
      const { data: motorista, error: updateError } = await supabaseAdmin
        .from("motoristas")
        .update({ is_disponivel: false })
        .eq("id", usuario.id)
        .select("id, is_disponivel")
        .maybeSingle();

      if (updateError) {
        throw new Error("Erro ao salvar status offline: " + updateError.message);
      }

      if (!motorista) {
        throw new Error("Perfil de motorista não encontrado.");
      }
      
      return { success: true, is_disponivel: false };
    }

    // REGRA 2: ONLINE - Usar regra central de elegibilidade
    const { evaluateMotoristaOperationalEligibility } = await import("./motorista-eligibility.server");
    const eligibility = await evaluateMotoristaOperationalEligibility(supabaseAdmin, userId);

    if (!eligibility.eligible) {
      throw new Error(eligibility.message || "Você não é elegível para ficar online.");
    }

    // Recalcular ID para o update correto
    const { data: usuarioFinal, error: fError } = await supabaseAdmin.from("usuarios").select("id").eq("auth_user_id", userId).single();
    
    if (fError || !usuarioFinal) {
      throw new Error("Erro ao identificar perfil de motorista.");
    }

    // REGRA 3: Bloqueio server-side de ONLINE com corrida ativa (ATÔMICO)
    const { data: result, error: rpcError } = await supabaseAdmin.rpc(
      "set_motorista_online_atomic",
      { p_motorista_id: usuarioFinal.id }
    );

    if (rpcError) {
      throw new Error("Erro ao atualizar status de disponibilidade. Tente novamente.");
    }

    if (result === "ACTIVE_RIDE_EXISTS") {
      throw new Error("Você já possui uma corrida ativa.");
    }

    return { success: true, is_disponivel: true };
  });

export const getMotoristaStatusHome = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { evaluateMotoristaOperationalEligibility } = await import("./motorista-eligibility.server");
    
    // Executar regra central (Watchdog)
    const eligibility = await evaluateMotoristaOperationalEligibility(supabaseAdmin, context.userId);

    const { data: usuario, error } = await supabaseAdmin
      .from("usuarios")
      .select(`
        id,
        nome,
        is_motorista,
        motoristas!inner(status_aprovacao, is_disponivel)
      `)
      .eq("auth_user_id", context.userId)
      .single();

    if (error || !usuario) throw new Error("Usuário não encontrado.");

    const activeRide = await fetchActiveRide(supabaseAdmin, usuario.id);

    return {
      id: usuario.id,
      active_ride: activeRide
        ? {
            id: activeRide.id,
            status: activeRide.status,
            origem_nome: activeRide.origem_nome,
            destino_nome: activeRide.destino_nome,
            valor_estimado: activeRide.valor_estimado,
            forma_pagamento: activeRide.forma_pagamento,
          }
        : null,
      nome: usuario.nome,
      is_motorista: usuario.is_motorista,
      status_aprovacao: (usuario.motoristas as any).status_aprovacao,
      is_disponivel: (usuario.motoristas as any).is_disponivel,
      operational_eligible: eligibility.eligible,
      operational_block_code: eligibility.reasonCode,
      operational_block_message: eligibility.message
    };
  });
