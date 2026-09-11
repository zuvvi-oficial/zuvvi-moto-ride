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

// Se uma execução anterior reservou um agendamento (status='convertida' sem
// corrida_id ainda) e foi interrompida antes de terminar — deploy, timeout,
// crash — essa reserva precisa de um "lease": depois desse prazo, sem sinal
// de conclusão, ela é liberada de volta para 'agendada' em vez de ficar
// presa pra sempre (achado do Codex no PR #68, P1).
const LEASE_TIMEOUT_MS = 2 * 60 * 1000;

// Se o cron ficou fora do ar por muito tempo (secret mal configurado,
// instabilidade do GitHub Actions), agendamentos vencidos há muito tempo não
// devem ser disparados de qualquer jeito quando o cron volta — isso criaria
// corridas reais horas ou dias depois do horário pedido, sem o passageiro
// esperando. Marca como falhou em vez de despachar (achado do Codex no PR
// #68, P1).
const JANELA_MAXIMA_ATRASO_MS = 20 * 60 * 1000;

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
  horario_agendado: string;
}>;

export async function converterCorridasAgendadasVencidas(): Promise<ResumoConversaoAgendadas> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { criarNotificacao } = await import("./notificacoes.server");

  let verificados = 0;
  let convertidos = 0;
  let falharam = 0;

  // Recuperação de reservas travadas por uma execução anterior interrompida
  // (ver LEASE_TIMEOUT_MS acima). Roda antes de buscar novos candidatos.
  await supabaseAdmin
    .from("corridas_agendadas")
    .update({ status: "agendada", updated_at: new Date().toISOString() } as any)
    .eq("status", "convertida")
    .is("corrida_id", null)
    .lt("updated_at", new Date(Date.now() - LEASE_TIMEOUT_MS).toISOString());

  const { data: agendamentos, error } = await supabaseAdmin
    .from("corridas_agendadas")
    .select(
      "id, passageiro_id, origem_lat, origem_lng, origem_nome, destino_lat, destino_lng, destino_nome, forma_pagamento, horario_agendado",
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
    // Atraso além do limite (cron ficou fora do ar por muito tempo): nunca
    // despacha uma corrida "atrasada" sem o passageiro esperando. Marca como
    // falhou direto, sem reservar nem gastar cotação/criação.
    const atrasoMs = Date.now() - new Date(agendamento.horario_agendado).getTime();
    if (atrasoMs > JANELA_MAXIMA_ATRASO_MS) {
      falharam += 1;
      await supabaseAdmin
        .from("corridas_agendadas")
        .update({
          status: "falhou",
          motivo_falha: "Agendamento expirado: atraso além do limite aceitável.",
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", agendamento.id)
        .eq("status", "agendada");

      await criarNotificacao(supabaseAdmin, {
        usuario_id: agendamento.passageiro_id,
        tipo: "corrida_agendada_falhou",
        titulo: "⚠️ Sua corrida agendada expirou",
        mensagem: "Não conseguimos solicitar sua corrida agendada a tempo. Peça manualmente pelo app.",
        corrida_id: null,
      });
      continue;
    }

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

      // A corrida real já foi criada com sucesso nesse ponto — o que importa
      // pro passageiro já aconteceu. Uma falha neste UPDATE é só um problema
      // de vínculo/bookkeeping (achado do Codex no PR #68, P2): nunca deve
      // reverter pra 'falhou' nem deixar de notificar quem já tem corrida de
      // verdade, mas precisa ficar visível pra reconciliação manual.
      const { error: vinculoError } = await supabaseAdmin
        .from("corridas_agendadas")
        .update({ corrida_id: resultado.rideId, updated_at: new Date().toISOString() } as any)
        .eq("id", agendamento.id);

      if (vinculoError) {
        console.error(
          "[CorridasAgendadasEngine] Corrida criada com sucesso, mas falha ao vincular corrida_id — requer reconciliação manual.",
          { agendamentoId: agendamento.id, corridaId: resultado.rideId },
        );
      }

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
