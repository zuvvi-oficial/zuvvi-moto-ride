import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getResumoCarteira = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const vazio = {
      totalGastoMes: 0,
      quantidadeCorridas: 0,
      totalDinheiro: 0,
      totalPix: 0,
    };

    try {
      // 1. Resolver o ID do usuário (tabela public.usuarios) a partir do auth_user_id (context.userId)
      const { data: userData, error: userError } = await context.supabase
        .from("usuarios")
        .select("id")
        .eq("auth_user_id", context.userId)
        .maybeSingle();

      if (userError || !userData) {
        console.error("Erro ao resolver usuário no resumo da carteira:", userError);
        return vazio;
      }

      const passageiroId = userData.id;

      // 2. Intervalo do mês atual
      const agora = new Date();
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();

      // 3. Buscar corridas concluídas no mês atual, usando o ID da tabela usuarios
      const { data: corridas, error } = await context.supabase
        .from("corridas")
        .select("valor_final, valor_estimado, forma_pagamento")
        .eq("passageiro_id", passageiroId)
        .eq("status", "concluida")
        .gte("created_at", inicioMes);

      if (error) {
        console.error("Erro ao buscar resumo da carteira:", error);
        return vazio;
      }

      // 4. Calcular totais (somente leitura, em memória)
      return (corridas || []).reduce((acc, c: any) => {
        const valor = Number(c.valor_final ?? c.valor_estimado ?? 0);

        acc.totalGastoMes += valor;
        acc.quantidadeCorridas += 1;

        if (c.forma_pagamento === "dinheiro") {
          acc.totalDinheiro += valor;
        } else if (c.forma_pagamento === "pix") {
          acc.totalPix += valor;
        }

        return acc;
      }, { ...vazio });
    } catch (err) {
      console.error("Falha catastrófica no resumo da carteira:", err);
      return vazio;
    }
  });
