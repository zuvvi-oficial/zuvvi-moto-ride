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

export const getUFsDisponiveis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Busca direto na tabela (sem RPC): só UFs com pelo menos uma cidade liberada
    const { data, error } = await supabaseAdmin
      .from("cidades")
      .select("estado_uf")
      .in("status", ["ativa", "piloto"]);

    if (error) {
      console.error("[getUFsDisponiveis] Error fetching available UFs:", error);
      throw new Error("Erro ao carregar estados.");
    }

    const ufs = Array.from(new Set((data || []).map((c) => c.estado_uf)));
    return ufs.sort();
  });

export const getCitiesDisponiveisByUF = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => typeof data === 'string' ? data : '')
  .handler(async ({ data: uf }) => {
    if (!uf) return [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("cidades")
      .select("id, nome")
      .eq("estado_uf", uf)
      .in("status", ["ativa", "piloto"])
      .order("nome");

    if (error) {
      console.error("[getCitiesDisponiveisByUF] Error fetching available cities:", error);
      throw new Error("Erro ao carregar cidades.");
    }

    return data || [];
  });
