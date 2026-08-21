import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listarDestinosRecentes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const authUserId = context.userId;

    // 1. Obter o id do usuário na tabela public.usuarios
    const { data: usuario, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", authUserId)
      .single();

    if (userError || !usuario) {
      throw new Error("Usuário não encontrado.");
    }

    // 2. Consultar corridas usando o ID real do usuário para garantir ownership
    const { data: corridas, error: corridasError } = await supabaseAdmin
      .from("corridas")
      .select("destino_nome, destino_lat, destino_lng, created_at")
      .eq("passageiro_id", usuario.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (corridasError) {
      throw new Error("Não foi possível carregar seus destinos recentes.");
    }

    // 3. Validação e Deduplicação
    const distinctDestinos: Array<{
      nome: string;
      latitude: number;
      longitude: number;
      usadoEm: string;
    }> = [];
    
    const seenCoordinates = new Set<string>();

    for (const corrida of (corridas || [])) {
      const nomeTrim = (corrida.destino_nome || "").trim();
      if (!nomeTrim || corrida.destino_lat === null || corrida.destino_lng === null) continue;
      
      const lat = Number(corrida.destino_lat);
      const lng = Number(corrida.destino_lng);
      
      // Validação de finitude e ranges lat/lng
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;

      const coordKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
      
      if (!seenCoordinates.has(coordKey)) {
        seenCoordinates.add(coordKey);
        distinctDestinos.push({
          nome: nomeTrim,
          latitude: lat,
          longitude: lng,
          usadoEm: corrida.created_at || new Date().toISOString()
        });
      }

      if (distinctDestinos.length >= 10) break;
    }

    return distinctDestinos;
  });
