import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DRIVER_LOCATION_FRESHNESS_MS = 5 * 60 * 1000;

const DRIVER_BUSY_STATUSES = [
  "aguardando_pagamento",
  "aceita",
  "motorista_a_caminho",
  "motorista_chegou",
  "em_andamento",
] as const;

export type PassageiroDriverAvailability = {
  hasAvailableDriver: boolean;
  cityName: string | null;
  cityUf: string | null;
  cityStatus: string | null;
  reason:
    | "available"
    | "city_not_configured"
    | "city_unavailable"
    | "no_driver_online";
};

/**
 * P1B — Verificação somente leitura para a Home do passageiro.
 *
 * Um motorista só é considerado disponível quando:
 * - pertence à mesma cidade cadastrada do passageiro (a P1 já garante que
 *   essa cidade coincide com a origem GPS real antes de liberar a Home);
 * - está aprovado e explicitamente online;
 * - enviou GPS nos últimos 5 minutos;
 * - possui veículo aprovado e ativo;
 * - não possui corrida operacional ativa.
 *
 * A elegibilidade completa continua sendo revalidada nas funções do motorista
 * antes de aceitar corrida. Esta consulta não altera motorista, corrida ou banco.
 */
export const checkPassageiroDriverAvailability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PassageiroDriverAvailability> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: passageiro, error: passageiroError } = await supabaseAdmin
      .from("usuarios")
      .select("cidade_id")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    if (passageiroError || !passageiro?.cidade_id) {
      return {
        hasAvailableDriver: false,
        cityName: null,
        cityUf: null,
        cityStatus: null,
        reason: "city_not_configured",
      };
    }

    const { data: cidade, error: cidadeError } = await supabaseAdmin
      .from("cidades")
      .select("nome, estado_uf, status")
      .eq("id", passageiro.cidade_id)
      .maybeSingle();

    if (cidadeError || !cidade) {
      return {
        hasAvailableDriver: false,
        cityName: null,
        cityUf: null,
        cityStatus: null,
        reason: "city_not_configured",
      };
    }

    const cityEnabled = cidade.status === "piloto" || cidade.status === "ativa";
    if (!cityEnabled) {
      return {
        hasAvailableDriver: false,
        cityName: cidade.nome,
        cityUf: cidade.estado_uf,
        cityStatus: cidade.status,
        reason: "city_unavailable",
      };
    }

    const freshnessCutoff = new Date(Date.now() - DRIVER_LOCATION_FRESHNESS_MS).toISOString();

    const { data: motoristasOnline, error: motoristasError } = await supabaseAdmin
      .from("motoristas")
      .select("id, ultima_lat, ultima_lng, ultima_localizacao_at")
      .eq("status_aprovacao", "aprovado")
      .eq("is_disponivel", true)
      .gte("ultima_localizacao_at", freshnessCutoff);

    if (motoristasError) {
      throw new Error("Não foi possível verificar a disponibilidade de mototaxistas.");
    }

    const onlineIds = (motoristasOnline ?? [])
      .filter((motorista) =>
        Number.isFinite(Number(motorista.ultima_lat)) &&
        Number.isFinite(Number(motorista.ultima_lng))
      )
      .map((motorista) => motorista.id);

    if (onlineIds.length === 0) {
      return {
        hasAvailableDriver: false,
        cityName: cidade.nome,
        cityUf: cidade.estado_uf,
        cityStatus: cidade.status,
        reason: "no_driver_online",
      };
    }

    const { data: usuariosDaCidade, error: usuariosError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("cidade_id", passageiro.cidade_id)
      .eq("is_motorista", true)
      .in("id", onlineIds);

    if (usuariosError) {
      throw new Error("Não foi possível verificar a disponibilidade de mototaxistas.");
    }

    const cityDriverIds = (usuariosDaCidade ?? []).map((usuario) => usuario.id);
    if (cityDriverIds.length === 0) {
      return {
        hasAvailableDriver: false,
        cityName: cidade.nome,
        cityUf: cidade.estado_uf,
        cityStatus: cidade.status,
        reason: "no_driver_online",
      };
    }

    const { data: veiculosValidos, error: veiculosError } = await supabaseAdmin
      .from("veiculos")
      .select("motorista_id")
      .in("motorista_id", cityDriverIds)
      .eq("status_aprovacao", "aprovado")
      .eq("ativo", true);

    if (veiculosError) {
      throw new Error("Não foi possível verificar a disponibilidade de mototaxistas.");
    }

    const vehicleEligibleIds = Array.from(
      new Set(
        (veiculosValidos ?? [])
          .map((veiculo) => veiculo.motorista_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    if (vehicleEligibleIds.length === 0) {
      return {
        hasAvailableDriver: false,
        cityName: cidade.nome,
        cityUf: cidade.estado_uf,
        cityStatus: cidade.status,
        reason: "no_driver_online",
      };
    }

    const { data: corridasAtivas, error: corridasError } = await supabaseAdmin
      .from("corridas")
      .select("motorista_id")
      .in("motorista_id", vehicleEligibleIds)
      .in("status", DRIVER_BUSY_STATUSES as unknown as string[]);

    if (corridasError) {
      throw new Error("Não foi possível verificar a disponibilidade de mototaxistas.");
    }

    const busyDriverIds = new Set(
      (corridasAtivas ?? [])
        .map((corrida) => corrida.motorista_id)
        .filter((id): id is string => Boolean(id)),
    );

    const hasAvailableDriver = vehicleEligibleIds.some((id) => !busyDriverIds.has(id));

    return {
      hasAvailableDriver,
      cityName: cidade.nome,
      cityUf: cidade.estado_uf,
      cityStatus: cidade.status,
      reason: hasAvailableDriver ? "available" : "no_driver_online",
    };
  });
