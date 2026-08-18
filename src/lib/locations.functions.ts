import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getLocations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cidades, error } = await supabaseAdmin
      .from("cidades")
      .select("id, nome, estado_uf")
      .order("estado_uf")
      .order("nome");

    if (error) {
      console.error("[getLocations] Error fetching cities:", error);
      throw new Error("Erro ao carregar locais.");
    }

    return cidades || [];
  });
