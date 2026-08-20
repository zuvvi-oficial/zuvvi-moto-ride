import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { nanoid } from "nanoid";

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

const createRideSchema = z.object({
  origemLat: z.number(),
  origemLng: z.number(),
  origemNome: z.string().optional(),
  destinoLat: z.number(),
  destinoLng: z.number(),
  destinoNome: z.string().optional(),
  formaPagamento: z.enum(["pix", "cartao", "dinheiro"]),
});

export const criarCorrida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createRideSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // 1. Obter o perfil do usuário (passageiro) no banco público
    const { data: usuario, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id, cidade_id")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (userError || !usuario) {
      throw new Error("Perfil de usuário não encontrado para criar corrida.");
    }

    if (!usuario.cidade_id) {
      throw new Error("Cidade do usuário não configurada.");
    }

    // 2. Gerar código de embarque (4 dígitos numéricos conforme CHAR(4))
    const codigoEmbarque = Math.floor(1000 + Math.random() * 9000).toString();

    // 2.1 Validar se a cidade está liberada (praça piloto ou ativa) e obter tarifas
    const { data: cidade, error: cityError } = await supabaseAdmin
      .from("cidades")
      .select("status, nome, comissao_pct, bandeirada, valor_km, valor_min, tarifa_minima")
      .eq("id", usuario.cidade_id)
      .single();

    if (cityError || !cidade || (cidade.status !== 'piloto' && cidade.status !== 'ativa')) {
        throw new Error("Desculpe, o Zuvvi ainda não opera corridas nesta cidade ou as tarifas não foram encontradas.");
    }

    // 2.2 Calcular Rota Oficial no Servidor (Mapbox Directions)
    const token = process.env['MAPBOX_TOKEN'];
    if (!token) throw new Error("Erro de configuração: Serviço de rotas indisponível.");

    const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${data.origemLng},${data.origemLat};${data.destinoLng},${data.destinoLat}?geometries=geojson&access_token=${token}`;
    
    let rotaOficial;
    try {
      const resp = await fetch(directionsUrl);
      const routeData = await resp.json();
      if (routeData.code !== 'Ok' || !routeData.routes?.[0]) {
        throw new Error("Não foi possível calcular o trajeto oficial.");
      }
      rotaOficial = routeData.routes[0];
    } catch (err) {
      console.error("Erro Mapbox Server:", err);
      throw new Error("Falha ao comunicar com o serviço de rotas. Tente novamente.");
    }

    const oficialDistanciaKm = rotaOficial.distance / 1000;
    const oficialTempoMin = rotaOficial.duration / 60;

    // 2.3 Cálculo do Preço Oficial
    const { bandeirada, valor_km, valor_min, tarifa_minima } = cidade;
    let valorOficial = Number(bandeirada) + (oficialDistanciaKm * Number(valor_km)) + (oficialTempoMin * Number(valor_min));
    
    if (valorOficial < Number(tarifa_minima)) {
      valorOficial = Number(tarifa_minima);
    }
    valorOficial = Math.round(valorOficial * 100) / 100;

    // 3. Inserir a corrida com o valor calculado no servidor
    const { data: corrida, error: insertError } = await supabaseAdmin
      .from("corridas")
      .insert({
        passageiro_id: usuario.id,
        cidade_id: usuario.cidade_id,
        origem_lat: data.origemLat,
        origem_lng: data.origemLng,
        destino_lat: data.destinoLat,
        destino_lng: data.destinoLng,
        valor_estimado: valorOficial, // Valor oficial calculado no servidor
        forma_pagamento: data.formaPagamento,
        codigo_embarque: codigoEmbarque,
        status: 'solicitada',
        origem_nome: data.origemNome || 'Sua localização',
        destino_nome: data.destinoNome || 'Destino'
      } as any)
      .select()
      .single();

    if (insertError) {
      console.error("Erro ao inserir corrida:", insertError);
      throw new Error("Falha ao registrar a corrida no sistema.");
    }

    // 4. Registrar o pagamento pendente (Fase de Operação)
    try {
      const comissaoPct = Number(cidade.comissao_pct || 0);
      
      // valor_comissao = valor oficial × (comissao_pct ÷ 100), arredondado para 2 casas decimais
      const valorComissao = Math.round((valorOficial * (comissaoPct / 100)) * 100) / 100;
      
      // valor_motorista = valor oficial − valor_comissao
      const valorMotorista = Math.round((valorOficial - valorComissao) * 100) / 100;

      const { error: paymentError } = await supabaseAdmin
        .from("pagamentos")
        .insert({
          corrida_id: corrida.id,
          meio: data.formaPagamento,
          valor_total: valorOficial,
          valor_motorista: valorMotorista,
          valor_comissao: valorComissao,
          status: 'pendente'
        } as any);

      if (paymentError) {
        console.error("Erro ao registrar pagamento (corrida criada):", paymentError);
      }
    } catch (err) {
      console.error("Erro inesperado no cálculo/registro de pagamento:", err);
    }

    return { success: true, rideId: corrida.id };

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

export const cancelarCorrida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ rideId: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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

    // 2. Tentar atualizar a corrida se pertencer ao passageiro
    const { data: corrida, error } = await supabaseAdmin
      .from("corridas")
      .update({
        status: 'cancelada',
        cancelado_por: 'passageiro',
        data_cancelamento: new Date().toISOString()
      } as any)
      .eq("id", data.rideId)
      .eq("passageiro_id", usuario.id)
      .select()
      .maybeSingle();

    if (error) {
      console.error("Erro ao cancelar corrida:", error);
      throw new Error("Falha ao cancelar a corrida no banco de dados.");
    }

    if (!corrida) {
      throw new Error("Corrida não encontrada ou você não tem permissão para cancelá-la.");
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
        motorista_id
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
      "em_andamento"
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
        nome,
        motoristas!inner (
          nota_media
        )
      `)
      .eq("id", corrida.motorista_id)
      .maybeSingle();

    // Fail-closed: consulta sem erro e nome não vazio
    if (driverError || !driver || !driver.nome || driver.nome.trim() === "") {
      throw new Error("Não foi possível carregar os dados do Mototaxista desta corrida.");
    }

    const motoristaData = Array.isArray(driver.motoristas) ? driver.motoristas[0] : driver.motoristas;
    const driverInfo = {
      nome: driver.nome,
      nota_media: motoristaData?.nota_media ?? null
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

    // Fail-closed: marca, modelo e placa não podem estar vazios
    if (!vehicle.marca || !vehicle.modelo || !vehicle.placa || 
        vehicle.marca.trim() === "" || vehicle.modelo.trim() === "" || vehicle.placa.trim() === "") {
      throw new Error("Não foi possível carregar os dados do Mototaxista desta corrida.");
    }

    const vehicleInfo = {
      marca: vehicle.marca,
      modelo: vehicle.modelo,
      cor: vehicle.cor ?? null,
      placa: vehicle.placa
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
        forma_pagamento: corrida.forma_pagamento
      },
      driver: driverInfo,
      vehicle: vehicleInfo,
      handoffAvailable: true
    };
  });