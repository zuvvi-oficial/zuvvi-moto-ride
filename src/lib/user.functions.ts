import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { nanoid } from "nanoid";

const RIDE_SEARCH_TIMEOUT_MS = 120_000;

type UserRow = Database["public"]["Tables"]["usuarios"]["Row"];

type MotoristaRow = Database["public"]["Tables"]["motoristas"]["Row"];

export type UserWithMotorista = UserRow & {
  motorista: MotoristaRow | null;
};

export const getSessionUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UserWithMotorista> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: user, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("*, motorista:motoristas(*), cidade:cidades(nome, estado_uf)")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (userError || !user) {
      throw new Error("Usuário não encontrado");
    }

    const motoristaData = Array.isArray(user.motorista) ? user.motorista[0] : user.motorista;

    return {
      ...user,
      motorista: (motoristaData as MotoristaRow) || null
    } as UserWithMotorista;
  });

export const getMapboxToken = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const token = process.env['MAPBOX_TOKEN'] || null;
    return token;
  });

const cityAvailabilitySchema = z.object({
  coords: z.object({
    lat: z.number(),
    lng: z.number()
  }).optional()
});

export const checkCityAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => cityAvailabilitySchema.parse(data ?? {}))
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: usuario } = await supabaseAdmin
      .from("usuarios")
      .select("cidade_id")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    if (usuario?.cidade_id) {
      const { data: cidade } = await supabaseAdmin
        .from("cidades")
        .select("status, nome")
        .eq("id", usuario.cidade_id)
        .maybeSingle();

      if (cidade) {
        return {
          isAvailable: cidade.status === 'piloto' || cidade.status === 'ativa',
          cityName: cidade.nome,
          status: cidade.status
        };
      }
    }

    return { 
      isAvailable: false,
      cityName: null,
      status: null
    };
  });

const calculateFareSchema = z.object({
  distanciaKm: z.number(),
  tempoMin: z.number()
});

export const calcularValorCorrida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => calculateFareSchema.parse(data ?? {}))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { distanciaKm, tempoMin } = data;

    // Busca a cidade do usuário
    const { data: usuario } = await supabaseAdmin
      .from("usuarios")
      .select("cidade_id")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    if (!usuario?.cidade_id) {
      throw new Error("Cidade do usuário não identificada");
    }

    // Busca as tarifas da cidade
    const { data: cidade, error } = await supabaseAdmin
      .from("cidades")
      .select("bandeirada, valor_km, valor_min, tarifa_minima")
      .eq("id", usuario.cidade_id)
      .single();

    if (error || !cidade) {
      throw new Error("Tarifas da cidade não encontradas");
    }

    const { bandeirada, valor_km, valor_min, tarifa_minima } = cidade;

    // Fórmula: bandeirada + (distância_km × valor_km) + (tempo_min × valor_min)
    let valorFinal = Number(bandeirada) + (distanciaKm * Number(valor_km)) + (tempoMin * Number(valor_min));

    // Respeita a tarifa mínima
    if (valorFinal < Number(tarifa_minima)) {
      valorFinal = Number(tarifa_minima);
    }

    // Arredonda para 2 casas decimais para evitar problemas de precisão flutuante
    valorFinal = Math.round(valorFinal * 100) / 100;

    return {
      valor: valorFinal,
      tarifas: {
        bandeirada: Number(bandeirada),
        valor_km: Number(valor_km),
        valor_min: Number(valor_min),
        tarifa_minima: Number(tarifa_minima)
      }
    };
  });

const cotarCorridaSchema = z.object({
  origemLat: z.number(),
  origemLng: z.number(),
  destinoLat: z.number(),
  destinoLng: z.number()
});

export const cotarCorrida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => cotarCorridaSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const crypto = await import("crypto");

    // 1. Obter tarifas da cidade do usuário
    const { data: usuario } = await supabaseAdmin
      .from("usuarios")
      .select("cidade_id")
      .eq("auth_user_id", context.userId)
      .single();

    if (!usuario?.cidade_id) throw new Error("Cidade não identificada.");

    const { data: cidade } = await supabaseAdmin
      .from("cidades")
      .select("bandeirada, valor_km, valor_min, tarifa_minima")
      .eq("id", usuario.cidade_id)
      .single();

    if (!cidade) throw new Error("Tarifas não encontradas.");

    // 2. Calcular rota oficial via Mapbox
    const token = process.env['MAPBOX_TOKEN'];
    if (!token) throw new Error("Serviço de rotas indisponível.");

    const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${data.origemLng},${data.origemLat};${data.destinoLng},${data.destinoLat}?geometries=geojson&access_token=${token}`;
    
    const resp = await fetch(directionsUrl);
    const routeData = await resp.json();
    if (routeData.code !== 'Ok' || !routeData.routes?.[0]) {
      throw new Error("Não foi possível calcular o trajeto.");
    }
    const route = routeData.routes[0];

    // 3. Calcular valor oficial
    const distanceKm = route.distance / 1000;
    const durationMin = route.duration / 60;
    let valor = Number(cidade.bandeirada) + (distanceKm * Number(cidade.valor_km)) + (durationMin * Number(cidade.valor_min));
    if (valor < Number(cidade.tarifa_minima)) valor = Number(cidade.tarifa_minima);
    valor = Math.round(valor * 100) / 100;

    // 4. Gerar Assinatura da Cotação (Anti-Tampering)
    // Validade implícita: a cotação deve bater com os dados da corrida
    const payload = `${data.origemLat}:${data.origemLng}:${data.destinoLat}:${data.destinoLng}:${valor}`;
    const secret = process.env['SUPABASE_SERVICE_ROLE_KEY'] || 'zuvvi-internal';
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    return {
      distance: distanceKm,
      duration: durationMin,
      valor,
      signature,
      geometry: route.geometry
    };
  });

const createRideSchema = z.object({
  origemLat: z.number(),
  origemLng: z.number(),
  origemNome: z.string().optional(),
  destinoLat: z.number(),
  destinoLng: z.number(),
  destinoNome: z.string().optional(),
  formaPagamento: z.enum(["pix", "cartao", "dinheiro"]),
  valorCotado: z.number(),
  assinaturaCotacao: z.string()
});

export const criarCorrida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createRideSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const crypto = await import("crypto");
    const userId = context.userId;

    // 1. Validar Assinatura da Cotação
    const payload = `${data.origemLat}:${data.origemLng}:${data.destinoLat}:${data.destinoLng}:${data.valorCotado}`;
    const secret = process.env['SUPABASE_SERVICE_ROLE_KEY'] || 'zuvvi-internal';
    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    if (data.assinaturaCotacao !== expectedSignature) {
      throw new Error("Cotação inválida ou expirada. Recalcule o valor da corrida.");
    }

    const { data: usuario } = await supabaseAdmin
      .from("usuarios")
      .select("id, cidade_id")
      .eq("auth_user_id", userId)
      .single();

    if (!usuario) throw new Error("Usuário não encontrado.");

    // [3.8-C1] Limpeza e [3.8-A] Verificação de aberta
    const timeoutCutoff = new Date(Date.now() - RIDE_SEARCH_TIMEOUT_MS).toISOString();
    await supabaseAdmin
      .from("corridas")
      .update({ status: 'sem_motorista' } as any)
      .eq("passageiro_id", usuario.id)
      .eq("status", "solicitada")
      .is("motorista_id", null)
      .lte("created_at", timeoutCutoff);

    const { data: corridaAberta } = await supabaseAdmin
      .from("corridas")
      .select("id")
      .eq("passageiro_id", usuario.id)
      .in("status", ['solicitada', 'buscando_motorista', 'aguardando_pagamento', 'aceita', 'motorista_a_caminho', 'motorista_chegou', 'em_andamento'])
      .limit(1)
      .maybeSingle();

    if (corridaAberta) throw new Error("Você já possui uma corrida em andamento.");

    if (!usuario.cidade_id) throw new Error("Cidade não configurada.");

    const { data: cidade } = await supabaseAdmin
      .from("cidades")
      .select("status, comissao_pct")
      .eq("id", usuario.cidade_id)
      .single();

    if (!cidade || (cidade.status !== 'piloto' && cidade.status !== 'ativa')) {
      throw new Error("O Zuvvi ainda não opera nesta cidade.");
    }

    const codigoEmbarque = Math.floor(1000 + Math.random() * 9000).toString();
    const comissaoPct = Number(cidade.comissao_pct || 0);
    const valorComissao = Math.round((data.valorCotado * (comissaoPct / 100)) * 100) / 100;
    const valorMotorista = Math.round((data.valorCotado - valorComissao) * 100) / 100;

    // A RPC é versionada nesta microetapa. O cast fica restrito a esta chamada
    // enquanto os tipos gerados refletem apenas o schema atualmente em produção.
    const { data: corridaId, error: atomicError } = await (supabaseAdmin as any).rpc(
      "criar_corrida_financeira_atomica",
      {
        p_passageiro_id: usuario.id,
        p_cidade_id: usuario.cidade_id,
        p_origem_lat: data.origemLat,
        p_origem_lng: data.origemLng,
        p_destino_lat: data.destinoLat,
        p_destino_lng: data.destinoLng,
        p_valor_estimado: data.valorCotado,
        p_forma_pagamento: data.formaPagamento,
        p_codigo_embarque: codigoEmbarque,
        p_origem_nome: data.origemNome || 'Sua localização',
        p_destino_nome: data.destinoNome || 'Destino',
        p_valor_total: data.valorCotado,
        p_valor_motorista: valorMotorista,
        p_valor_comissao: valorComissao
      }
    );

    if (atomicError || !corridaId) {
      if (atomicError?.code === "23505") {
        throw new Error("Você já possui uma corrida ativa.");
      }
      console.error("Erro criação financeira atômica:", atomicError);
      throw new Error("Falha ao registrar a corrida.");
    }

    return { success: true, rideId: corridaId as string };
  });

export const getCorrida = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ rideId: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const authUserId = context.userId;

    // 1. Obter a corrida com os IDs necessários para validação
    const { data: corrida, error } = await supabaseAdmin
      .from("corridas")
      .select(`
        *,
        usuarios!corridas_passageiro_id_fkey(auth_user_id),
        motoristas!corridas_motorista_id_fkey(
          usuarios(auth_user_id)
        )
      `)
      .eq("id", data.rideId)
      .maybeSingle();

    if (error || !corrida) {
      throw new Error("Corrida não encontrada");
    }

    // 2. Validação de Autorização
    const passageiroAuthId = (corrida.usuarios as any)?.auth_user_id;
    const motoristaAuthId = (corrida.motoristas as any)?.usuarios?.auth_user_id;

    const isPassageiro = authUserId === passageiroAuthId;
    const isMotorista = motoristaAuthId && authUserId === motoristaAuthId;

    if (!isPassageiro && !isMotorista) {
      // Erro genérico para não confirmar a existência da corrida a terceiros
      throw new Error("Corrida não encontrada");
    }

    // 3. Remover dados de join usados apenas para validação antes de retornar
    const { usuarios, motoristas, ...rideData } = corrida as any;
    
    return rideData;
  });


export const getRetomadaCorridaPassageiro = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: usuario, error: usuarioError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    if (usuarioError || !usuario) {
      throw new Error("Usuário não encontrado");
    }

    const { data: corrida, error: corridaError } = await supabaseAdmin
      .from("corridas")
      .select("id, status, forma_pagamento, motorista_id")
      .eq("passageiro_id", usuario.id)
      .in("status", [
        "solicitada",
        "buscando_motorista",
        "aguardando_pagamento",
        "aceita",
        "motorista_a_caminho",
        "motorista_chegou",
        "em_andamento"
      ])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (corridaError) {
      throw new Error("Falha ao consultar corrida em andamento");
    }

    if (!corrida) return null;

    const motoristaAtribuido = Boolean(corrida.motorista_id);
    const tela = !motoristaAtribuido
      ? "procurando_motorista"
      : corrida.forma_pagamento === "pix"
        ? "pagamento_pix"
        : "acompanhamento";

    return {
      rideId: corrida.id,
      tela
    } as const;
  });

export const getReverseGeocoding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ lat: z.number(), lng: z.number() }).parse(data))
  .handler(async ({ data }) => {
    const token = process.env['MAPBOX_TOKEN'];
    if (!token) throw new Error("Token do Mapbox não configurado");

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${data.lng},${data.lat}.json?access_token=${token}&language=pt&limit=1`;
    
    try {
      const response = await fetch(url);
      const json = await response.json();
      
      if (json.features && json.features.length > 0) {
        // Retorna o place_name formatado (ex: Rua X, Bairro, Cidade)
        return { address: json.features[0].place_name };
      }
      
      return { address: "Localização desconhecida" };
    } catch (err) {
      console.error("Erro reverse geocoding:", err);
      return { address: "Sua localização" };
    }
  });

export const verificarTimeoutCorrida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ rideId: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const authUserId = context.userId;

    const { data: usuario, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (userError || !usuario) throw new Error("Usuário não encontrado");

    const { data: corrida, error: rideError } = await supabaseAdmin
      .from("corridas")
      .select("id, status, motorista_id, created_at, passageiro_id")
      .eq("id", data.rideId)
      .maybeSingle();

    if (rideError || !corrida) throw new Error("Corrida não encontrada");
    if (corrida.passageiro_id !== usuario.id) throw new Error("Corrida não encontrada");

    if (corrida.status !== "solicitada" || corrida.motorista_id !== null) {
      return { expired: false, status: corrida.status };
    }

    const createdAt = new Date(corrida.created_at).getTime();
    const now = Date.now();
    const isExpired = (now - createdAt) >= RIDE_SEARCH_TIMEOUT_MS;

    if (!isExpired) return { expired: false, status: corrida.status };

    const cutoff = new Date(now - RIDE_SEARCH_TIMEOUT_MS).toISOString();
    const { data: updatedRide, error: updateError } = await supabaseAdmin
      .from("corridas")
      .update({ status: "sem_motorista" } as any)
      .eq("id", data.rideId)
      .eq("passageiro_id", usuario.id)
      .eq("status", "solicitada")
      .is("motorista_id", null)
      .lte("created_at", cutoff)
      .select("status")
      .maybeSingle();

    if (updateError) throw new Error("Falha ao processar expiração.");

    if (!updatedRide) {
      const { data: finalRide, error: finalError } = await supabaseAdmin
        .from("corridas")
        .select("status")
        .eq("id", data.rideId)
        .maybeSingle();

      if (finalError) throw new Error("Falha ao consultar estado da corrida.");
      if (!finalRide) throw new Error("Corrida não encontrada");

      return { expired: false, status: finalRide.status };
    }

    return { expired: true, status: "sem_motorista" };
  });

export const cancelarCorrida = createServerFn({ method: "POST" })

  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ rideId: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { criarNotificacao } = await import("./notificacoes.server");
    const userId = context.userId;

    // 1. Obter o ID do perfil do usuário logado
    const { data: usuario } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (!usuario) {
      throw new Error("Perfil de usuário não encontrado.");
    }

    // 2. Tentar atualizar a corrida se pertencer ao passageiro e status for válido
    const { data: corrida, error } = await supabaseAdmin
      .from("corridas")
      .update({
        status: 'cancelada',
        cancelado_por: 'passageiro',
        data_cancelamento: new Date().toISOString()
      } as any)
      .eq("id", data.rideId)
      .eq("passageiro_id", usuario.id)
      .in("status", ['solicitada', 'buscando_motorista', 'aceita', 'motorista_a_caminho'])
      .select()
      .maybeSingle();

    if (error) {
      console.error("Erro ao cancelar corrida:", error);
      throw new Error("Falha ao cancelar a corrida no banco de dados.");
    }

    if (!corrida) {
      throw new Error("Esta corrida não pode mais ser cancelada porque já avançou de etapa.");
    }

    // Notificar Motorista se houver
    if (corrida.motorista_id) {
      await criarNotificacao(supabaseAdmin, {
        usuario_id: corrida.motorista_id,
        tipo: "corrida_cancelada",
        titulo: "❌ Corrida cancelada",
        mensagem: "O passageiro cancelou a corrida solicitada.",
        corrida_id: data.rideId
      });
    }

    return { success: true };
  });

export const getAcompanhamentoPassageiro = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ rideId: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const authUserId = context.userId;

    // 1. Resolver o perfil public.usuarios (ownership)
    const { data: usuarioAuth, error: userAuthError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (userAuthError || !usuarioAuth) {
      throw new Error("Corrida não encontrada.");
    }

    // 2. Buscar a corrida
    const { data: corrida, error: rideError } = await supabaseAdmin
      .from("corridas")
      .select(`
        id,
        status,
        origem_lat,
        origem_lng,
        origem_nome,
        destino_lat,
        destino_lng,
        destino_nome,
        valor_estimado,
        forma_pagamento,
        passageiro_id,
        motorista_id,
        codigo_embarque
      `)
      .eq("id", data.rideId)
      .maybeSingle();

    if (rideError || !corrida) {
      throw new Error("Corrida não encontrada.");
    }

    // Validação de ownership
    if (corrida.passageiro_id !== usuarioAuth.id) {
      throw new Error("Corrida não encontrada.");
    }

    const assignedStatuses: Database["public"]["Enums"]["corrida_status"][] = [
      "aceita",
      "motorista_a_caminho",
      "motorista_chegou",
      "em_andamento",
      "concluida"
    ];

    // Status deve estar entre os autorizados
    if (!assignedStatuses.includes(corrida.status)) {
      return {
        ride: null,
        driver: null,
        vehicle: null,
        handoffAvailable: false
      };
    }

    // Fail-closed: motorista_id deve existir
    if (!corrida.motorista_id) {
      throw new Error("Não foi possível carregar os dados do Mototaxista desta corrida.");
    }

    // 3. Buscar Mototaxista (FAIL-CLOSED)
    const { data: driver, error: driverError } = await supabaseAdmin
      .from("usuarios")
      .select(`
        id,
        nome,
        motoristas!inner (
          nota_media,
          ultima_lat,
          ultima_lng,
          created_at
        )
      `)
      .eq("id", corrida.motorista_id)
      .maybeSingle();

    // Fail-closed: consulta sem erro e nome não vazio
    if (driverError || !driver || !driver.nome || driver.nome.trim() === "") {
      throw new Error("Não foi possível carregar os dados do Mototaxista desta corrida.");
    }

    const motoristaData = Array.isArray(driver.motoristas) ? driver.motoristas[0] : driver.motoristas;

    // 3.1 Contar corridas concluídas (fail-safe)
    let totalCorridas = 0;
    try {
      const { count } = await supabaseAdmin
        .from("corridas")
        .select("*", { count: 'exact', head: true })
        .eq("motorista_id", corrida.motorista_id)
        .eq("status", "concluida");
      totalCorridas = count || 0;
    } catch (err) {
      console.error("Erro ao contar corridas do motorista:", err);
    }

    const driverInfo = {
      id: driver.id,
      nome: driver.nome,
      nota_media: motoristaData?.nota_media ?? null,
      ultima_lat: motoristaData?.ultima_lat ?? null,
      ultima_lng: motoristaData?.ultima_lng ?? null,
      total_corridas: totalCorridas,
      membro_desde: motoristaData?.created_at ?? null
    };

    // 4. Buscar Veículo (FAIL-CLOSED: EXATAMENTE UM)
    const { data: vehicles, error: vehicleError } = await supabaseAdmin
      .from("veiculos")
      .select("marca, modelo, cor, placa")
      .eq("motorista_id", corrida.motorista_id)
      .eq("ativo", true)
      .eq("status_aprovacao", "aprovado");

    // Fail-closed: consulta sem erro e exatamente um registro
    if (vehicleError || !vehicles || vehicles.length !== 1) {
      throw new Error("Não foi possível carregar os dados do Mototaxista desta corrida.");
    }

    const vehicle = vehicles[0];
    if (!vehicle) {
      throw new Error("Não foi possível carregar os dados do Mototaxista desta corrida.");
    }

    // Fail-closed: marca, modelo e placa não podem estar vazios
    const vMarca = vehicle.marca;
    const vModelo = vehicle.modelo;
    const vPlaca = vehicle.placa;

    if (!vMarca || !vModelo || !vPlaca || 
        vMarca.trim() === "" || vModelo.trim() === "" || vPlaca.trim() === "") {
      throw new Error("Não foi possível carregar os dados do Mototaxista desta corrida.");
    }

    const vehicleInfo = {
      marca: vMarca,
      modelo: vModelo,
      cor: vehicle.cor ?? null,
      placa: vPlaca
    };

    // 5. Retorno Final Seguro
    return {
      ride: {
        id: corrida.id,
        status: corrida.status,
        origem_lat: corrida.origem_lat,
        origem_lng: corrida.origem_lng,
        origem_nome: corrida.origem_nome,
        destino_lat: corrida.destino_lat,
        destino_lng: corrida.destino_lng,
        destino_nome: corrida.destino_nome,
        valor_estimado: corrida.valor_estimado,
        forma_pagamento: corrida.forma_pagamento,
        codigo_embarque: corrida.status === 'motorista_chegou' ? corrida.codigo_embarque : null
      },
      driver: driverInfo,
      vehicle: vehicleInfo,
      handoffAvailable: true
    };
  });