import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Funções Operacionais do Motorista - Zuvvi
 * Foco: Brasília/DF e Jacarezinho/PR (Pilotos)
 */

export const toggleDisponibilidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ disponivel: z.boolean() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // 1. Validar motorista, aprovação e cidade piloto
    const { data: motoristaInfo, error: mError } = await supabaseAdmin
      .from("usuarios")
      .select(`
        id, 
        is_motorista, 
        cidade_id,
        cidades!inner(status, nome),
        motoristas!inner(status_aprovacao, ultima_lat)
      `)
      .eq("auth_user_id", userId)
      .single();

    if (mError || !motoristaInfo?.is_motorista) {
      throw new Error("Perfil de motorista não encontrado ou não autorizado.");
    }

    const motorista = (motoristaInfo.motoristas as any);
    const cidade = (motoristaInfo.cidades as any);

    if (motorista.status_aprovacao !== 'aprovado') {
      throw new Error("Seu perfil ainda não foi aprovado pela administração.");
    }

    if (cidade.status !== 'piloto' && cidade.status !== 'ativa') {
      throw new Error(`Zuvvi ainda não opera em ${cidade.nome}.`);
    }

    // 2. Verificar se tem veículo aprovado e ativo
    const { data: veiculo, error: vError } = await supabaseAdmin
      .from("veiculos")
      .select("id")
      .eq("motorista_id", motoristaInfo.id)
      .eq("status_aprovacao", "aprovado")
      .eq("ativo", true)
      .maybeSingle();

    if (vError || !veiculo) {
      throw new Error("Você precisa de um veículo aprovado e ativo para ficar online.");
    }

    // 3. Ao ficar online, exige localização recente (ou espera o primeiro watchPosition)
    // Se estiver tentando ficar online sem nunca ter enviado GPS, permitimos mas bloqueamos ofertas até o GPS chegar

    const { error } = await supabaseAdmin
      .from("motoristas")
      .update({ is_disponivel: data.disponivel })
      .eq("id", motoristaInfo.id);

    if (error) throw new Error("Erro ao atualizar status de disponibilidade.");
    return { success: true };
  });

export const updateLocalizacaoMotorista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ 
    lat: z.number(), 
    lng: z.number() 
  }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data: usuario } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", context.userId)
      .single();

    if (!usuario) throw new Error("Usuário não encontrado.");

    const { error } = await supabaseAdmin
      .from("motoristas")
      .update({ 
        ultima_lat: data.lat, 
        ultima_lng: data.lng, 
        ultima_localizacao_at: new Date().toISOString() 
      })
      .eq("id", usuario.id);

    if (error) throw new Error("Erro ao atualizar localização GPS.");
    return { success: true };
  });

export const getOfertasDisponiveis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // 1. Pegar dados do motorista logado
    const { data: user, error: uError } = await supabaseAdmin
      .from("usuarios")
      .select(`
        id, 
        cidade_id, 
        motoristas!inner(is_disponivel, status_aprovacao, ultima_localizacao_at)
      `)
      .eq("auth_user_id", context.userId)
      .single();

    if (uError || !user) return [];
    
    const motorista = (user.motoristas as any);

    // 2. Filtros de elegibilidade para ver ofertas
    if (!motorista.is_disponivel || motorista.status_aprovacao !== 'aprovado') {
      return [];
    }

    // GPS deve ter sido atualizado nos últimos 5 minutos
    const cincoMinutosAtras = new Date(Date.now() - 5 * 60 * 1000);
    if (!motorista.ultima_localizacao_at || new Date(motorista.ultima_localizacao_at) < cincoMinutosAtras) {
      // Opcional: registrar log de motorista online mas sem GPS atualizado
      return [];
    }

    if (!user.cidade_id) return [];

    // 3. Buscar recusas do motorista para filtrar
    const { data: recusas } = await supabaseAdmin
      .from("motorista_recusas" as any)
      .select("corrida_id")
      .eq("motorista_id", user.id);
    
    const idsRecusados = recusas?.map((r: any) => r.corrida_id) || [];

    // 4. Buscar corridas solicitadas na cidade do motorista
    let query = supabaseAdmin
      .from("corridas")
      .select("id, origem_nome, destino_nome, valor_estimado, forma_pagamento, created_at")
      .eq("cidade_id", user.cidade_id)
      .eq("status", 'solicitada')
      .is("motorista_id", null);

    if (idsRecusados.length > 0) {
      // @ts-ignore - Supabase type for .in with strings
      query = query.not("id", "in", `(${idsRecusados.join(',')})`);
    }

    const { data: ofertas } = await query
      .order("created_at", { ascending: false })
      .limit(10);

    return ofertas || [];
  });

export const aceitarCorrida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ rideId: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // 1. Validações completas do motorista e veículo (Server-side)
    const { data: motoristaInfo, error: mError } = await supabaseAdmin
      .from("usuarios")
      .select(`
        id, 
        cidade_id,
        motoristas!inner(is_disponivel, status_aprovacao, ultima_localizacao_at)
      `)
      .eq("auth_user_id", userId)
      .single();

    if (mError || !motoristaInfo) throw new Error("Motorista não identificado.");
    
    const motorista = (motoristaInfo.motoristas as any);

    if (motorista.status_aprovacao !== 'aprovado') throw new Error("Perfil não aprovado.");
    if (!motorista.is_disponivel) throw new Error("Você precisa estar online.");

    // Verificar GPS recente (5 min)
    const cincoMinutosAtras = new Date(Date.now() - 5 * 60 * 1000);
    if (!motorista.ultima_localizacao_at || new Date(motorista.ultima_localizacao_at) < cincoMinutosAtras) {
      throw new Error("Sinal de GPS fraco ou desatualizado. Verifique sua conexão.");
    }

    const { data: veiculo } = await supabaseAdmin
      .from("veiculos")
      .select("id")
      .eq("motorista_id", motoristaInfo.id)
      .eq("status_aprovacao", "aprovado")
      .eq("ativo", true)
      .maybeSingle();

    if (!veiculo) throw new Error("Veículo não disponível ou não aprovado.");

    if (!motoristaInfo.cidade_id) throw new Error("Cidade do motorista não definida.");

    // 2. Aceite Transacional (Atomic Update)
    // Garante que motorista_id seja nulo, status seja solicitada e a cidade coincida
    const { data: corrida, error: uError } = await supabaseAdmin
      .from("corridas")
      .update({ 
        motorista_id: motoristaInfo.id, 
        status: 'aceita', 
        data_aceite: new Date().toISOString() 
      })
      .eq("id", data.rideId)
      .eq("status", 'solicitada')
      .eq("cidade_id", motoristaInfo.cidade_id)
      .is("motorista_id", null)
      .select()
      .maybeSingle();

    if (uError) {
      console.error("Erro no aceite transacional:", uError);
      throw new Error("Falha ao processar o aceite.");
    }
    
    if (!corrida) {
      throw new Error("Esta corrida já foi aceita por outro piloto ou não é mais elegível.");
    }

    // 3. Marcar motorista como indisponível para novas ofertas
    await supabaseAdmin
      .from("motoristas")
      .update({ is_disponivel: false })
      .eq("id", motoristaInfo.id);

    return { success: true };
  });

export const recusarCorrida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ rideId: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data: user } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", context.userId)
      .single();

    if (!user) throw new Error("Usuário não encontrado.");

    const { error } = await supabaseAdmin
      .from("motorista_recusas" as any)
      .insert({
        motorista_id: user.id,
        corrida_id: data.rideId
      });

    if (error && (error as any).code !== '23505') { // Ignora erro de duplicata (já recusado)
      throw new Error("Erro ao registrar recusa.");
    }

    return { success: true };
  });
