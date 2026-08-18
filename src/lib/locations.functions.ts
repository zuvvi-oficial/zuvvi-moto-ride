import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getUFs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Chama a função RPC que retorna UFs distintas diretamente do banco
    const { data, error } = await supabaseAdmin.rpc("get_distinct_ufs");

    if (error) {
      console.error("[getUFs] Error fetching UFs via RPC:", error);
      throw new Error("Erro ao carregar estados.");
    }

    // O retorno já é a lista de UFs (como array de objetos ou strings dependendo da tipagem do RPC)
    // Se retornar objetos { estado_uf: '...' }, mapeamos.
    return (data as any[] || []).map(item => typeof item === 'string' ? item : item.estado_uf);
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
