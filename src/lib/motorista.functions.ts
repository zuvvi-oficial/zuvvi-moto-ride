import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Motorista elegível: 
 * - Aprovado
 * - Online (is_disponivel)
 * - Na mesma cidade
 * - Localização atualizada nos últimos 5 minutos
 */

export const toggleDisponibilidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ disponivel: z.boolean() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // Pega o ID do perfil público (que é o mesmo UUID no schema atual 1:1)
    const { data: usuario } = await supabaseAdmin
      .from("usuarios")
      .select("id, is_motorista")
      .eq("auth_user_id", userId)
      .single();

    if (!usuario?.is_motorista) throw new Error("Apenas motoristas podem mudar status.");

    const { error } = await supabaseAdmin
      .from("motoristas")
      .update({ is_disponivel: data.disponivel })
      .eq("id", usuario.id);

    if (error) throw new Error("Erro ao atualizar disponibilidade.");
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

    if (error) throw new Error("Erro ao atualizar GPS.");
    return { success: true };
  });

export const aceitarCorrida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ rideId: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: motorista, error: mError } = await supabaseAdmin
      .from("usuarios")
      .select("id, is_motorista, cidade_id, motoristas!inner(*)")
      .eq("auth_user_id", userId)
      .single();

    if (mError || !motorista?.is_motorista) throw new Error("Perfil de motorista não autorizado.");
    
    // Verificamos se o motorista está aprovado
    if ((motorista.motoristas as any).status_aprovacao !== 'aprovado') {
      throw new Error("Seu perfil de motorista ainda não foi aprovado.");
    }

    // Aceite atômico: apenas se status ainda for 'solicitada' e motorista_id for nulo
    const { data: corrida, error: uError } = await supabaseAdmin
      .from("corridas")
      .update({ 
        motorista_id: motorista.id, 
        status: 'aceita', 
        data_aceite: new Date().toISOString() 
      })
      .eq("id", data.rideId)
      .eq("status", 'solicitada')
      .is("motorista_id", null)
      .select()
      .maybeSingle();

    if (uError) throw new Error("Erro ao processar aceite.");
    if (!corrida) throw new Error("Esta corrida já foi aceita por outro piloto ou cancelada.");

    return { success: true };
  });

export const getOfertasDisponiveis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: user } = await supabaseAdmin
      .from("usuarios")
      .select("cidade_id, id")
      .eq("auth_user_id", context.userId)
      .single();

    if (!user?.cidade_id) return [];

    const { data: ofertas } = await supabaseAdmin
      .from("corridas")
      .select("*")
      .eq("cidade_id", user.cidade_id)
      .eq("status", 'solicitada')
      .is("motorista_id", null)
      .order("created_at", { ascending: false });

    return ofertas || [];
  });
