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

    // 1. Obter dados atuais do motorista, CNH e usuário (cidade)
    const { data: motorista, error: mError } = await supabaseAdmin
      .from("motoristas")
      .select("status_aprovacao, cnh_validade")
      .eq("id", data.motoristaId)
      .single();

    if (mError || !motorista) throw new Error("Motorista não encontrado.");

    // 2. Validação para Aprovação Final
    if (data.novoStatus === "aprovado") {
      // A. Verificar Veículo
      const { data: veiculo, error: vError } = await supabaseAdmin
        .from("veiculos")
        .select("id, status_aprovacao")
        .eq("motorista_id", data.motoristaId)
        .maybeSingle();

      if (vError) throw new Error("Erro ao validar veículo.");
      if (!veiculo) throw new Error("Bloqueado: Nenhum veículo vinculado.");
      if (veiculo.status_aprovacao !== "aprovado") {
        throw new Error("Bloqueado: Veículo ainda não está aprovado.");
      }

      // B. Verificar CNH
      if (!motorista.cnh_validade) {
        throw new Error("Bloqueado: Validade da CNH não informada.");
      }
      if (new Date(motorista.cnh_validade) < new Date()) {
        throw new Error("Bloqueado: CNH vencida.");
      }

      // C. Verificar Documentos (Motorista + Veículo)
      const { data: documentos, error: dError } = await supabaseAdmin
        .from("documentos_motorista")
        .select("tipo_documento, status_analise")
        .or(`motorista_id.eq.${data.motoristaId},veiculo_id.eq.${veiculo.id}`);

      if (dError) throw new Error("Erro ao validar documentos.");
      
      const tiposObrigatorios = ['identidade', 'cnh', 'comprovante_residencia', 'crlv', 'foto_veiculo', 'foto_placa'];
      const docsEnviados = documentos || [];
      
      const tiposEnviados = docsEnviados.map(d => d.tipo_documento);
      const faltantes = tiposObrigatorios.filter(t => !tiposEnviados.includes(t as any));
      
      if (faltantes.length > 0) {
        throw new Error(`Bloqueado: Faltam documentos (${faltantes.join(", ")}).`);
      }

      const pendentes = docsEnviados.filter(d => d.status_analise === "pendente");
      if (pendentes.length > 0) {
        throw new Error("Bloqueado: Existem documentos aguardando análise.");
      }

      const recusados = docsEnviados.filter(d => d.status_analise === "recusado");
      if (recusados.length > 0) {
        throw new Error("Bloqueado: Existem documentos recusados.");
      }
    }

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
      .select("id, marca, modelo, placa, ano, cor, status_aprovacao")
      .eq("motorista_id", data.motoristaId)
      .maybeSingle();

    // 3. Documentos (do motorista OU do veículo vinculado a ele)
    let queryDocs = supabaseAdmin
      .from("documentos_motorista")
      .select("*")
      .eq("motorista_id", data.motoristaId);

    // Se houver um veículo, busca também documentos vinculados a este veículo específico
    if (veiculo?.id) {
      queryDocs = supabaseAdmin
        .from("documentos_motorista")
        .select("*")
        .or(`motorista_id.eq.${data.motoristaId},veiculo_id.eq.${veiculo.id}`);
    }

    const { data: documentos, error: dError } = await queryDocs;
    if (dError) console.error("Erro ao buscar documentos:", dError);
    
    // As URLs assinadas são geradas sob demanda no frontend via getDocumentoUrlSigned
    const docsSimplificados = documentos || [];

    // 4. Auditoria (Logs do motorista, de seus documentos e de seu veículo)
    const logFilter = [`entidade.eq.motoristas,entidade_id.eq.${data.motoristaId}`];
    
    // Incluir logs dos documentos do motorista
    if (documentos && documentos.length > 0) {
      const docIds = documentos.map(d => d.id).join(',');
      logFilter.push(`entidade.eq.documentos_motorista,entidade_id.in.(${docIds})`);
    }
    
    // Incluir logs do veículo
    if (veiculo?.id) {
      logFilter.push(`entidade.eq.veiculos,entidade_id.eq.${veiculo.id}`);
    }

    const { data: logs } = await supabaseAdmin
      .from("admin_audit_logs")
      .select("*")
      .or(logFilter.join(','))
      .order("created_at", { ascending: false })
      .limit(50);

    // Mascaramento básico (Admin vê, mas para segurança de log/transmissão básica)
    // No projeto Zuvvi, o admin autorizado VÊ o dado real na ficha, mas aplicamos 
    // um padrão visual no front. Aqui retornamos o dado real conforme solicitado.

    return {
      motorista,
      veiculo,
      documentos: docsSimplificados,
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

    // 2.1 Confirmação server-side da persistência
    const { data: confirmedDoc, error: confirmError } = await supabaseAdmin
      .from("documentos_motorista")
      .select("status_analise")
      .eq("id", data.documentoId)
      .single();

    if (confirmError || !confirmedDoc) {
      throw new Error("Erro crítico: Não foi possível confirmar a persistência do status.");
    }

    if (confirmedDoc.status_analise !== data.novoStatus) {
      throw new Error(`Falha de persistência: O status no banco (${confirmedDoc.status_analise}) não corresponde ao solicitado (${data.novoStatus}).`);
    }

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
 * Gerar URL assinada para visualização de documento (Server-only)
 */
export const getDocumentoUrlSigned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ documentoId: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    await checkAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Validar documento e obter path
    const { data: doc, error } = await supabaseAdmin
      .from("documentos_motorista")
      .select("storage_path, tipo_documento")
      .eq("id", data.documentoId)
      .single();

    if (error || !doc || !doc.storage_path) {
      throw new Error("Arquivo não encontrado ou inacessível.");
    }

    // 2. Gerar URL temporária (15 minutos para visualização imediata)
    const { data: signed, error: signedError } = await supabaseAdmin.storage
      .from("documentos-motorista")
      .createSignedUrl(doc.storage_path, 900);

    if (signedError || !signed) {
      throw new Error("Erro ao gerar acesso ao arquivo.");
    }

    return { 
      url: signed.signedUrl,
      tipo: doc.tipo_documento,
      isPdf: doc.storage_path.toLowerCase().endsWith('.pdf')
    };
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

/**
 * Gestão de Cidades (Somente Leitura - Fase 1)
 */
export const getCidadesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({
      pagina: z.number().default(0),
      limite: z.number().default(20),
      uf: z.string().optional(),
      status: z.string().optional(),
      busca: z.string().optional(),
    }).parse(data)
  )
  .handler(async ({ context, data }) => {
    await checkAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const offset = data.pagina * data.limite;

    let query = supabaseAdmin
      .from("cidades")
      .select(`
        id, nome, estado_uf, status,
        bandeirada, valor_km, valor_min, tarifa_minima, comissao_pct, raio_atuacao_km
      `, { count: "exact" });

    if (data.uf) {
      query = query.eq("estado_uf", data.uf);
    }
    if (data.status) {
      query = query.eq("status", data.status as any);
    }
    if (data.busca) {
      query = query.ilike("nome", `%${data.busca}%`);
    }

    const { data: cidades, count, error } = await query
      .order("estado_uf", { ascending: true })
      .order("nome", { ascending: true })
      .range(offset, offset + data.limite - 1);

    if (error) throw new Error(error.message);

    return {
      cidades: cidades || [],
      total: count || 0,
      pagina: data.pagina,
      limite: data.limite
    };
  });

export const updateStatusCidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({
      cidadeId: z.string(),
      novoStatus: z.enum(["em_breve", "piloto", "ativa"]),
      justificativa: z.string().min(3, "Justificativa muito curta"),
    }).parse(data)
  )
  .handler(async ({ context, data }) => {
    await checkAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const adminId = context.userId;

    // 5. Buscar a cidade pelo ID recebido
    const { data: cidade, error: fetchError } = await supabaseAdmin
      .from("cidades")
      .select("*")
      .eq("id", data.cidadeId)
      .single();

    if (fetchError || !cidade) throw new Error("Cidade não encontrada.");

    // Validar se o status já é o solicitado
    if (cidade.status === data.novoStatus) {
      return { success: true, message: "Nenhuma alteração era necessária." };
    }

    // VALIDAÇÃO DE TARIFAS (Somente leitura para conferência no servidor)
    const tarifasObrigatorias = [
      "bandeirada",
      "valor_km",
      "valor_min",
      "tarifa_minima",
      "comissao_pct",
      "raio_atuacao_km"
    ];

    for (const campo of tarifasObrigatorias) {
      const valor = (cidade as any)[campo];
      if (valor === null || valor === undefined || Number(valor) < 0) {
        throw new Error(`Bloqueado: Campo de tarifa '${campo}' está nulo ou inválido.`);
      }
      // Se for comissão, validar se está entre 0 e 100
      if (campo === "comissao_pct" && (Number(valor) > 100)) {
        throw new Error("Bloqueado: Comissão percentual inválida.");
      }
    }

    // 11. Executar o UPDATE
    const { error: updateError } = await supabaseAdmin
      .from("cidades")
      .update({ 
        status: data.novoStatus,
        updated_at: new Date().toISOString()
      })
      .eq("id", data.cidadeId);

    if (updateError) throw new Error(updateError.message);

    // 12. Confirmar a gravação lendo o status novamente
    const { data: confirmedCidade, error: confirmError } = await supabaseAdmin
      .from("cidades")
      .select("status, updated_at")
      .eq("id", data.cidadeId)
      .single();

    if (confirmError || !confirmedCidade) {
      throw new Error("Erro crítico: Não foi possível confirmar a persistência do status.");
    }

    if (confirmedCidade.status !== data.novoStatus) {
      throw new Error(`Falha de persistência: O status no banco (${confirmedCidade.status}) não corresponde ao solicitado (${data.novoStatus}).`);
    }

    // 14. Registrar auditoria
    await createAuditLog({
      adminId,
      acao: `cidade_status_${data.novoStatus}`,
      entidade: "cidades",
      entidadeId: data.cidadeId,
      estadoAnterior: { status: cidade.status },
      estadoNovo: { status: data.novoStatus },
      justificativa: `Alteração de status da cidade ${cidade.nome}/${cidade.estado_uf}: ${data.justificativa}`,
    });

    return { 
      success: true, 
      novoStatus: confirmedCidade.status,
      updatedAt: confirmedCidade.updated_at
    };
  });

export const updateTarifasCidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({
      cidadeId: z.string(),
      bandeirada: z.number().min(0),
      valor_km: z.number().min(0),
      valor_min: z.number().min(0),
      tarifa_minima: z.number().min(0),
      raio_atuacao_km: z.number().min(0),
      comissao_pct: z.number().min(0).max(100),
      justificativa: z.string().min(3, "Justificativa obrigatória (mín. 3 caracteres)"),
    }).parse(data)
  )
  .handler(async ({ context, data }) => {
    await checkAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const adminId = context.userId;

    // 1. Buscar a cidade atual
    const { data: cidade, error: fetchError } = await supabaseAdmin
      .from("cidades")
      .select("*")
      .eq("id", data.cidadeId)
      .single();

    if (fetchError || !cidade) throw new Error("Cidade não encontrada.");

    const estadoAnterior = {
      bandeirada: cidade.bandeirada,
      valor_km: cidade.valor_km,
      valor_min: cidade.valor_min,
      tarifa_minima: cidade.tarifa_minima,
      comissao_pct: cidade.comissao_pct,
      raio_atuacao_km: cidade.raio_atuacao_km
    };

    const estadoNovo = {
      bandeirada: data.bandeirada,
      valor_km: data.valor_km,
      valor_min: data.valor_min,
      tarifa_minima: data.tarifa_minima,
      comissao_pct: data.comissao_pct,
      raio_atuacao_km: data.raio_atuacao_km
    };

    // 2. Executar UPDATE
    const { error: updateError } = await supabaseAdmin
      .from("cidades")
      .update({
        ...estadoNovo,
        updated_at: new Date().toISOString()
      })
      .eq("id", data.cidadeId);

    if (updateError) throw new Error(updateError.message);

    // 3. Confirmar gravação
    const { data: confirmed, error: confirmError } = await supabaseAdmin
      .from("cidades")
      .select("bandeirada, valor_km, valor_min, tarifa_minima, comissao_pct, raio_atuacao_km")
      .eq("id", data.cidadeId)
      .single();

    if (confirmError || !confirmed) throw new Error("Erro ao confirmar persistência das tarifas.");

    // Comparar valores
    const campos = ["bandeirada", "valor_km", "valor_min", "tarifa_minima", "comissao_pct", "raio_atuacao_km"];
    for (const campo of campos) {
      if (Number((confirmed as any)[campo]) !== Number((data as any)[campo])) {
        throw new Error(`Falha de persistência no campo ${campo}.`);
      }
    }

    // 4. Registrar auditoria
    await createAuditLog({
      adminId,
      acao: "cidade_tarifas_atualizadas",
      entidade: "cidades",
      entidadeId: data.cidadeId,
      estadoAnterior,
      estadoNovo,
      justificativa: data.justificativa,
    });

    return { success: true };
  });



