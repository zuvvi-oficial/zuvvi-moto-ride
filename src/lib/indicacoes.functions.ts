import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Programa de indicação — Etapa 3. Só leitura: código próprio do usuário
 * pra compartilhar + lista de quem ele já indicou (nome e status). Toda a
 * lógica de recompensa já existe (Etapa 1: cupom de boas-vindas no
 * cadastro; Etapa 2: cupom do indicador na primeira corrida concluída do
 * indicado) — esta função só expõe o estado pra UI.
 */
export const getProgramaIndicacao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: usuario, error: usuarioError } = await supabaseAdmin
      .from("usuarios")
      .select("id, codigo_indicacao")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    if (usuarioError || !usuario) throw new Error("Usuário não encontrado.");

    const { data: indicacoes, error: indicacoesError } = await supabaseAdmin
      .from("indicacoes")
      .select("id, status, created_at, concluida_at, indicado:usuarios!indicacoes_indicado_id_fkey(nome)")
      .eq("indicador_id", usuario.id)
      .order("created_at", { ascending: false });

    if (indicacoesError) {
      console.error("Erro ao buscar indicações:", indicacoesError);
      throw new Error("Não foi possível carregar suas indicações.");
    }

    return {
      codigo: usuario.codigo_indicacao as string | null,
      indicacoes: (indicacoes || []).map((i: any) => ({
        id: i.id as string,
        nome: (i.indicado?.nome as string | undefined) ?? "Usuário Zuvvi",
        status: i.status as "pendente" | "concluida",
        createdAt: i.created_at as string,
        concluidaAt: i.concluida_at as string | null,
      })),
    };
  });
