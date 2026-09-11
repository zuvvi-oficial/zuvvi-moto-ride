// Rotina periódica (chamada por job externo, ver src/server.ts e
// .github/workflows/corridas-agendadas-converter.yml) que converte
// agendamentos vencidos (corridas_agendadas.status='agendada' com
// horario_agendado <= agora) em corridas reais de fato, reaproveitando
// cotarCorridaCore/criarCorridaCore de user.functions.ts — o mesmo cálculo
// de preço e a mesma prioridade de motorista favorito que qualquer corrida
// pedida ao vivo. Nunca usa um preço "congelado" de quando o agendamento
// foi criado: a cotação é sempre recalculada agora, na conversão.
import { cotarCorridaCore, criarCorridaCore } from "./user.functions";

const BATCH_LIMIT = 50;

export type ResumoConversaoAgendadas = Readonly<{
  verificados: number;
  convertidos: number;
  falharam: number;
}>;

type AgendamentoRow = Readonly<{
  id: string;
  passageiro_id: string;
  origem_lat: number;
  origem_lng: number;
  origem_nome: string | null;
  destino_lat: number;
  destino_lng: number;
  destino_nome: string | null;
  forma_pagamento: "pix" | "cartao" | "dinheiro";
}>;

export async function converterCorridasAgendadasVencidas(): Promise<ResumoConversaoAgendadas> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { criarNotificacao } = await import("./notificacoes.server");

  let verificados = 0;
  let convertidos = 0;
  let falharam = 0;

  const { data: agendamentos, error } = await supabaseAdmin
    .from("corridas_agendadas")
    .select(
      "id, passageiro_id, origem_lat, origem_lng, origem_nome, destino_lat, destino_lng, destino_nome, forma_pagamento",
    )
    .eq("status", "agendada")
    .lte("horario_agendado", new Date().toISOString())
    .order("horario_agendado", { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) {
    console.error("[CorridasAgendadasEngine] Falha ao buscar agendamentos vencidos.");
    throw new Error("Não foi possível buscar corridas agendadas pendentes.");
  }

  const candidatos = (agendamentos ?? []) as unknown as AgendamentoRow[];
  verificados = candidatos.length;

  for (const agendamento of candidatos) {
    try {
      // Reserva o agendamento antes de qualquer trabalho caro (cotação via
      // Mapbox, criação da corrida): UPDATE condicional (compare-and-swap),
      // o mesmo padrão de "reserva atômica antes de processar" já usado em
      // pagamentos_pix_tentativas. Impede que duas execuções concorrentes do
      // cron (ex.: overlap de agendamentos do GitHub Actions) processem o
      // mesmo agendamento duas vezes, e que um cancelamento do passageiro
      // vença por pouco a conversão.
      const { data: reservado, error: reservaError } = await supabaseAdmin
        .from("corridas_agendadas")
        .update({ status: "convertida", updated_at: new Date().toISOString() } as any)
        .eq("id", agendamento.id)
        .eq("status", "agendada")
        .select("id")
        .maybeSingle();

      if (reservaError) {
        console.error("[CorridasAgendadasEngine] Falha ao reservar agendamento.", { id: agendamento.id });
        falharam += 1;
        continue;
      }

      if (!reservado) {
        // Outra execução já pegou este agendamento, ou o passageiro acabou
        // de cancelar entre a busca acima e agora. Nada a fazer.
        continue;
      }

      const { data: usuario, error: usuarioError } = await supabaseAdmin
        .from("usuarios")
        .select("auth_user_id")
        .eq("id", agendamento.passageiro_id)
        .maybeSingle();

      if (usuarioError || !usuario?.auth_user_id) {
        throw new Error("Passageiro não encontrado.");
      }

      const coords = {
        origemLat: Number(agendamento.origem_lat),
        origemLng: Number(agendamento.origem_lng),
        destinoLat: Number(agendamento.destino_lat),
        destinoLng: Number(agendamento.destino_lng),
      };

      const cotacao = await cotarCorridaCore(supabaseAdmin, usuario.auth_user_id, coords);

      const resultado = await criarCorridaCore(supabaseAdmin, usuario.auth_user_id, {
        ...coords,
        valorCotado: cotacao.valor,
        distanciaKm: cotacao.distanceKm,
        duracaoMin: cotacao.durationMin,
        tarifaBandeirada: cotacao.tarifas.bandeirada,
        tarifaValorKm: cotacao.tarifas.valorKm,
        tarifaValorMin: cotacao.tarifas.valorMin,
        tarifaMinima: cotacao.tarifas.tarifaMinima,
        formaPagamento: agendamento.forma_pagamento,
        origemNome: agendamento.origem_nome || undefined,
        destinoNome: agendamento.destino_nome || undefined,
      });

      await supabaseAdmin
        .from("corridas_agendadas")
        .update({ corrida_id: resultado.rideId, updated_at: new Date().toISOString() } as any)
        .eq("id", agendamento.id);

      await criarNotificacao(supabaseAdmin, {
        usuario_id: agendamento.passageiro_id,
        tipo: "corrida_agendada_convertida",
        titulo: "🕐 Sua corrida agendada foi solicitada!",
        mensagem: "Estamos buscando um motorista pra você agora.",
        corrida_id: resultado.rideId,
      });

      convertidos += 1;
    } catch (err) {
      falharam += 1;
      const motivo = err instanceof Error ? err.message : "Erro desconhecido ao converter agendamento.";
      console.error("[CorridasAgendadasEngine] Falha ao converter agendamento.", {
        id: agendamento.id,
        motivo,
      });

      // Reverte a reserva para 'falhou' — só se ainda estava com o status
      // que nós mesmos gravamos ('convertida' sem corrida_id preenchido
      // seria confuso de outra forma); se por algum motivo já tiver virado
      // outra coisa nesse intervalo, não sobrescreve.
      await supabaseAdmin
        .from("corridas_agendadas")
        .update({ status: "falhou", motivo_falha: motivo, updated_at: new Date().toISOString() } as any)
        .eq("id", agendamento.id)
        .eq("status", "convertida")
        .is("corrida_id", null);

      await criarNotificacao(supabaseAdmin, {
        usuario_id: agendamento.passageiro_id,
        tipo: "corrida_agendada_falhou",
        titulo: "⚠️ Não conseguimos pedir sua corrida agendada",
        mensagem: "Não foi possível solicitar sua corrida agendada automaticamente. Peça manualmente pelo app.",
        corrida_id: null,
      });
    }
  }

  return { verificados, convertidos, falharam };
}
