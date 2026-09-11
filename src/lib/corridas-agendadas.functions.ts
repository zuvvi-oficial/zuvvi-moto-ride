import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Corrida agendada — Etapa 1 do diferencial "agendar uma corrida pra um
 * horário futuro". Só a camada de dados (criar/listar/cancelar). O motor
 * que converte um agendamento vencido numa corrida real (reaproveitando
 * criarCorrida) é a Etapa 2 — ainda não existe.
 */
const JANELA_MINIMA_MS = 30 * 60 * 1000; // pelo menos 30 min de antecedência
const JANELA_MAXIMA_MS = 7 * 24 * 60 * 60 * 1000; // no máximo 7 dias

const criarCorridaAgendadaSchema = z.object({
  origemLat: z.number(),
  origemLng: z.number(),
  origemNome: z.string().max(200).optional(),
  destinoLat: z.number(),
  destinoLng: z.number(),
  destinoNome: z.string().max(200).optional(),
  formaPagamento: z.enum(["pix", "cartao", "dinheiro"]),
  horarioAgendado: z.string().datetime(),
});

async function resolverUsuarioComCidade(supabaseAdmin: any, authUserId: string) {
  const { data: usuario, error } = await supabaseAdmin
    .from("usuarios")
    .select("id, cidade_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error || !usuario) throw new Error("Usuário não encontrado.");
  return usuario as { id: string; cidade_id: string | null };
}

export const criarCorridaAgendada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => criarCorridaAgendadaSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const usuario = await resolverUsuarioComCidade(supabaseAdmin, context.userId);

    if (!usuario.cidade_id) throw new Error("Cidade não configurada.");

    const { data: cidade } = await supabaseAdmin
      .from("cidades")
      .select("status")
      .eq("id", usuario.cidade_id)
      .maybeSingle();

    if (!cidade || (cidade.status !== "piloto" && cidade.status !== "ativa")) {
      throw new Error("O Zuvvi ainda não opera nesta cidade.");
    }

    const horario = new Date(data.horarioAgendado);
    if (Number.isNaN(horario.getTime())) {
      throw new Error("Horário inválido.");
    }

    const agora = Date.now();
    if (horario.getTime() < agora + JANELA_MINIMA_MS) {
      throw new Error("Agende com pelo menos 30 minutos de antecedência.");
    }
    if (horario.getTime() > agora + JANELA_MAXIMA_MS) {
      throw new Error("Só é possível agendar com até 7 dias de antecedência.");
    }

    const { data: agendamento, error } = await supabaseAdmin
      .from("corridas_agendadas")
      .insert({
        passageiro_id: usuario.id,
        origem_lat: data.origemLat,
        origem_lng: data.origemLng,
        origem_nome: data.origemNome || null,
        destino_lat: data.destinoLat,
        destino_lng: data.destinoLng,
        destino_nome: data.destinoNome || null,
        forma_pagamento: data.formaPagamento,
        horario_agendado: horario.toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      const code = (error as { code?: string }).code;
      if (code === "23514") {
        throw new Error(
          "Você atingiu o limite de 10 corridas agendadas pendentes. Cancele uma para adicionar outra.",
        );
      }
      console.error("Erro ao criar corrida agendada:", error);
      throw new Error("Não foi possível agendar a corrida.");
    }

    return { success: true as const, id: agendamento.id as string };
  });

export const listarMinhasCorridasAgendadas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const usuario = await resolverUsuarioComCidade(supabaseAdmin, context.userId);

    const { data, error } = await supabaseAdmin
      .from("corridas_agendadas")
      .select(
        "id, origem_nome, destino_nome, forma_pagamento, horario_agendado, status, corrida_id, motivo_falha, created_at",
      )
      .eq("passageiro_id", usuario.id)
      .order("horario_agendado", { ascending: false });

    if (error) {
      console.error("Erro ao listar corridas agendadas:", error);
      throw new Error("Não foi possível carregar seus agendamentos.");
    }

    return (data || []).map((linha: any) => ({
      id: linha.id as string,
      origemNome: linha.origem_nome as string | null,
      destinoNome: linha.destino_nome as string | null,
      formaPagamento: linha.forma_pagamento as string,
      horarioAgendado: linha.horario_agendado as string,
      status: linha.status as "agendada" | "convertida" | "cancelada" | "falhou",
      corridaId: linha.corrida_id as string | null,
      motivoFalha: linha.motivo_falha as string | null,
    }));
  });

export const cancelarCorridaAgendada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const usuario = await resolverUsuarioComCidade(supabaseAdmin, context.userId);

    const { data: atualizado, error } = await supabaseAdmin
      .from("corridas_agendadas")
      .update({ status: "cancelada", updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("passageiro_id", usuario.id)
      .eq("status", "agendada")
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Erro ao cancelar corrida agendada:", error);
      throw new Error("Não foi possível cancelar este agendamento.");
    }

    if (!atualizado) {
      throw new Error("Agendamento não encontrado ou já não está mais pendente.");
    }

    return { success: true as const };
  });
