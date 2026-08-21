import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/auth-status.functions";

const favoritoSchema = z.object({
  nome: z.string().trim().min(1).max(40),
  endereco: z.string().trim().min(1).max(300),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const listarFavoritos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Resolve usuario.id
    const { data: usuario, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    if (userError || !usuario) {
      throw new Error("Usuário não encontrado.");
    }

    const { data, error } = await supabaseAdmin
      .from("enderecos_favoritos")
      .select("id, nome, endereco, latitude, longitude")
      .eq("usuario_id", usuario.id)
      .order("nome", { ascending: true });

    if (error) throw error;

    return (data || []).map(fav => ({
      ...fav,
      latitude: Number(fav.latitude),
      longitude: Number(fav.longitude),
    }));
  });

export const criarFavorito = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => favoritoSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Resolve usuario.id
    const { data: usuario, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    if (userError || !usuario) {
      throw new Error("Usuário não encontrado.");
    }

    // Check for duplicate name (case insensitive)
    const { data: existing } = await supabaseAdmin
      .from("enderecos_favoritos")
      .select("id")
      .eq("usuario_id", usuario.id)
      .ilike("nome", data.nome)
      .maybeSingle();

    if (existing) {
      throw new Error("Você já possui um favorito com esse nome.");
    }

    const { error } = await supabaseAdmin
      .from("enderecos_favoritos")
      .insert({
        usuario_id: usuario.id,
        nome: data.nome,
        endereco: data.endereco,
        latitude: data.latitude,
        longitude: data.longitude,
      });

    if (error) throw error;

    return { success: true };
  });

export const excluirFavorito = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Resolve usuario.id
    const { data: usuario, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    if (userError || !usuario) {
      throw new Error("Usuário não encontrado.");
    }

    const { data: deleted, error } = await supabaseAdmin
      .from("enderecos_favoritos")
      .delete()
      .eq("id", data.id)
      .eq("usuario_id", usuario.id)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!deleted) throw new Error("Favorito não encontrado.");

    return { success: true };
  });
