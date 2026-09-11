import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getResumoGanhos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const vazio = {
      totalGanhoMes: 0,
      quantidadeCorridas: 0,
      totalDinheiro: 0,
      totalPix: 0,
    };

    try {
      // 1. Resolver o ID do motorista (tabela public.usuarios, mesmo id de motoristas) a partir do auth_user_id
      const { data: userData, error: userError } = await context.supabase
        .from("usuarios")
        .select("id")
        .eq("auth_user_id", context.userId)
        .maybeSingle();

      if (userError || !userData) {
        console.error("Erro ao resolver usuário no resumo de ganhos:", userError);
        return vazio;
      }

      const motoristaId = userData.id;

      // 2. Intervalo do mês atual
      const agora = new Date();
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();

      // 3. Buscar pagamentos já pagos das corridas deste motorista no mês atual.
      // valor_motorista é o repasse líquido (já sem a comissão) — a mesma fonte
      // usada na notificação "Ganho confirmado" em finalizarCorrida.
      const { data: pagamentos, error } = await context.supabase
        .from("pagamentos")
        .select("valor_motorista, meio, corridas!inner(motorista_id)")
        .eq("status", "pago")
        .eq("corridas.motorista_id", motoristaId)
        .gte("pago_at", inicioMes);

      if (error) {
        console.error("Erro ao buscar resumo de ganhos:", error);
        return vazio;
      }

      // 4. Calcular totais (somente leitura, em memória)
      return (pagamentos || []).reduce((acc, p: any) => {
        const valor = Number(p.valor_motorista ?? 0);

        acc.totalGanhoMes += valor;
        acc.quantidadeCorridas += 1;

        if (p.meio === "dinheiro") {
          acc.totalDinheiro += valor;
        } else if (p.meio === "pix") {
          acc.totalPix += valor;
        }

        return acc;
      }, { ...vazio });
    } catch (err) {
      console.error("Falha catastrófica no resumo de ganhos:", err);
      return vazio;
    }
  });
