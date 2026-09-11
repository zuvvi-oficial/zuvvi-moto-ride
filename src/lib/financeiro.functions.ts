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

// Achado do Codex no PR #55: a base tem 5500+ cidades semeadas em
// 'em_breve' (ainda não liberadas) e só um punhado em 'piloto'/'ativa'.
// Um dropdown paginado por getCidadesAdmin (ordenado por UF/nome) nunca
// alcançaria essas poucas cidades operacionais entre milhares de
// 'em_breve'. Como só cidades liberadas têm motoristas online e corridas,
// o filtro financeiro só precisa dessas — busca direta, sem paginação.
export const getCidadesOperacionaisAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await checkAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("cidades")
      .select("id, nome, estado_uf")
      .in("status", ["piloto", "ativa"])
      .order("estado_uf", { ascending: true })
      .order("nome", { ascending: true });

    if (error) {
      console.error("Erro ao carregar cidades operacionais:", error);
      throw new Error("Não foi possível carregar as cidades.");
    }

    return data || [];
  });

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

    // 1 e 2. Pagamentos já pagos no período, com o vínculo mínimo à corrida
    // (cidade e motorista), paginados explicitamente. Achado do Codex no
    // PR #54: sem paginação, um período com mais linhas que o limite padrão
    // do PostgREST (1000) faria a consulta devolver só um subconjunto sem
    // erro nenhum — subestimando todo total silenciosamente, o pior tipo de
    // bug possível justamente num relatório financeiro. Busca em páginas até
    // uma página vir mais curta que o tamanho pedido (fim dos resultados), e
    // agrega cada página imediatamente por cidade e por motorista.
    const porCidadeMap = new Map<string, Totais>();
    const porMotoristaMap = new Map<string, Totais>();

    const TAMANHO_PAGINA = 1000;
    let inicioPagina = 0;
    for (;;) {
      let query = supabaseAdmin
        .from("pagamentos")
        .select("valor_total, valor_comissao, valor_motorista, corridas!inner(cidade_id, motorista_id)")
        .eq("status", "pago")
        .gte("pago_at", inicio)
        .lte("pago_at", fim)
        .range(inicioPagina, inicioPagina + TAMANHO_PAGINA - 1);

      if (data.cidadeId) {
        query = query.eq("corridas.cidade_id", data.cidadeId);
      }

      const { data: pagina, error } = await query;
      if (error) {
        console.error("Erro ao carregar resumo financeiro:", error);
        throw new Error("Não foi possível carregar o resumo financeiro.");
      }

      for (const linha of (pagina || []) as any[]) {
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

      if (!pagina || pagina.length < TAMANHO_PAGINA) break;
      inicioPagina += TAMANHO_PAGINA;
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

/**
 * Controle Financeiro (Admin) — Etapa 3
 * Drill-down: lista as corridas pagas individuais dentro de um período,
 * opcionalmente restritas a uma cidade e/ou motorista — o mesmo recorte
 * já somado por getResumoFinanceiroAdmin, agora linha a linha.
 */
export const getCorridasFinanceiroAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        dataInicio: z.string(),
        dataFim: z.string(),
        cidadeId: z.string().optional(),
        motoristaId: z.string().optional(),
        pagina: z.number().default(0),
        limite: z.number().default(20),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await checkAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const offset = data.pagina * data.limite;

    let query = supabaseAdmin
      .from("pagamentos")
      .select(
        "id, valor_total, valor_comissao, valor_motorista, meio, pago_at, corridas!inner(id, cidade_id, motorista_id, passageiro_id, origem_nome, destino_nome)",
        { count: "exact" },
      )
      .eq("status", "pago")
      .gte("pago_at", data.dataInicio)
      .lte("pago_at", data.dataFim);

    if (data.cidadeId) {
      query = query.eq("corridas.cidade_id", data.cidadeId);
    }
    if (data.motoristaId) {
      query = query.eq("corridas.motorista_id", data.motoristaId);
    }

    const { data: pagamentos, count, error } = await query
      .order("pago_at", { ascending: false })
      .range(offset, offset + data.limite - 1);

    if (error) {
      console.error("Erro ao carregar corridas do financeiro:", error);
      throw new Error("Não foi possível carregar as corridas do período.");
    }

    const linhas = (pagamentos || []) as any[];

    // motorista_id de corridas é PK compartilhada com usuarios.id (a tabela
    // motoristas usa o mesmo id de usuarios), então passageiro e motorista
    // são resolvidos na mesma tabela — mesmo padrão de nomes do resumo.
    const usuarioIds = Array.from(
      new Set(
        linhas.flatMap((linha) => [linha.corridas?.passageiro_id, linha.corridas?.motorista_id].filter(Boolean)),
      ),
    );

    const { data: usuarios, error: usuariosError } =
      usuarioIds.length > 0
        ? await supabaseAdmin.from("usuarios").select("id, nome").in("id", usuarioIds)
        : { data: [] as any[], error: null };

    if (usuariosError) {
      console.error("Erro ao carregar nomes das corridas do financeiro:", usuariosError);
      throw new Error("Não foi possível carregar os nomes das corridas.");
    }

    const nomeMap = new Map((usuarios || []).map((u: any) => [u.id, u.nome]));

    const corridas = linhas.map((linha) => ({
      pagamentoId: linha.id as string,
      corridaId: linha.corridas?.id as string,
      pagoEm: linha.pago_at as string,
      meio: linha.meio as string,
      valorTotal: Number(linha.valor_total ?? 0),
      valorComissao: Number(linha.valor_comissao ?? 0),
      valorMotorista: Number(linha.valor_motorista ?? 0),
      origemNome: (linha.corridas?.origem_nome as string | null) ?? null,
      destinoNome: (linha.corridas?.destino_nome as string | null) ?? null,
      passageiroNome: nomeMap.get(linha.corridas?.passageiro_id) ?? "Desconhecido",
      motoristaNome: nomeMap.get(linha.corridas?.motorista_id) ?? "Desconhecido",
    }));

    return {
      corridas,
      total: count || 0,
      pagina: data.pagina,
      limite: data.limite,
    };
  });
