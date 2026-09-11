import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Controle Financeiro (Admin) — Etapa 1
 * Camada de relatório somente leitura sobre dados já existentes
 * (pagamentos.valor_total/valor_comissao/valor_motorista). Não altera
 * nenhuma regra de cobrança, corrida ou cadastro já em produção.
 */
async function checkAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: admin, error } = await supabaseAdmin
    .from("admin_users")
    .select("role, ativo")
    .eq("auth_user_id", userId)
    .single();

  if (error || !admin || !admin.ativo || admin.role !== "admin") {
    throw new Error("Acesso negado: Administrador não autorizado.");
  }
  return admin;
}

type Totais = {
  totalFaturado: number;
  totalComissao: number;
  totalMotorista: number;
  qtdCorridas: number;
};

function totaisVazios(): Totais {
  return { totalFaturado: 0, totalComissao: 0, totalMotorista: 0, qtdCorridas: 0 };
}

function somarTotais(acc: Totais, valorTotal: number, valorComissao: number, valorMotorista: number): Totais {
  return {
    totalFaturado: acc.totalFaturado + valorTotal,
    totalComissao: acc.totalComissao + valorComissao,
    totalMotorista: acc.totalMotorista + valorMotorista,
    qtdCorridas: acc.qtdCorridas + 1,
  };
}

export const getResumoFinanceiroAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
        cidadeId: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await checkAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Período padrão: mês atual (mesma convenção já usada em getResumoCarteira
    // e getResumoGanhos), sobrescrevível pelo chamador.
    const agora = new Date();
    const inicio = data.dataInicio || new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
    const fim = data.dataFim || agora.toISOString();

    // 1. Pagamentos já pagos no período, com o vínculo mínimo à corrida
    // (cidade e motorista). Segue o mesmo padrão de embed + filtro em coluna
    // embutida já usado em getMotoristasAdmin (admin.functions.ts).
    let query = supabaseAdmin
      .from("pagamentos")
      .select("valor_total, valor_comissao, valor_motorista, corridas!inner(cidade_id, motorista_id)")
      .eq("status", "pago")
      .gte("pago_at", inicio)
      .lte("pago_at", fim);

    if (data.cidadeId) {
      query = query.eq("corridas.cidade_id", data.cidadeId);
    }

    const { data: pagamentos, error } = await query;
    if (error) {
      console.error("Erro ao carregar resumo financeiro:", error);
      throw new Error("Não foi possível carregar o resumo financeiro.");
    }

    // 2. Agregação em memória por cidade e por motorista (mesmo volume de
    // dados de um app em fase piloto — sem necessidade de agregação no banco).
    const porCidadeMap = new Map<string, Totais>();
    const porMotoristaMap = new Map<string, Totais>();

    for (const linha of (pagamentos || []) as any[]) {
      const cidadeId = linha.corridas?.cidade_id as string | undefined;
      const motoristaId = linha.corridas?.motorista_id as string | undefined;
      const valorTotal = Number(linha.valor_total ?? 0);
      const valorComissao = Number(linha.valor_comissao ?? 0);
      const valorMotorista = Number(linha.valor_motorista ?? 0);

      if (cidadeId) {
        porCidadeMap.set(
          cidadeId,
          somarTotais(porCidadeMap.get(cidadeId) ?? totaisVazios(), valorTotal, valorComissao, valorMotorista),
        );
      }

      if (motoristaId) {
        porMotoristaMap.set(
          motoristaId,
          somarTotais(porMotoristaMap.get(motoristaId) ?? totaisVazios(), valorTotal, valorComissao, valorMotorista),
        );
      }
    }

    // 3. Nomes das cidades e motoristas envolvidos (só os que aparecem no
    // período filtrado, não a lista inteira do sistema).
    const cidadeIds = Array.from(porCidadeMap.keys());
    const motoristaIds = Array.from(porMotoristaMap.keys());

    const [cidadesResult, motoristasResult] = await Promise.all([
      cidadeIds.length > 0
        ? supabaseAdmin.from("cidades").select("id, nome, estado_uf").in("id", cidadeIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      motoristaIds.length > 0
        ? supabaseAdmin.from("usuarios").select("id, nome").in("id", motoristaIds)
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);

    if (cidadesResult.error) {
      console.error("Erro ao carregar cidades do resumo financeiro:", cidadesResult.error);
      throw new Error("Não foi possível carregar os nomes das cidades.");
    }
    if (motoristasResult.error) {
      console.error("Erro ao carregar motoristas do resumo financeiro:", motoristasResult.error);
      throw new Error("Não foi possível carregar os nomes dos motoristas.");
    }

    const cidadeInfoMap = new Map((cidadesResult.data || []).map((c: any) => [c.id, c]));
    const motoristaInfoMap = new Map((motoristasResult.data || []).map((m: any) => [m.id, m]));

    const porCidade = Array.from(porCidadeMap.entries())
      .map(([cidadeId, totais]) => ({
        cidadeId,
        cidadeNome: cidadeInfoMap.get(cidadeId)?.nome ?? "Desconhecida",
        estadoUf: cidadeInfoMap.get(cidadeId)?.estado_uf ?? "",
        ...totais,
      }))
      .sort((a, b) => b.totalFaturado - a.totalFaturado);

    const porMotorista = Array.from(porMotoristaMap.entries())
      .map(([motoristaId, totais]) => ({
        motoristaId,
        nome: motoristaInfoMap.get(motoristaId)?.nome ?? "Desconhecido",
        ...totais,
      }))
      .sort((a, b) => b.totalFaturado - a.totalFaturado);

    const totalGeral = porCidade.reduce(
      (acc, c) => ({
        totalFaturado: acc.totalFaturado + c.totalFaturado,
        totalComissao: acc.totalComissao + c.totalComissao,
        totalMotorista: acc.totalMotorista + c.totalMotorista,
        qtdCorridas: acc.qtdCorridas + c.qtdCorridas,
      }),
      totaisVazios(),
    );

    return {
      periodo: { inicio, fim },
      totalGeral,
      porCidade,
      porMotorista,
    };
  });
