import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const listarDestinosRecentes = createServerFn({ method: "GET" })
  .middleware([])
  .handler(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error("Unauthorized");
    }

    // 1. Obter o id do usuário na tabela public.usuarios
    const { data: usuario, error: userError } = await supabase
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (userError || !usuario) {
      throw new Error("Usuário não encontrado");
    }

    // 2. Consultar corridas
    // O objetivo pede passageiro_id = usuario.id
    // Selecionar destino_nome, destino_lat, destino_lng, created_at
    // Ordenar por created_at DESC
    // Limite de 50 para permitir deduplicação
    const { data: corridas, error: corridasError } = await supabase
      .from("corridas")
      .select("destino_nome, destino_lat, destino_lng, created_at")
      .eq("passageiro_id", usuario.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (corridasError) {
      console.error("Erro ao buscar corridas recentes:", corridasError);
      throw new Error("Erro ao carregar destinos recentes");
    }

    // 3. Validação e Deduplicação
    // - destino_nome não vazio
    // - coordenadas válidas e finitas
    // - Converter lat/lng para Number
    // - Deduplicar por coordenadas (6 casas decimais)
    // - Máximo 10 destinos distintos

    const distinctDestinos: Array<{
      nome: string;
      latitude: number;
      longitude: number;
      usadoEm: string;
    }> = [];
    
    const seenCoordinates = new Set<string>();

    for (const corrida of (corridas || [])) {
      if (!corrida.destino_nome || corrida.destino_lat === null || corrida.destino_lng === null) continue;
      
      const lat = Number(corrida.destino_lat);
      const lng = Number(corrida.destino_lng);
      
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const coordKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
      
      if (!seenCoordinates.has(coordKey)) {
        seenCoordinates.add(coordKey);
        distinctDestinos.push({
          nome: corrida.destino_nome,
          latitude: lat,
          longitude: lng,
          usadoEm: corrida.created_at || new Date().toISOString()
        });
      }

      if (distinctDestinos.length >= 10) break;
    }

    return distinctDestinos;
  });
