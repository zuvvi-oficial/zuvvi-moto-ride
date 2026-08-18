import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

type TipoDocumento = Database["public"]["Enums"]["tipo_documento"];

/**
 * Funções Operacionais e Onboarding do Motorista - Zuvvi
 * Foco: Brasília/DF e Jacarezinho/PR (Pilotos)
 */

export const toggleDisponibilidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ disponivel: z.boolean() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: motoristaInfo, error: mError } = await supabaseAdmin
      .from("usuarios")
      .select(`
        id, 
        is_motorista, 
        cidade_id,
        cidades!inner(status, nome),
        motoristas!inner(status_aprovacao)
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
    
    // Validar motorista aprovado e ONLINE antes de gravar GPS
    const { data: motoristaInfo, error: mError } = await supabaseAdmin
      .from("usuarios")
      .select(`
        id, 
        motoristas!inner(status_aprovacao, is_disponivel)
      `)
      .eq("auth_user_id", context.userId)
      .single();

    if (mError || !motoristaInfo) throw new Error("Usuário não encontrado.");
    
    const motorista = (motoristaInfo.motoristas as any);
    if (motorista.status_aprovacao !== 'aprovado') throw new Error("Motorista não aprovado.");
    if (!motorista.is_disponivel) throw new Error("Motorista deve estar online para enviar GPS.");

    const { error } = await supabaseAdmin
      .from("motoristas")
      .update({ 
        ultima_lat: data.lat, 
        ultima_lng: data.lng, 
        ultima_localizacao_at: new Date().toISOString() 
      })
      .eq("id", motoristaInfo.id);

    if (error) throw new Error("Erro ao atualizar localização GPS.");
    return { success: true };
  });

export const getOfertasDisponiveis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data: user, error: uError } = await supabaseAdmin
      .from("usuarios")
      .select(`
        id, 
        cidade_id, 
        cidades!inner(status),
        motoristas!inner(is_disponivel, status_aprovacao, ultima_localizacao_at)
      `)
      .eq("auth_user_id", context.userId)
      .single();

    if (uError || !user) return [];
    
    const motorista = (user.motoristas as any);
    const cidade = (user.cidades as any);

    // Filtros de elegibilidade básicos
    if (!motorista.is_disponivel || motorista.status_aprovacao !== 'aprovado') return [];
    if (cidade.status !== 'piloto' && cidade.status !== 'ativa') return [];

    // Exigir veículo aprovado/ativo
    const { data: veiculo } = await supabaseAdmin
      .from("veiculos")
      .select("id")
      .eq("motorista_id", user.id)
      .eq("status_aprovacao", "aprovado")
      .eq("ativo", true)
      .maybeSingle();

    if (!veiculo) return [];

    // GPS recente (5 minutos)
    const cincoMinutosAtras = new Date(Date.now() - 5 * 60 * 1000);
    if (!motorista.ultima_localizacao_at || new Date(motorista.ultima_localizacao_at) < cincoMinutosAtras) {
      return [];
    }

    if (!user.cidade_id) return [];

    const { data: recusas } = await supabaseAdmin
      .from("motorista_recusas")
      .select("corrida_id")
      .eq("motorista_id", user.id);
    
    const idsRecusados = (recusas?.map((r: any) => r.corrida_id) || []).filter((id): id is string => id !== null);

    let query = supabaseAdmin
      .from("corridas")
      .select("id, origem_nome, destino_nome, valor_estimado, forma_pagamento, created_at")
      .eq("cidade_id", user.cidade_id)
      .eq("status", 'solicitada')
      .is("motorista_id", null);

    if (idsRecusados.length > 0) {
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

    // 1. Validações completas do motorista e veículo
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

    // Proteção contra duas corridas simultâneas para o mesmo motorista
    const { data: corridaAtiva } = await supabaseAdmin
      .from("corridas")
      .select("id")
      .eq("motorista_id", motoristaInfo.id)
      .in("status", ["aceita", "em_andamento"])
      .maybeSingle();

    if (corridaAtiva) throw new Error("Você já possui uma corrida ativa em andamento.");

    const cincoMinutosAtras = new Date(Date.now() - 5 * 60 * 1000);
    if (!motorista.ultima_localizacao_at || new Date(motorista.ultima_localizacao_at) < cincoMinutosAtras) {
      throw new Error("Sinal de GPS desatualizado. Por favor, aguarde a atualização da localização.");
    }

    const { data: veiculo } = await supabaseAdmin
      .from("veiculos")
      .select("id")
      .eq("motorista_id", motoristaInfo.id)
      .eq("status_aprovacao", "aprovado")
      .eq("ativo", true)
      .maybeSingle();

    if (!veiculo) throw new Error("Veículo não disponível ou não aprovado.");

    // 2. Aceite Transacional (Atomic Update)
    const { data: corrida, error: uError } = await supabaseAdmin
      .from("corridas")
      .update({ 
        motorista_id: motoristaInfo.id, 
        status: 'aceita', 
        data_aceite: new Date().toISOString() 
      })
      .eq("id", data.rideId)
      .eq("status", 'solicitada')
      .eq("cidade_id", motoristaInfo.cidade_id as string)
      .is("motorista_id", null)
      .select()
      .maybeSingle();

    if (uError) throw new Error("Falha ao processar o aceite.");
    
    if (!corrida) {
      throw new Error("Esta corrida já foi aceita por outro piloto ou não é mais elegível.");
    }

    // 3. Marcar motorista como indisponível
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
    
    // Validar motorista aprovado e pertencente à cidade da corrida
    const { data: motoristaInfo, error: mError } = await supabaseAdmin
      .from("usuarios")
      .select(`
        id, 
        cidade_id,
        motoristas!inner(status_aprovacao)
      `)
      .eq("auth_user_id", context.userId)
      .single();

    if (mError || !motoristaInfo) throw new Error("Motorista não encontrado.");
    
    const motorista = (motoristaInfo.motoristas as any);
    if (motorista.status_aprovacao !== 'aprovado') throw new Error("Motorista não aprovado.");

    const { data: corrida, error: cError } = await supabaseAdmin
      .from("corridas")
      .select("id, cidade_id, status")
      .eq("id", data.rideId)
      .single();

    if (cError || !corrida) throw new Error("Corrida não encontrada.");
    if (corrida.cidade_id !== motoristaInfo.cidade_id) throw new Error("Corrida não pertence à sua cidade.");
    if (corrida.status !== 'solicitada') throw new Error("A corrida não está mais disponível.");

    const { error } = await supabaseAdmin
      .from("motorista_recusas")
      .insert({
        motorista_id: motoristaInfo.id,
        corrida_id: data.rideId
      });

    if (error && (error as any).code !== '23505') { 
      throw new Error("Erro ao registrar recusa.");
    }

    return { success: true };
  });

export const getUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ tipo: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const tipo = data.tipo as TipoDocumento;

    const fileName = `${userId}/${tipo}_${Date.now()}`;
    
    const { data: uploadData, error } = await supabaseAdmin.storage
      .from('documentos-motorista')
      .createSignedUploadUrl(fileName);

    if (error) throw new Error("Erro ao gerar URL de upload: " + error.message);

    return { 
      uploadUrl: uploadData.signedUrl, 
      storagePath: uploadData.path,
      token: uploadData.token 
    };
  });

export const registrarDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ 
    tipo: z.string(), 
    storagePath: z.string() 
  }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const tipo = data.tipo as TipoDocumento;

    const { data: motorista } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", userId)
      .single();

    if (!motorista) throw new Error("Motorista não encontrado.");

    const { error } = await supabaseAdmin
      .from("documentos_motorista")
      .upsert({
        motorista_id: motorista.id,
        tipo_documento: tipo,
        storage_path: data.storagePath,
        status_analise: 'pendente',
        data_envio: new Date().toISOString()
      }, { onConflict: 'motorista_id,tipo_documento' } as any);

    if (error) throw new Error("Erro ao registrar documento: " + error.message);
    return { success: true };
  });

export const salvarDadosCNH = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    cnh_numero: z.string(),
    cnh_categoria: z.string(),
    cnh_validade: z.string(),
    chave_pix: z.string()
  }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data: user } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", context.userId)
      .single();

    if (!user) throw new Error("Usuário não encontrado.");

    const { error } = await supabaseAdmin
      .from("motoristas")
      .update({
        cnh_numero: data.cnh_numero,
        cnh_categoria: data.cnh_categoria,
        cnh_validade: data.cnh_validade,
        chave_pix: data.chave_pix
      })
      .eq("id", user.id);

    if (error) throw new Error("Erro ao salvar dados: " + error.message);
    return { success: true };
  });

export const criarVeiculo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    placa: z.string(),
    marca: z.string(),
    modelo: z.string(),
    ano: z.number(),
    cor: z.string()
  }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data: user } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", context.userId)
      .single();

    if (!user) throw new Error("Usuário não encontrado.");

    const { error } = await supabaseAdmin
      .from("veiculos")
      .upsert({
        motorista_id: user.id,
        ...data,
        status_aprovacao: 'em_preenchimento',
        ativo: true
      }, { onConflict: 'motorista_id' } as any);

    if (error) throw new Error("Erro ao salvar veículo: " + error.message);
    return { success: true };
  });

export const enviarParaAnalise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data: user } = await supabaseAdmin
      .from("usuarios")
      .select("id, motoristas!inner(*)")
      .eq("auth_user_id", context.userId)
      .single();

    if (!user) throw new Error("Usuário não encontrado.");
    const motorista = user.motoristas as any;

    const { data: docs } = await supabaseAdmin
      .from("documentos_motorista")
      .select("tipo_documento")
      .eq("motorista_id", user.id);

    const tiposEnviados = docs?.map(d => d.tipo_documento) || [];
    const tiposObrigatorios = ['identidade', 'cnh', 'comprovante_residencia', 'crlv', 'foto_veiculo', 'foto_placa'];
    const faltantes = tiposObrigatorios.filter(t => !tiposEnviados.includes(t as any));

    if (faltantes.length > 0) {
      throw new Error(`Documentos faltantes: ${faltantes.join(', ')}`);
    }

    if (!motorista.cnh_numero || !motorista.cnh_categoria || !motorista.cnh_validade || !motorista.chave_pix) {
      throw new Error("Dados de CNH ou Pix incompletos.");
    }

    const { data: veiculo } = await supabaseAdmin
      .from("veiculos")
      .select("id")
      .eq("motorista_id", user.id)
      .single();

    if (!veiculo) throw new Error("Veículo não cadastrado.");

    const { error: mErr } = await supabaseAdmin
      .from("motoristas")
      .update({ status_aprovacao: 'em_analise' } as any)
      .eq("id", user.id);

    const { error: vErr } = await supabaseAdmin
      .from("veiculos")
      .update({ status_aprovacao: 'em_analise' } as any)
      .eq("motorista_id", user.id);

    if (mErr || vErr) throw new Error("Erro ao enviar para análise.");

    return { success: true };
  });
