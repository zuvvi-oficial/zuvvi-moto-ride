import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";

export type EligibilityResult = {
  eligible: boolean;
  reasonCode: "status_nao_aprovado" | "cnh_incompleta" | "cnh_categoria_invalida" | "cnh_vencida" | "veiculo_invalido" | "documentos_invalidos" | null;
  message: string | null;
  isDisponivel: boolean;
};

/**
 * Função central server-side para avaliar a elegibilidade operacional do motorista.
 * Implementa as regras de negócio de Brasília/DF e Jacarezinho/PR.
 * GARANTE que um motorista irregular seja retirado de ONLINE.
 */
export async function evaluateMotoristaOperationalEligibility(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<EligibilityResult> {
  // 1. Obter dados básicos do motorista e status atual de disponibilidade
  const { data: usuario, error: uError } = await supabase
    .from("usuarios")
    .select(`
      id,
      motoristas!inner(
        id,
        status_aprovacao,
        cnh_numero,
        cnh_categoria,
        cnh_validade,
        is_disponivel
      )
    `)
    .eq("auth_user_id", userId)
    .single();

  if (uError || !usuario) {
    throw new Error("Erro técnico: Perfil de motorista não encontrado.");
  }

  const motorista = (usuario.motoristas as any);
  const motoristaId = motorista.id;
  const currentIsDisponivel = !!motorista.is_disponivel;

  // 2. Regra: status_aprovacao === "aprovado"
  if (motorista.status_aprovacao !== "aprovado") {
    return await reconcileOffline(supabase, motoristaId, currentIsDisponivel, {
      eligible: false,
      reasonCode: "status_nao_aprovado",
      message: "Seu perfil não está aprovado.",
      isDisponivel: false
    });
  }

  // 3. Regras CNH: cnh_numero, cnh_categoria, cnh_validade
  if (!motorista.cnh_numero || !motorista.cnh_categoria || !motorista.cnh_validade) {
    return await reconcileOffline(supabase, motoristaId, currentIsDisponivel, {
      eligible: false,
      reasonCode: "cnh_incompleta",
      message: "Dados da CNH incompletos.",
      isDisponivel: false
    });
  }

  // 4. Regra CNH Categoria: A ou AB
  const cat = motorista.cnh_categoria.toUpperCase();
  if (cat !== "A" && cat !== "AB") {
    return await reconcileOffline(supabase, motoristaId, currentIsDisponivel, {
      eligible: false,
      reasonCode: "cnh_categoria_invalida",
      message: "Categoria de CNH inválida para mototáxi.",
      isDisponivel: false
    });
  }

  // 5. Regra CNH Validade: Comparação por DIA CIVIL (America/Sao_Paulo)
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // YYYY-MM-DD

  // cnh_validade < data atual brasileira = VENCIDA
  if (motorista.cnh_validade < todayStr) {
    return await reconcileOffline(supabase, motoristaId, currentIsDisponivel, {
      eligible: false,
      reasonCode: "cnh_vencida",
      message: "Sua CNH está vencida.",
      isDisponivel: false
    });
  }

  // 6. Regra Veículo: pelo menos um veículo aprovado E ativo
  const { data: veiculo, error: vError } = await supabase
    .from("veiculos")
    .select("id")
    .eq("motorista_id", motoristaId)
    .eq("status_aprovacao", "aprovado")
    .eq("ativo", true)
    .maybeSingle();

  if (vError) {
    throw new Error("Erro técnico ao validar veículo.");
  }

  if (!veiculo) {
    return await reconcileOffline(supabase, motoristaId, currentIsDisponivel, {
      eligible: false,
      reasonCode: "veiculo_invalido",
      message: "Veículo não aprovado ou inativo.",
      isDisponivel: false
    });
  }

  // 7. Regra Documentos: 6 tipos obrigatórios aprovados
  const tiposObrigatorios = [
    "identidade",
    "cnh",
    "comprovante_residencia",
    "crlv",
    "foto_veiculo",
    "foto_placa"
  ];

  const { data: documentos, error: dError } = await supabase
    .from("documentos_motorista")
    .select("tipo_documento")
    .or(`motorista_id.eq.${motoristaId},veiculo_id.eq.${veiculo.id}`)
    .eq("status_analise", "aprovado");

  if (dError) {
    throw new Error("Erro técnico ao validar documentos.");
  }

  const docsAprovados = (documentos || []).map(d => String(d.tipo_documento));
  const temTodos = tiposObrigatorios.every(t => docsAprovados.includes(t));

  if (!temTodos) {
    return await reconcileOffline(supabase, motoristaId, currentIsDisponivel, {
      eligible: false,
      reasonCode: "documentos_invalidos",
      message: "Documentos obrigatórios pendentes.",
      isDisponivel: false
    });
  }

  // Elegível!
  return {
    eligible: true,
    reasonCode: null,
    message: null,
    isDisponivel: currentIsDisponivel
  };
}

/**
 * Reconcilia o estado de disponibilidade para OFFLINE se o motorista não for elegível.
 * NUNCA coloca o motorista ONLINE automaticamente.
 */
async function reconcileOffline(
  supabase: SupabaseClient<Database>,
  motoristaId: string,
  currentIsDisponivel: boolean,
  result: EligibilityResult
): Promise<EligibilityResult> {
  if (currentIsDisponivel) {
    const { error } = await supabase
      .from("motoristas")
      .update({ is_disponivel: false })
      .eq("id", motoristaId);

    if (error) {
      throw new Error("Erro técnico ao forçar offline.");
    }

    // Confirmar integridade server-side
    const { data: motoristaConfirm, error: cError } = await supabase
      .from("motoristas")
      .select("is_disponivel")
      .eq("id", motoristaId)
      .single();

    if (cError || motoristaConfirm?.is_disponivel === true) {
      throw new Error("Erro de integridade: Não foi possível confirmar o status offline.");
    }
  }

  return result;
}
