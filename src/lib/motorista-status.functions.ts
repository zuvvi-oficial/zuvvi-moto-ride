import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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
      const { data: motoristaId } = await supabaseAdmin
        .from("usuarios")
        .select("id")
        .eq("auth_user_id", userId)
        .single();
      
      if (motoristaId) {
        await supabaseAdmin
          .from("motoristas")
          .update({ is_disponivel: false })
          .eq("id", motoristaId.id);
      }
      return { success: true, is_disponivel: false };
    }

    // REGRA 2: MOTORISTA - Validar se está aprovado e buscar dados da CNH
    const { data: usuario, error: uError } = await supabaseAdmin
      .from("usuarios")
      .select(`
        id, 
        is_motorista, 
        motoristas!inner(
          id,
          status_aprovacao,
          cnh_numero,
          cnh_categoria,
          cnh_validade
        )
      `)
      .eq("auth_user_id", userId)
      .single();

    if (uError || !usuario || !usuario.is_motorista) {
      throw new Error("Perfil de motorista não encontrado.");
    }

    const motorista = usuario.motoristas as any;
    if (motorista.status_aprovacao !== 'aprovado') {
      throw new Error("Seu perfil ainda não foi aprovado para ficar online.");
    }

    // REGRA 3: CNH - Validar número, categoria e validade
    if (!motorista.cnh_numero || !motorista.cnh_categoria || !motorista.cnh_validade) {
      throw new Error("Sua CNH está incompleta. Regularize-a para ficar online.");
    }

    const cat = motorista.cnh_categoria.toUpperCase();
    if (cat !== 'A' && cat !== 'AB') {
      throw new Error("Sua categoria de CNH não permite atuar como mototaxista.");
    }

    const validade = new Date(motorista.cnh_validade);
    const hoje = new Date();
    if (validade < hoje) {
      throw new Error("Sua CNH está vencida. Regularize-a para ficar online.");
    }

    // REGRA 4: VEÍCULO - Preservar Microetapa 1.1
    const { data: veiculo } = await supabaseAdmin
      .from("veiculos")
      .select("id, status_aprovacao")
      .eq("motorista_id", usuario.id)
      .eq("status_aprovacao", "aprovado")
      .eq("ativo", true)
      .maybeSingle();

    if (!veiculo) {
      throw new Error("Você precisa de um veículo aprovado para ficar online.");
    }

    // REGRA 5: DOCUMENTOS OBRIGATÓRIOS (6 tipos aprovados)
    const { data: documentos } = await supabaseAdmin
      .from("documentos_motorista")
      .select("tipo, status_analise")
      .or(`motorista_id.eq.${usuario.id},veiculo_id.eq.${veiculo.id}`);

    const tiposObrigatorios = [
      'identidade', 
      'cnh', 
      'comprovante_residencia', 
      'crlv', 
      'foto_veiculo', 
      'foto_placa'
    ];

    const docsAprovados = (documentos || [])
      .filter(d => d.status_analise === 'aprovado')
      .map(d => d.tipo);

    const temTodos = tiposObrigatorios.every(t => docsAprovados.includes(t));

    if (!temTodos) {
      throw new Error("Seus documentos precisam estar todos aprovados para ficar online.");
    }

    // Atualização final
    const { error: updateError } = await supabaseAdmin
      .from("motoristas")
      .update({ is_disponivel: true })
      .eq("id", usuario.id);

    if (updateError) {
      throw new Error("Erro ao atualizar status de disponibilidade: " + updateError.message);
    }

    return { success: true, is_disponivel: data.disponivel };
  });

export const getMotoristaStatusHome = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
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
    
    return {
      id: usuario.id,
      nome: usuario.nome,
      is_motorista: usuario.is_motorista,
      status_aprovacao: (usuario.motoristas as any).status_aprovacao,
      is_disponivel: (usuario.motoristas as any).is_disponivel
    };
  });
