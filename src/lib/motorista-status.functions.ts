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

    // 1. Buscar informações do motorista e validar se ele está aprovado
    const { data: usuario, error: uError } = await supabaseAdmin
      .from("usuarios")
      .select(`
        id, 
        is_motorista, 
        motoristas!inner(status_aprovacao)
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

    // 2. Validar se existe um veículo aprovado
    const { data: veiculo } = await supabaseAdmin
      .from("veiculos")
      .select("id, status_aprovacao")
      .eq("motorista_id", usuario.id)
      .eq("status_aprovacao", "aprovado")
      .eq("ativo", true)
      .maybeSingle();

    if (!veiculo && data.disponivel) {
      throw new Error("Você precisa de um veículo aprovado para ficar online.");
    }

    // 3. Atualizar a disponibilidade
    const { error: updateError } = await supabaseAdmin
      .from("motoristas")
      .update({ is_disponivel: data.disponivel })
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
