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
      .select("*, motorista:motoristas(*)")
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
  .handler(async () => {
    const token = process.env['MAPBOX_TOKEN'] || null;
    if (token) {
      console.log(`[MAPBOX_TOKEN] Encontrado. Comprimento: ${token.length} caracteres. Inicia com: ${token.substring(0, 3)}`);
    } else {
      console.log(`[MAPBOX_TOKEN] Não encontrado no process.env`);
    }
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
  destinoLat: z.number(),
  destinoLng: z.number(),
  valorEstimado: z.number(),
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

    // 3. Inserir a corrida
    const { data: corrida, error: insertError } = await supabaseAdmin
      .from("corridas")
      .insert({
        passageiro_id: usuario.id,
        cidade_id: usuario.cidade_id,
        origem_lat: data.origemLat,
        origem_lng: data.origemLng,
        destino_lat: data.destinoLat,
        destino_lng: data.destinoLng,
        valor_estimado: data.valorEstimado,
        forma_pagamento: data.formaPagamento,
        codigo_embarque: codigoEmbarque,
        status: 'solicitada'
      })
      .select()
      .single();

    if (insertError) {
      console.error("Erro ao inserir corrida:", insertError);
      throw new Error("Falha ao registrar a corrida no sistema.");
    }

    return { success: true, rideId: corrida.id };
  });

export const getCorrida = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ rideId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data: corrida, error } = await supabaseAdmin
      .from("corridas")
      .select("*")
      .eq("id", data.rideId)
      .maybeSingle();

    if (error || !corrida) {
      throw new Error("Corrida não encontrada");
    }

    return corrida;
  });