import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Quantas corridas concluídas olhar para trás ao montar a carteira. Suficiente
// para cobrir hoje/semana/mês com folga em qualquer volume realista de piloto;
// se o motorista crescer muito além disso, vale trocar por uma agregação SQL.
const HISTORICO_LIMITE = 500;
const HISTORICO_EXIBIDO = 50;

const DIA_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export const getCarteiraMotorista = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: user, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id, is_motorista")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    if (userError || !user) throw new Error("Usuário não encontrado.");
    if (!user.is_motorista) throw new Error("Acesso restrito a motoristas.");

    const { data: corridas, error } = await supabaseAdmin
      .from("corridas")
      .select(
        "id, origem_nome, destino_nome, data_finalizacao, forma_pagamento, pagamentos(valor_motorista, valor_comissao, valor_total, status, pago_at)",
      )
      .eq("motorista_id", user.id)
      .eq("status", "concluida")
      .order("data_finalizacao", { ascending: false })
      .limit(HISTORICO_LIMITE);

    if (error) throw new Error("Não foi possível carregar a carteira.");

    type CorridaComPagamento = {
      id: string;
      origem_nome: string | null;
      destino_nome: string | null;
      data_finalizacao: string | null;
      forma_pagamento: string;
      pagamentos: Array<{
        valor_motorista: number;
        valor_comissao: number;
        valor_total: number;
        status: string;
        pago_at: string | null;
      }> | null;
    };

    // Só entra na carteira o que foi de fato liquidado — dinheiro que o
    // motorista marcou como não recebido, por exemplo, fica pendente e
    // nunca deveria contar como ganho.
    const pagas = ((corridas || []) as CorridaComPagamento[]).flatMap((corrida) => {
      const pagamento = corrida.pagamentos?.[0];
      if (!pagamento || pagamento.status !== "pago") return [];
      return [{ ...corrida, pagamento }];
    });

    const hojeStr = DIA_FORMATTER.format(new Date());
    const mesAtualStr = hojeStr.slice(0, 7);
    const seteDiasAtras = Date.now() - 7 * 24 * 60 * 60 * 1000;

    let ganhosHoje = 0;
    let ganhosSemana = 0;
    let ganhosMes = 0;
    let ganhosTotal = 0;

    for (const corrida of pagas) {
      const valor = Number(corrida.pagamento.valor_motorista);
      ganhosTotal += valor;

      if (!corrida.pagamento.pago_at) continue;
      const pagoAtMs = new Date(corrida.pagamento.pago_at).getTime();
      const pagoAtDiaStr = DIA_FORMATTER.format(new Date(pagoAtMs));

      if (pagoAtDiaStr === hojeStr) ganhosHoje += valor;
      if (pagoAtMs >= seteDiasAtras) ganhosSemana += valor;
      if (pagoAtDiaStr.slice(0, 7) === mesAtualStr) ganhosMes += valor;
    }

    return {
      resumo: {
        hoje: arredondar(ganhosHoje),
        semana: arredondar(ganhosSemana),
        mes: arredondar(ganhosMes),
        total: arredondar(ganhosTotal),
        totalCorridas: pagas.length,
      },
      historico: pagas.slice(0, HISTORICO_EXIBIDO).map((corrida) => ({
        corridaId: corrida.id,
        origemNome: corrida.origem_nome,
        destinoNome: corrida.destino_nome,
        dataFinalizacao: corrida.data_finalizacao,
        formaPagamento: corrida.forma_pagamento,
        valorMotorista: arredondar(Number(corrida.pagamento.valor_motorista)),
        valorComissao: arredondar(Number(corrida.pagamento.valor_comissao)),
        valorTotal: arredondar(Number(corrida.pagamento.valor_total)),
      })),
    };
  });
