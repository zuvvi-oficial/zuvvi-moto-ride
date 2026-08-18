import { createServerFn } from "@tanstack/react-start";
import { requireAdmin, createAuditLog } from "./admin.server";
import { z } from "zod";

/**
 * Dashboard Stats
 */
export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [
      { count: motoristasPendentes },
      { count: motoristasEmAnalise },
      { count: motoristasAprovados },
      { count: veiculosPendentes },
      { count: corridasAbertasBSB },
      { count: motoristasOnline },
    ] = await Promise.all([
      supabaseAdmin.from("motoristas").select("*", { count: "exact", head: true }).eq("status_aprovacao", "em_preenchimento"),
      supabaseAdmin.from("motoristas").select("*", { count: "exact", head: true }).eq("status_aprovacao", "em_analise"),
      supabaseAdmin.from("motoristas").select("*", { count: "exact", head: true }).eq("status_aprovacao", "aprovado"),
      supabaseAdmin.from("veiculos").select("*", { count: "exact", head: true }).eq("status_aprovacao", "em_preenchimento"),
      supabaseAdmin.from("corridas").select("*", { count: "exact", head: true }).eq("status", "solicitada"),
      supabaseAdmin.from("motoristas").select("*", { count: "exact", head: true }).eq("is_disponivel", true),
    ]);

    return {
      motoristasPendentes: motoristasPendentes || 0,
      motoristasEmAnalise: motoristasEmAnalise || 0,
      motoristasAprovados: motoristasAprovados || 0,
      veiculosPendentes: veiculosPendentes || 0,
      corridasAbertasBSB: corridasAbertasBSB || 0,
      motoristasOnline: motoristasOnline || 0,
      lastUpdate: new Date().toISOString(),
    };
  });

/**
 * Gestão de Motoristas
 */
export const getMotoristasAdmin = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .inputValidator((data: unknown) => 
    z.object({
      status: z.string().optional(),
      busca: z.string().optional(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("usuarios")
      .select(`
        id, nome, email, celular, cpf,
        motoristas!inner(status_aprovacao, is_disponivel, ultima_localizacao_at),
        cidades(nome, estado_uf)
      `)
      .eq("is_motorista", true);

    if (data.status) {
      query = query.eq("motoristas.status_aprovacao", data.status);
    }
    if (data.busca) {
      query = query.or(`nome.ilike.%${data.busca}%,email.ilike.%${data.busca}%`);
    }

    const { data: motoristas, error } = await query.order("nome");
    if (error) throw new Error(error.message);
    return motoristas;
  });

export const updateStatusMotorista = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((data: unknown) =>
    z.object({
      motoristaId: z.string(),
      novoStatus: z.enum(["aprovado", "recusado", "suspenso", "em_analise"]),
      justificativa: z.string().optional(),
    }).parse(data)
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const adminId = context.userId;

    // Obter estado anterior
    const { data: motorista } = await supabaseAdmin
      .from("motoristas")
      .select("status_aprovacao")
      .eq("id", data.motoristaId)
      .single();

    if (!motorista) throw new Error("Motorista não encontrado.");

    if ((data.novoStatus === "recusado" || data.novoStatus === "suspenso") && !data.justificativa) {
      throw new Error("Justificativa é obrigatória para recusa ou suspensão.");
    }

    const updateData: any = { status_aprovacao: data.novoStatus };
    if (data.novoStatus !== "aprovado") {
      updateData.is_disponivel = false;
    }

    const { error } = await supabaseAdmin
      .from("motoristas")
      .update(updateData)
      .eq("id", data.motoristaId);

    if (error) throw new Error(error.message);

    await createAuditLog({
      adminId,
      acao: `status_update_${data.novoStatus}`,
      entidade: "motoristas",
      entidadeId: data.motoristaId,
      estadoAnterior: { status: motorista.status_aprovacao },
      estadoNovo: { status: data.novoStatus },
      justificativa: data.justificativa,
    });

    return { success: true };
  });

/**
 * Gestão de Veículos
 */
export const getVeiculosAdmin = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: veiculos, error } = await supabaseAdmin
      .from("veiculos")
      .select(`
        *,
        usuarios(nome, email, cidades(nome))
      `)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return veiculos;
  });

export const updateStatusVeiculo = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((data: unknown) =>
    z.object({
      veiculoId: z.string(),
      novoStatus: z.enum(["aprovado", "recusado", "suspenso"]),
      justificativa: z.string().optional(),
    }).parse(data)
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const adminId = context.userId;

    const { data: veiculo } = await supabaseAdmin
      .from("veiculos")
      .select("status_aprovacao, motorista_id")
      .eq("id", data.veiculoId)
      .single();

    if (!veiculo) throw new Error("Veículo não encontrado.");

    if ((data.novoStatus === "recusado" || data.novoStatus === "suspenso") && !data.justificativa) {
      throw new Error("Justificativa é obrigatória.");
    }

    const { error } = await supabaseAdmin
      .from("veiculos")
      .update({ status_aprovacao: data.novoStatus })
      .eq("id", data.veiculoId);

    if (error) throw new Error(error.message);

    await createAuditLog({
      adminId,
      acao: `veiculo_status_${data.novoStatus}`,
      entidade: "veiculos",
      entidadeId: data.veiculoId,
      estadoAnterior: { status: veiculo.status_aprovacao },
      estadoNovo: { status: data.novoStatus },
      justificativa: data.justificativa,
    });

    return { success: true };
  });
