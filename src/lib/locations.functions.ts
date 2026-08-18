import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getUFs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Consulta dedicada para retornar apenas as UFs distintas
    const { data, error } = await supabaseAdmin
      .from("cidades")
      .select("estado_uf")
      .order("estado_uf");

    if (error) {
      console.error("[getUFs] Error fetching UFs:", error);
      throw new Error("Erro ao carregar estados.");
    }

    // Extrair UFs únicas do resultado
    const ufs = Array.from(new Set((data || []).map(item => item.estado_uf)));
    return ufs;
  });

export const getCitiesByUF = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => typeof data === 'string' ? data : '')
  .handler(async ({ data: uf }) => {
    if (!uf) return [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("cidades")
      .select("id, nome")
      .eq("estado_uf", uf)
      .order("nome");

    if (error) {
      console.error("[getCitiesByUF] Error fetching cities:", error);
      throw new Error("Erro ao carregar cidades.");
    }

    return data || [];
  });
