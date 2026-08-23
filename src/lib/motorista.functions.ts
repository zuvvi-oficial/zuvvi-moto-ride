import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

type TipoDocumento = Database["public"]["Enums"]["tipo_documento"];

/**
 * Funções Operacionais e Onboarding do Motorista - Zuvvi
 * Foco: Brasília/DF e Jacarezinho/PR (Pilotos)
 */

export const getOnboardingData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const authUserId = context.userId;

    const { data: userData, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select(`
        id,
        is_motorista
      `)
      .eq("auth_user_id", authUserId)
      .single();

    if (userError || !userData) {
      throw new Error("Usuário não encontrado.");
    }

    if (!userData.is_motorista) {
      throw new Error("Acesso restrito a motoristas.");
    }

    const motoristaId = userData.id;

    // Buscar motorista
    const { data: motorista, error: motoristaError } = await supabaseAdmin
      .from("motoristas")
      .select("cnh_numero, cnh_categoria, cnh_validade, chave_pix, tipo_chave_pix")
      .eq("id", motoristaId)
      .maybeSingle();

    if (motoristaError) {
      throw new Error("Erro ao carregar dados do motorista.");
    }

    if (userData.is_motorista && !motorista) {
      throw new Error("Perfil de motorista não encontrado.");
    }

    // Buscar veículo
    const { data: veiculoData, error: veiculoError } = await supabaseAdmin
      .from("veiculos")
      .select("id, placa, ano, marca, modelo, cor, status_aprovacao, ativo")
      .eq("motorista_id", motoristaId)
      .maybeSingle();

    if (veiculoError) {
      throw new Error("Erro ao carregar dados do veículo.");
    }

    // Buscar documentos
    const { data: docsData, error: docsError } = await supabaseAdmin
      .from("documentos_motorista")
      .select("tipo_documento, status_analise, motivo_recusa")
      .eq("motorista_id", motoristaId);

    if (docsError) {
      throw new Error("Erro ao carregar documentos.");
    }

    return {
      motorista: motorista || null,
      veiculo: veiculoData || null,
      documentos: docsData || []
    };
  });

export const getMotoristaStatusFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const authUserId = context.userId;

    const { data: userData, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id, is_motorista")
      .eq("auth_user_id", authUserId)
      .single();

    if (userError || !userData) {
      throw new Error("Usuário não encontrado.");
    }

    if (!userData.is_motorista) {
      throw new Error("Acesso restrito a motoristas.");
    }

    const motoristaId = userData.id;

    const { data: motorista, error: motoristaError } = await supabaseAdmin
      .from("motoristas")
      .select("status_aprovacao")
      .eq("id", motoristaId)
      .single();

    if (motoristaError || !motorista) {
      throw new Error("Perfil de motorista não encontrado.");
    }

    let acao: string | null = null;
    if (motorista.status_aprovacao === "recusado") {
      acao = "status_update_recusado";
    } else if (motorista.status_aprovacao === "suspenso") {
      acao = "status_update_suspenso";
    }

    if (acao) {
      const { data: auditLog, error: auditError } = await supabaseAdmin
        .from("admin_audit_logs")
        .select("justificativa, created_at")
        .eq("entidade", "motoristas")
        .eq("entidade_id", motoristaId)
        .eq("acao", acao)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (auditError) {
        throw new Error("Erro ao carregar detalhes do status do motorista.");
      }

      return {
        status: motorista.status_aprovacao,
        justificativa: auditLog?.justificativa || null,
        created_at: auditLog?.created_at || null
      };
    }

    return {
      status: motorista.status_aprovacao,
      justificativa: null,
      created_at: null
    };
  });

export const updateLocalizacaoMotorista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ 
    lat: z.number(), 
    lng: z.number() 
  }).parse(data))


  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { evaluateMotoristaOperationalEligibility } = await import("./motorista-eligibility.server");
    
    // Validar elegibilidade central (garante offline se necessário)
    const eligibility = await evaluateMotoristaOperationalEligibility(supabaseAdmin, context.userId);
    
    if (!eligibility.eligible) {
      throw new Error(eligibility.message || "Motorista não elegível.");
    }

    const { data: motoristaInfo, error: mError } = await supabaseAdmin
      .from("usuarios")
      .select(`
        id, 
        motoristas!inner(is_disponivel)
      `)
      .eq("auth_user_id", context.userId)
      .single();

    if (mError || !motoristaInfo) throw new Error("Usuário não encontrado.");
    
    const motorista = (motoristaInfo.motoristas as any);
    
    // Regra consolidada: Disponível OU Possui Corrida Ativa
    if (!motorista.is_disponivel) {
      const { data: activeRides, error: rideError } = await supabaseAdmin
        .from("corridas")
        .select("id")
        .eq("motorista_id", motoristaInfo.id)
        .in("status", ["aceita", "motorista_a_caminho", "motorista_chegou", "em_andamento"]);

      if (rideError) throw new Error("Erro ao validar estado da corrida.");
      
      if (!activeRides || activeRides.length === 0) {
        throw new Error("Motorista deve estar online ou em corrida ativa para enviar GPS.");
      }

      if (activeRides.length > 1) {
        throw new Error("Múltiplas corridas ativas detectadas (Inconsistência).");
      }
    }

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
    const { evaluateMotoristaOperationalEligibility } = await import("./motorista-eligibility.server");

    const eligibility = await evaluateMotoristaOperationalEligibility(supabaseAdmin, context.userId);
    if (!eligibility.eligible) return [];

    const { data: user, error: uError } = await supabaseAdmin
      .from("usuarios")
      .select(`
        id, 
        cidade_id, 
        cidades!inner(status),
        motoristas!inner(is_disponivel, ultima_localizacao_at, ultima_lat, ultima_lng)
      `)
      .eq("auth_user_id", context.userId)
      .single();

    if (uError || !user) return [];
    
    const motorista = (user.motoristas as any);
    const cidade = (user.cidades as any);

    if (!motorista.is_disponivel) return [];
    if (cidade.status !== 'piloto' && cidade.status !== 'ativa') return [];

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

    const { data: allCandidates } = await supabaseAdmin
      .from("corridas")
      .select("id, origem_nome, destino_nome, valor_estimado, forma_pagamento, created_at, origem_lat, origem_lng, passageiro_id")
      .eq("cidade_id", user.cidade_id)
      .eq("status", 'solicitada')
      .is("motorista_id", null);

    if (!allCandidates || allCandidates.length === 0) return [];

    // 1. Extrair passageiro_id dos candidatos
    const uniquePassengerIds = Array.from(new Set(allCandidates.map(c => c.passageiro_id)));

    // 2. Consultar a corrida MAIS RECENTE ABSOLUTA de cada um desses passageiros
    // Sem filtrar por status, para detectar se a solicitada é obsoleta
    const { data: latestRides } = await supabaseAdmin
      .from("corridas")
      .select("id, passageiro_id, created_at")
      .in("passageiro_id", uniquePassengerIds)
      .order("created_at", { ascending: false });

    const absoluteLatestIds = new Set<string>();
    if (latestRides) {
      const processedPass = new Set<string>();
      for (const r of latestRides) {
        if (!processedPass.has(r.passageiro_id)) {
          absoluteLatestIds.add(r.id);
          processedPass.add(r.passageiro_id);
        }
      }
    }

    const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371e3;
      const φ1 = lat1 * Math.PI / 180;
      const φ2 = lat2 * Math.PI / 180;
      const Δφ = (lat2 - lat1) * Math.PI / 180;
      const Δλ = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    // Validação de coordenadas do motorista (Hardening)
    if (!Number.isFinite(motorista.ultima_lat) || !Number.isFinite(motorista.ultima_lng)) {
      return [];
    }

    const ofertas = allCandidates
      .filter(ride => {
        // Filtro de recusa
        if (idsRecusados.includes(ride.id)) return false;
        
        // Filtro de obsolescência: id deve ser o mais recente absoluto do passageiro
        if (!absoluteLatestIds.has(ride.id)) return false;

        // Validação de coordenadas da corrida
        if (!Number.isFinite(ride.origem_lat) || !Number.isFinite(ride.origem_lng)) return false;

        return true;
      })
      .map((ride: any) => ({
        ...ride,
        distancia_aprox_m: Math.round(haversine(motorista.ultima_lat, motorista.ultima_lng, ride.origem_lat, ride.origem_lng))
      }))
      .sort((a, b) => a.distancia_aprox_m - b.distancia_aprox_m || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map(({ id, origem_nome, destino_nome, valor_estimado, forma_pagamento, created_at, distancia_aprox_m }) => ({
        id, origem_nome, destino_nome, valor_estimado, forma_pagamento, created_at, distancia_aprox_m
      }));

    return ofertas;
  });

export const aceitarCorrida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ rideId: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // 1. Validações server-side completas via regra central
    const { evaluateMotoristaOperationalEligibility } = await import("./motorista-eligibility.server");
    const eligibility = await evaluateMotoristaOperationalEligibility(supabaseAdmin, userId);

    if (!eligibility.eligible) {
      throw new Error(eligibility.message || "Motorista não elegível para aceitar corrida.");
    }

    const { data: user, error: uError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", userId)
      .single();

    if (uError || !user) throw new Error("Motorista não identificado.");
    const motoristaId = user.id;

    // GPS recente (5 minutos) - Mantido conforme exigência
    const { data: motoristaLoc } = await supabaseAdmin
      .from("motoristas")
      .select("ultima_localizacao_at, is_disponivel")
      .eq("id", motoristaId)
      .single();

    if (!motoristaLoc?.is_disponivel) {
      throw new Error("Você precisa estar online.");
    }

    const cincoMinutosAtras = new Date(Date.now() - 5 * 60 * 1000);
    if (!motoristaLoc?.ultima_localizacao_at || new Date(motoristaLoc.ultima_localizacao_at) < cincoMinutosAtras) {
      throw new Error("Sinal de GPS desatualizado. Por favor, aguarde a atualização da localização.");
    }

    // 2. Aceite Atômico via RPC
    const { error: rpcError } = await supabaseAdmin.rpc("accept_corrida_atomic", {
      p_corrida_id: data.rideId,
      p_motorista_id: motoristaId
    });

    if (rpcError) {
      // Mapear erros controlados para mensagens humanas
      if (rpcError.message.includes("já possui uma corrida ativa")) {
        throw new Error("Você já possui uma corrida ativa em andamento.");
      }
      if (rpcError.message.includes("indisponível ou cidade incompatível")) {
        throw new Error("Esta corrida já foi aceita por outro piloto ou não é mais elegível.");
      }
      if (rpcError.message.includes("não está disponível")) {
        throw new Error("Você precisa estar online.");
      }
      
      throw new Error("Falha ao processar o aceite. Tente novamente.");
    }

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

export const cancelarCorridaMotorista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ rideId: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const authUserId = context.userId;

    // 1. Obter o perfil do motorista
    const { data: user, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", authUserId)
      .single();

    if (userError || !user) throw new Error("Motorista não encontrado.");
    const motoristaId = user.id;

    // 2. Tentar cancelar a corrida (deve pertencer a este motorista e estar em status cancelável)
    const { data: corrida, error: updateError } = await supabaseAdmin
      .from("corridas")
      .update({
        status: 'cancelada',
        cancelado_por: 'motorista',
        data_cancelamento: new Date().toISOString()
      } as any)
      .eq("id", data.rideId)
      .eq("motorista_id", motoristaId)
      // Regra: motorista só pode cancelar ANTES de iniciar a viagem (em_andamento).
      // A permissão temporária 3.6-C para cancelar em_andamento foi revogada na 3.7.
      .in("status", ['aceita', 'motorista_a_caminho', 'motorista_chegou'])
      .select()
      .maybeSingle();

    if (updateError) {
      console.error("Erro ao cancelar corrida (motorista):", updateError);
      throw new Error("Falha ao cancelar a corrida no servidor.");
    }

    if (!corrida) {
      throw new Error("Não foi possível cancelar esta corrida. Verifique se ela ainda está ativa.");
    }

    // 3. O motorista já fica offline por regra de negócio do aceite (accept_corrida_atomic),
    // mas garantimos que o status de disponibilidade seja resetado se necessário.
    // Como a Home Motorista depende de motorista-status, invalidar a query será suficiente.

    return { success: true };
  });


export const marcarMotoristaACaminho = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ rideId: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const authUserId = context.userId;

    // 1. Obter o perfil do motorista para validar ownership
    const { data: user, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", authUserId)
      .single();

    if (userError || !user) throw new Error("Motorista não identificado.");
    const motoristaId = user.id;

    // 2. Atualização Atômica: status 'aceita' -> 'motorista_a_caminho'
    const { data: updatedRide, error: updateError } = await supabaseAdmin
      .from("corridas")
      .update({
        status: "motorista_a_caminho",
      } as any)
      .eq("id", data.rideId)
      .eq("motorista_id", motoristaId)
      .eq("status", "aceita")
      .select("id, status")
      .maybeSingle();

    if (updateError) {
      console.error("Erro ao iniciar deslocamento:", updateError);
      throw new Error("Falha ao processar deslocamento no servidor.");
    }

    if (!updatedRide) {
      throw new Error("Não foi possível iniciar o deslocamento. Verifique o estado atual da corrida.");
    }

    return {
      success: true,
      status: updatedRide.status
    };
  });


export const marcarMotoristaChegou = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ rideId: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const authUserId = context.userId;

    // 1. Obter o perfil do motorista para validar ownership
    const { data: user, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", authUserId)
      .single();

    if (userError || !user) throw new Error("Motorista não encontrado.");
    const motoristaId = user.id;

    // 2. Tentar atualizar para motorista_chegou
    const { data: updatedRide, error: updateError } = await supabaseAdmin
      .from("corridas")
      .update({
        status: 'motorista_chegou',
        data_chegada_motorista: new Date().toISOString()
      } as any)
      .eq("id", data.rideId)
      .eq("motorista_id", motoristaId)
      .eq("status", "motorista_a_caminho")
      .select()
      .maybeSingle();

    if (updateError) {
      console.error("Erro ao confirmar chegada (motorista):", updateError);
      throw new Error("Falha ao confirmar a chegada no servidor.");
    }

    if (!updatedRide) {
      throw new Error("Não foi possível confirmar a chegada. Verifique o estado atual da corrida.");
    }

    return {
      success: true,
      status: updatedRide.status
    };
  });

export const iniciarCorrida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ rideId: z.string(), codigo: z.string().length(4) }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const authUserId = context.userId;

    // 1. Resolver o motorista pelo servidor
    const { data: user, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", authUserId)
      .single();

    if (userError || !user) throw new Error("Motorista não identificado.");
    const motoristaId = user.id;

    // 2. Buscar a corrida e validar o código
    const { data: corrida, error: corridaError } = await supabaseAdmin
      .from("corridas")
      .select("id, codigo_embarque, status")
      .eq("id", data.rideId)
      .eq("motorista_id", motoristaId)
      .single();

    if (corridaError || !corrida) throw new Error("Corrida não encontrada.");
    
    if (corrida.status !== 'motorista_chegou') {
      throw new Error("A corrida deve estar no estado 'motorista_chegou' para ser iniciada.");
    }

    if (corrida.codigo_embarque !== data.codigo) {
      throw new Error("Código incorreto. Confira com o passageiro.");
    }

    // 3. Update condicionado
    const { data: updatedRide, error: updateError } = await supabaseAdmin
      .from("corridas")
      .update({
        status: 'em_andamento',
        data_inicio: new Date().toISOString()
      } as any)
      .eq("id", data.rideId)
      .eq("motorista_id", motoristaId)
      .eq("status", 'motorista_chegou')
      .select("id, status")
      .maybeSingle();

    if (updateError) {
      console.error("Erro ao iniciar corrida (backend):", updateError);
      throw new Error("Falha ao iniciar a corrida no servidor.");
    }

    if (!updatedRide) {
      throw new Error("Não foi possível iniciar a corrida. Verifique o estado atual.");
    }

    return {
      success: true,
      status: updatedRide.status
    };
  });

export const getUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ 
    tipo: z.string(),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']).optional(),
    fileSize: z.number().int().positive().max(10 * 1024 * 1024).optional() // 10MB
  }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const tipo = data.tipo as TipoDocumento;

    // Extensão baseada no mimeType para facilitar identificação posterior
    let ext = "";
    if (data.mimeType) {
      ext = "." + data.mimeType.split('/')[1];
    }

    const fileName = `${userId}/${tipo}_${Date.now()}${ext}`;
    
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

    // --- Início da Validação de Segurança do Arquivo ---
    const pathParts = data.storagePath.split('/');
    const basename = pathParts[pathParts.length - 1];

    const { data: files, error: listError } = await supabaseAdmin.storage
      .from('documentos-motorista')
      .list(userId, { search: basename });

    if (listError) throw new Error("Erro ao verificar o arquivo no servidor.");

    const objeto = (files || []).find((f) => f.name === basename);
    if (!objeto) throw new Error("Arquivo não encontrado no servidor.");

    const realSize = (objeto.metadata as { size?: unknown } | null)?.size;
    if (
      typeof realSize !== 'number' ||
      !Number.isFinite(realSize) ||
      realSize <= 0 ||
      realSize > 10 * 1024 * 1024 // 10MB
    ) {
      await supabaseAdmin.storage.from('documentos-motorista').remove([data.storagePath]);
      throw new Error("Arquivo possui tamanho inválido ou é muito grande (limite 10MB).");
    }

    const { data: blob, error: downloadError } = await supabaseAdmin.storage
      .from('documentos-motorista')
      .download(data.storagePath);

    if (downloadError || !blob) {
      await supabaseAdmin.storage.from('documentos-motorista').remove([data.storagePath]);
      throw new Error("Erro ao validar o conteúdo do arquivo.");
    }

    const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
    
    // JPEG: FF D8 FF
    const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const isPng = pngSig.every((b, i) => head[i] === b);
    
    // WEBP: RIFF....WEBP
    const ascii = (start: number, end: number) =>
      String.fromCharCode(...Array.from(head.slice(start, end)));
    const isWebp = ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
    
    // PDF: %PDF (25 50 44 46)
    const isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46;

    if (!isJpeg && !isPng && !isWebp && !isPdf) {
      await supabaseAdmin.storage.from('documentos-motorista').remove([data.storagePath]);
      throw new Error("Arquivo inválido. Envie uma imagem (JPEG, PNG, WEBP) ou PDF válido.");
    }
    // --- Fim da Validação de Segurança do Arquivo ---

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
    chave_pix: z.string(),
    tipo_chave_pix: z.enum(['cpf', 'telefone', 'email', 'aleatoria']).optional()
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
        chave_pix: data.chave_pix,
        tipo_chave_pix: data.tipo_chave_pix as any
      } as any)
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

export const getCnhCorrectionState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const authUserId = context.userId;

    // Resolver context.userId -> usuarios.auth_user_id -> usuarios.id
    const { data: userData, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id, is_motorista")
      .eq("auth_user_id", authUserId)
      .single();

    if (userError || !userData) {
      throw new Error("Usuário não encontrado.");
    }

    if (!userData.is_motorista) {
      throw new Error("Acesso restrito a motoristas.");
    }

    const motoristaId = userData.id;

    // Buscar motorista
    const { data: motorista, error: motoristaError } = await supabaseAdmin
      .from("motoristas")
      .select("status_aprovacao, cnh_numero, cnh_categoria, cnh_validade")
      .eq("id", motoristaId)
      .single();

    if (motoristaError || !motorista) {
      throw new Error("Perfil de motorista não encontrado.");
    }

    // Buscar documento CNH
    const { data: doc, error: docError } = await supabaseAdmin
      .from("documentos_motorista")
      .select("status_analise, motivo_recusa")
      .eq("motorista_id", motoristaId)
      .eq("tipo_documento", "cnh")
      .maybeSingle();

    if (docError) {
      throw new Error("Erro ao consultar documentos.");
    }

    // Regra de Data America/Sao_Paulo (Dia Civil)
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const hojeStr = formatter.format(now); // YYYY-MM-DD
    
    const isExpired = !!motorista.cnh_validade && motorista.cnh_validade < hojeStr;
    const documentStatus = doc?.status_analise || null;
    const needsCorrection = isExpired || documentStatus === 'correcao_solicitada';
    
    return {
      status_aprovacao: motorista.status_aprovacao,
      cnh_numero: motorista.cnh_numero,
      cnh_categoria: motorista.cnh_categoria,
      cnh_validade: motorista.cnh_validade,
      document_status: documentStatus,
      motivo_correcao: documentStatus === 'correcao_solicitada' ? doc?.motivo_recusa : null,
      is_expired: isExpired,
      needs_correction: needsCorrection
    };
  });

export const enviarParaAnalise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    console.log(`[ONBOARDING] Iniciando submissão RPC para usuário: ${userId}`);

    // Chamada atômica da RPC no servidor
    const { data, error } = await supabaseAdmin.rpc('submit_motorista_for_analysis', {
      p_auth_user_id: userId
    });

    if (error) {
      console.error(`[ONBOARDING] Erro na RPC submit_motorista_for_analysis:`, error);
      throw new Error(`Erro técnico ao processar submissão: ${error.message}`);
    }

    const result = data as any;
    if (!result.success) {
      console.warn(`[ONBOARDING] Falha na validação da RPC: ${result.error} (etapa: ${result.step})`);
      
      const mensagensErro: Record<string, string> = {
        'motorista_nao_encontrado': 'Perfil de motorista não localizado.',
        'usuario_nao_encontrado': 'Usuário não localizado.',
        'dados_cnh_pix_incompletos': 'Dados de CNH ou Pix estão incompletos.',
        'documentos_incompletos': 'Você precisa enviar os 6 documentos obrigatórios.',
        'veiculo_nao_encontrado': 'Nenhum veículo cadastrado encontrado.',
        'perfil_motorista_invalido': 'Perfil de motorista inválido.',
        'estado_bloqueado': 'Este perfil já está aprovado ou suspenso e não pode ser alterado.'
      };

      throw new Error(mensagensErro[result.error] || `Falha no cadastro (${result.step}).`);
    }

    console.log(`[ONBOARDING] Submissão concluída com sucesso para: ${userId}`);
    return { success: true, status: result.status };
  });

export const getCnhCorrectionUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    fileSize: z.number().int().positive().min(1).max(10 * 1024 * 1024) // 10MB
  }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const authUserId = context.userId;

    const { data: user, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id, is_motorista")
      .eq("auth_user_id", authUserId)
      .single();

    if (userError || !user) throw new Error("Usuário não encontrado.");
    if (!user.is_motorista) throw new Error("Acesso restrito a motoristas.");

    const { data: motorista, error: motoristaError } = await supabaseAdmin
      .from("motoristas")
      .select("status_aprovacao, cnh_validade")
      .eq("id", user.id)
      .single();

    if (motoristaError || !motorista) throw new Error("Motorista não encontrado.");

    if (motorista.status_aprovacao !== 'em_analise') {
      throw new Error("Envio permitido somente em análise.");
    }

    const { data: cnhDoc, error: cnhDocError } = await supabaseAdmin
      .from("documentos_motorista")
      .select("status_analise")
      .eq("motorista_id", user.id)
      .eq("tipo_documento", "cnh")
      .maybeSingle();

    if (cnhDocError) throw new Error("Erro ao verificar o documento da CNH.");
    if (!cnhDoc) throw new Error("Documento da CNH não encontrado.");

    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const hojeStr = formatter.format(now);
    const isExpired = motorista.cnh_validade ? motorista.cnh_validade < hojeStr : false;
    const needsCorrection = cnhDoc.status_analise === 'correcao_solicitada';

    if (!isExpired && !needsCorrection) {
      throw new Error("Não há necessidade de correção da CNH.");
    }

    const ext = data.mimeType.split('/')[1];
    const fileName = `${authUserId}/cnh_correction_${Date.now()}.${ext}`;

    const { data: uploadData, error } = await supabaseAdmin.storage
      .from('documentos-motorista')
      .createSignedUploadUrl(fileName);

    if (error) throw new Error("Erro ao gerar URL de upload.");

    return { 
      uploadUrl: uploadData.signedUrl, 
      storagePath: uploadData.path
    };
  });

export const submitCnhCorrection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    cnh_numero: z.string().regex(/^\d{11}$/),
    cnh_categoria: z.enum(['A', 'AB', 'a', 'ab']),
    cnh_validade: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    storagePath: z.string()
  }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const authUserId = context.userId;

    const { data: user, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id, is_motorista")
      .eq("auth_user_id", authUserId)
      .single();

    if (userError || !user) throw new Error("Usuário não encontrado.");
    if (!user.is_motorista) throw new Error("Acesso restrito a motoristas.");

    const { data: motorista, error: motoristaError } = await supabaseAdmin
      .from("motoristas")
      .select("id, status_aprovacao, cnh_validade")
      .eq("id", user.id)
      .single();

    if (motoristaError || !motorista) throw new Error("Motorista não encontrado.");
    if (motorista.status_aprovacao !== 'em_analise') throw new Error("Submissão permitida somente em análise.");

    const { data: cnhDoc, error: cnhDocError } = await supabaseAdmin
      .from("documentos_motorista")
      .select("status_analise")
      .eq("motorista_id", user.id)
      .eq("tipo_documento", "cnh")
      .maybeSingle();

    if (cnhDocError) throw new Error("Erro ao verificar o documento da CNH.");
    if (!cnhDoc) throw new Error("Documento da CNH não encontrado.");

    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const hojeStr = formatter.format(now);

    // Validação de data real (YYYY-MM-DD existente no calendário)
    const dateParts = data.cnh_validade.split('-');
    const yearNum = Number(dateParts[0]);
    const monthNum = Number(dateParts[1]);
    const dayNum = Number(dateParts[2]);
    const composed = new Date(Date.UTC(yearNum, monthNum - 1, dayNum));
    if (
      composed.getUTCFullYear() !== yearNum ||
      composed.getUTCMonth() + 1 !== monthNum ||
      composed.getUTCDate() !== dayNum
    ) {
      throw new Error("Data de validade da CNH inválida.");
    }

    if (data.cnh_validade < hojeStr) {
      throw new Error("A nova validade deve ser igual ou superior a hoje.");
    }

    const isExpired = motorista.cnh_validade ? motorista.cnh_validade < hojeStr : false;
    const needsCorrection = cnhDoc.status_analise === 'correcao_solicitada';

    if (!isExpired && !needsCorrection) {
      throw new Error("A correção já foi processada ou não é necessária.");
    }

    // Validação estrita do path: {authUserId}/cnh_correction_{timestamp}.{ext}
    const pathRegex = new RegExp(
      `^${authUserId}/cnh_correction_(\\d+)\\.(jpeg|png|webp)$`
    );
    const pathMatch = pathRegex.exec(data.storagePath);
    if (
      !pathMatch ||
      data.storagePath.includes('..') ||
      data.storagePath.includes('\\') ||
      data.storagePath.includes('?') ||
      data.storagePath.includes('#')
    ) {
      throw new Error("Caminho de arquivo inválido.");
    }
    const expectedExt = pathMatch[2] as 'jpeg' | 'png' | 'webp';
    const expectedBasename = `cnh_correction_${pathMatch[1]}.${expectedExt}`;

    // Localizar o objeto exato no bucket privado
    const { data: files, error: listError } = await supabaseAdmin.storage
      .from('documentos-motorista')
      .list(authUserId, { search: expectedBasename });

    if (listError) throw new Error("Erro ao verificar o arquivo da CNH no servidor.");

    const objeto = (files || []).find((f) => f.name === expectedBasename);
    if (!objeto) throw new Error("Arquivo da CNH não encontrado no servidor.");

    const realSize = (objeto.metadata as { size?: unknown } | null)?.size;
    if (
      typeof realSize !== 'number' ||
      !Number.isFinite(realSize) ||
      realSize <= 0 ||
      realSize > 10 * 1024 * 1024
    ) {
      throw new Error("Arquivo da CNH possui tamanho inválido.");
    }

    // Validar assinatura binária real do arquivo
    const { data: blob, error: downloadError } = await supabaseAdmin.storage
      .from('documentos-motorista')
      .download(data.storagePath);

    if (downloadError || !blob) throw new Error("Erro ao validar o arquivo da CNH.");

    const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
    const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const isPng = pngSig.every((b, i) => head[i] === b);
    const ascii = (start: number, end: number) =>
      String.fromCharCode(...Array.from(head.slice(start, end)));
    const isWebp = ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';

    const matchesExt =
      (expectedExt === 'jpeg' && isJpeg) ||
      (expectedExt === 'png' && isPng) ||
      (expectedExt === 'webp' && isWebp);

    if (!matchesExt) {
      throw new Error("O arquivo enviado não é uma imagem de CNH válida.");
    }

    // PASSO 1 - DOCUMENTO CNH
    const { data: updatedDoc, error: updateDocError } = await supabaseAdmin
      .from("documentos_motorista")
      .update({
        storage_path: data.storagePath,
        status_analise: 'pendente',
        motivo_recusa: null,
        data_envio: new Date().toISOString(),
        data_analise: null,
        updated_at: new Date().toISOString()
      })
      .eq("motorista_id", user.id)
      .eq("tipo_documento", "cnh")
      .select()
      .maybeSingle();

    if (updateDocError || !updatedDoc) throw new Error("Erro ao atualizar registro da CNH.");

    // PASSO 2 - DADOS ESTRUTURADOS
    const categoriaNormalizada = data.cnh_categoria.toUpperCase();
    const { data: updatedMotorista, error: updateMotoristaError } = await supabaseAdmin
      .from("motoristas")
      .update({
        cnh_numero: data.cnh_numero,
        cnh_categoria: categoriaNormalizada,
        cnh_validade: data.cnh_validade,
        is_disponivel: false
      })
      .eq("id", user.id)
      .select("cnh_numero, cnh_categoria, cnh_validade, is_disponivel")
      .maybeSingle();

    if (updateMotoristaError) throw new Error("Erro ao atualizar dados estruturados da CNH.");
    if (!updatedMotorista) throw new Error("Erro ao atualizar dados estruturados da CNH.");

    if (
      updatedMotorista.cnh_numero !== data.cnh_numero ||
      updatedMotorista.cnh_categoria !== categoriaNormalizada ||
      updatedMotorista.cnh_validade !== data.cnh_validade ||
      updatedMotorista.is_disponivel !== false
    ) {
      throw new Error("Falha de integridade ao gravar os dados da CNH.");
    }

    return { success: true };
  });


export const finalizarCorrida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ rideId: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const authUserId = context.userId;

    // 1. Localizar o perfil do motorista
    const { data: user, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id, is_motorista")
      .eq("auth_user_id", authUserId)
      .single();

    if (userError || !user) throw new Error("Usuário não encontrado.");
    if (!user.is_motorista) throw new Error("Acesso restrito a motoristas.");
    const motoristaId = user.id;

    // 2. Buscar a corrida para validar estado e obter valor_estimado
    const { data: rideCheck, error: fetchError } = await supabaseAdmin
      .from("corridas")
      .select("id, motorista_id, status, data_inicio, valor_estimado")
      .eq("id", data.rideId)
      .eq("motorista_id", motoristaId)
      .maybeSingle();

    if (fetchError) throw new Error("Erro ao validar dados da corrida.");
    if (!rideCheck) throw new Error("Corrida não encontrada ou não pertence a você.");

    // Validar status e data_inicio
    if (rideCheck.status !== "em_andamento") {
      throw new Error(`Status inválido para finalização: ${rideCheck.status}`);
    }
    if (!rideCheck.data_inicio) {
      throw new Error("A corrida não pode ser finalizada sem uma data de início.");
    }

    const valorFinal = Number(rideCheck.valor_estimado);
    if (!Number.isFinite(valorFinal)) {
      throw new Error("Valor da corrida inválido para finalização.");
    }

    // 3. Executar update condicionado
    const { data: updatedCorrida, error: updateError } = await supabaseAdmin
      .from("corridas")
      .update({
        status: 'concluida',
        data_finalizacao: new Date().toISOString(),
        valor_final: valorFinal
      } as any)
      .eq("id", data.rideId)
      .eq("motorista_id", motoristaId)
      .eq("status", 'em_andamento')
      .not("data_inicio", "is", null)
      .select('id, status')
      .maybeSingle();

    if (updateError) {
      console.error("Erro ao finalizar corrida:", updateError);
      throw new Error("Falha ao gravar conclusão da corrida.");
    }

    if (!updatedCorrida) {
      throw new Error("Não foi possível finalizar. A corrida pode ter sido alterada por outro processo.");
    }

    return { success: true };
  });
