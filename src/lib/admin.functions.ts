import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createAuditLog } from "./admin.server";
import { z } from "zod";

/**
 * Internal Admin Check Helper
 */
async function checkAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: admin, error } = await supabaseAdmin
    .from("admin_users")
    .select("role, ativo")
    .eq("auth_user_id", userId)
    .single();

  if (error || !admin || !admin.ativo || admin.role !== "admin") {
    throw new Error("Acesso negado: Administrador não autorizado.");
  }
  return admin;
}

/**
 * Dashboard Stats
 */
export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await checkAdmin(context.userId);
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
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => 
    z.object({
      status: z.string().optional(),
      busca: z.string().optional(),
    }).parse(data)
  )
  .handler(async ({ context, data }) => {
    await checkAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("usuarios")
      .select(`
        id, nome, email, celular, cpf,
        motoristas!inner(id, status_aprovacao, is_disponivel, ultima_localizacao_at),
        cidades(nome, estado_uf)
      `)
      .eq("is_motorista", true);

    if (data.status) {
      query = query.eq("motoristas.status_aprovacao", data.status as any);
    }
    if (data.busca) {
      query = query.or(`nome.ilike.%${data.busca}%,email.ilike.%${data.busca}%`);
    }

    const { data: motoristas, error } = await query.order("nome");
    if (error) throw new Error(error.message);
    return motoristas;
  });

export const updateStatusMotorista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      motoristaId: z.string(),
      novoStatus: z.enum(["aprovado", "recusado", "suspenso", "em_analise"]),
      justificativa: z.string().optional(),
    }).parse(data)
  )
  .handler(async ({ context, data }) => {
    await checkAdmin(context.userId);
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
      justificativa: data.justificativa ?? null,
    });

    return { success: true };
  });

/**
 * Gestão de Veículos
 */
export const getVeiculosAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await checkAdmin(context.userId);
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
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      veiculoId: z.string(),
      novoStatus: z.enum(["aprovado", "recusado", "suspenso"]),
      justificativa: z.string().optional(),
    }).parse(data)
  )
  .handler(async ({ context, data }) => {
    await checkAdmin(context.userId);
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
      justificativa: data.justificativa ?? null,
    });

    return { success: true };
  });

/**
 * Detalhes do Motorista para Admin
 */
export const getMotoristaDetalheAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ motoristaId: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    await checkAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Dados do Motorista e Usuário
    const { data: motorista, error: mError } = await supabaseAdmin
      .from("motoristas")
      .select(`
        *,
        usuarios(id, nome, email, celular, cpf, data_nascimento, cidade_id, cidades(nome, estado_uf))
      `)
      .eq("id", data.motoristaId)
      .maybeSingle();

    if (mError) throw new Error(mError.message);
    if (!motorista) throw new Error("Motorista não encontrado.");

    // 2. Veículo vinculado
    const { data: veiculo } = await supabaseAdmin
      .from("veiculos")
      .select("*")
      .eq("motorista_id", data.motoristaId)
      .maybeSingle();

    // 3. Documentos com URLs assinadas
    const { data: documentos } = await supabaseAdmin
      .from("documentos_motorista")
      .select("*")
      .eq("motorista_id", data.motoristaId);

    const docsComUrl = await Promise.all((documentos || []).map(async (doc) => {
      let publicUrl = null;
      if (doc.storage_path) {
        const { data: signed } = await supabaseAdmin.storage
          .from("documentos-motorista")
          .createSignedUrl(doc.storage_path, 3600); // 1 hora
        publicUrl = signed?.signedUrl;
      }
      return { ...doc, publicUrl };
    }));

    // 4. Auditoria
    const { data: logs } = await supabaseAdmin
      .from("admin_audit_logs")
      .select("*")
      .eq("entidade", "motoristas")
      .eq("entidade_id", data.motoristaId)
      .order("created_at", { ascending: false })
      .limit(20);

    // Mascaramento básico (Admin vê, mas para segurança de log/transmissão básica)
    // No projeto Zuvvi, o admin autorizado VÊ o dado real na ficha, mas aplicamos 
    // um padrão visual no front. Aqui retornamos o dado real conforme solicitado.

    return {
      motorista,
      veiculo,
      documentos: docsComUrl,
      logs
    };
  });

/**
 * Atualizar status de um documento individual
 */
export const updateStatusDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      documentoId: z.string(),
      novoStatus: z.enum(["aprovado", "recusado", "pendente"]),
      justificativa: z.string().optional(),
    }).parse(data)
  )
  .handler(async ({ context, data }) => {
    await checkAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const adminId = context.userId;

    // 1. Obter documento e motorista vinculado
    const { data: doc, error: docError } = await supabaseAdmin
      .from("documentos_motorista")
      .select("*, motoristas(id, usuarios(nome))")
      .eq("id", data.documentoId)
      .single();

    if (docError || !doc) throw new Error("Documento não encontrado.");

    if (data.novoStatus === "recusado" && !data.justificativa) {
      throw new Error("Justificativa é obrigatória para recusar um documento.");
    }

    // 2. Atualizar status
    const { error: updateError } = await supabaseAdmin
      .from("documentos_motorista")
      .update({
        status_analise: data.novoStatus,
        motivo_recusa: data.justificativa || null,
        data_analise: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", data.documentoId);

    if (updateError) throw new Error(updateError.message);

    // 3. Registrar Auditoria
    await createAuditLog({
      adminId,
      acao: `doc_status_${data.novoStatus}`,
      entidade: "documentos_motorista",
      entidadeId: data.documentoId,
      estadoAnterior: { status: doc.status_analise, motivo: doc.motivo_recusa },
      estadoNovo: { status: data.novoStatus, motivo: data.justificativa },
      justificativa: `Alteração de status do documento ${doc.tipo_documento} do motorista ${doc.motoristas?.usuarios?.nome}. ${data.justificativa || ""}`,
    });

    return { success: true };
  });

/**
 * Detalhes do Veículo para Admin
 */
export const getVeiculoDetalheAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ veiculoId: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    await checkAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Dados do Veículo e Proprietário
    const { data: veiculo, error: vError } = await supabaseAdmin
      .from("veiculos")
      .select(`
        *,
        motoristas(
          id, status_aprovacao,
          usuarios(nome, email, celular, cidades(nome, estado_uf))
        )
      `)
      .eq("id", data.veiculoId)
      .maybeSingle();

    if (vError) throw new Error(vError.message);
    if (!veiculo) throw new Error("Veículo não encontrado.");

    // 2. Documentos do Veículo (CRLV, foto_veiculo, foto_placa)
    const { data: documentos } = await supabaseAdmin
      .from("documentos_motorista")
      .select("*")
      .eq("veiculo_id", data.veiculoId);

    const docsComUrl = await Promise.all((documentos || []).map(async (doc) => {
      let publicUrl = null;
      if (doc.storage_path) {
        const { data: signed } = await supabaseAdmin.storage
          .from("documentos-motorista")
          .createSignedUrl(doc.storage_path, 3600);
        publicUrl = signed?.signedUrl;
      }
      return { ...doc, publicUrl };
    }));

    // 3. Auditoria
    const { data: logs } = await supabaseAdmin
      .from("admin_audit_logs")
      .select("*")
      .eq("entidade", "veiculos")
      .eq("entidade_id", data.veiculoId)
      .order("created_at", { ascending: false })
      .limit(10);

    return {
      veiculo,
      documentos: docsComUrl,
      logs
    };
  });
