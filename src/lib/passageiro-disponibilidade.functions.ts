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

const REQUIRED_DRIVER_DOCUMENTS = [
  "identidade",
  "cnh",
  "comprovante_residencia",
  "crlv",
  "foto_veiculo",
  "foto_placa",
] as const;

export type PassageiroDriverAvailability = {
  hasAvailableDriver: boolean;
  cityName: string | null;
  cityUf: string | null;
  cityStatus: string | null;
  reason:
    | "available"
    | "not_passenger"
    | "city_not_configured"
    | "city_unavailable"
    | "no_driver_online";
};

function unavailable(
  reason: PassageiroDriverAvailability["reason"],
  city?: { nome: string; estado_uf: string; status: string } | null,
): PassageiroDriverAvailability {
  return {
    hasAvailableDriver: false,
    cityName: city?.nome ?? null,
    cityUf: city?.estado_uf ?? null,
    cityStatus: city?.status ?? null,
    reason,
  };
}

/**
 * P1B — Verificação somente leitura para a Home do passageiro.
 *
 * Um motorista só é considerado disponível quando:
 * - pertence à mesma cidade cadastrada do passageiro (a P1 confirma depois
 *   que essa cidade coincide com a origem GPS real antes de exibir o aviso);
 * - está aprovado e explicitamente online;
 * - possui CNH completa, válida e categoria A/AB;
 * - enviou GPS nos últimos 5 minutos;
 * - possui um veículo aprovado e ativo;
 * - possui os documentos operacionais obrigatórios aprovados;
 * - não possui corrida operacional ativa.
 *
 * Esta consulta não coloca motorista online/offline, não cria corrida e não
 * altera banco. A elegibilidade autoritativa continua sendo revalidada pelas
 * funções do motorista no momento das ações operacionais.
 */
export const checkPassageiroDriverAvailability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PassageiroDriverAvailability> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: passageiro, error: passageiroError } = await supabaseAdmin
      .from("usuarios")
      .select("cidade_id, is_motorista")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    if (passageiroError || !passageiro) {
      return unavailable("city_not_configured");
    }

    if (passageiro.is_motorista) {
      return unavailable("not_passenger");
    }

    if (!passageiro.cidade_id) {
      return unavailable("city_not_configured");
    }

    const { data: cidade, error: cidadeError } = await supabaseAdmin
      .from("cidades")
      .select("nome, estado_uf, status")
      .eq("id", passageiro.cidade_id)
      .maybeSingle();

    if (cidadeError || !cidade) {
      return unavailable("city_not_configured");
    }

    const cityEnabled = cidade.status === "piloto" || cidade.status === "ativa";
    if (!cityEnabled) {
      return unavailable("city_unavailable", cidade);
    }

    const freshnessCutoff = new Date(Date.now() - DRIVER_LOCATION_FRESHNESS_MS).toISOString();
    const todayStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const { data: motoristasOnline, error: motoristasError } = await supabaseAdmin
      .from("motoristas")
      .select(
        "id, cnh_numero, cnh_categoria, cnh_validade, ultima_lat, ultima_lng, ultima_localizacao_at",
      )
      .eq("status_aprovacao", "aprovado")
      .eq("is_disponivel", true)
      .gte("ultima_localizacao_at", freshnessCutoff);

    if (motoristasError) {
      throw new Error("Não foi possível verificar a disponibilidade de mototaxistas.");
    }

    const onlineIds = (motoristasOnline ?? [])
      .filter((motorista) => {
        const categoria = String(motorista.cnh_categoria ?? "").toUpperCase();
        const cnhValida =
          Boolean(motorista.cnh_numero) &&
          Boolean(motorista.cnh_validade) &&
          String(motorista.cnh_validade) >= todayStr &&
          (categoria === "A" || categoria === "AB");

        return (
          cnhValida &&
          Number.isFinite(Number(motorista.ultima_lat)) &&
          Number.isFinite(Number(motorista.ultima_lng))
        );
      })
      .map((motorista) => motorista.id);

    if (onlineIds.length === 0) {
      return unavailable("no_driver_online", cidade);
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
      return unavailable("no_driver_online", cidade);
    }

    const { data: veiculosValidos, error: veiculosError } = await supabaseAdmin
      .from("veiculos")
      .select("id, motorista_id")
      .in("motorista_id", cityDriverIds)
      .eq("status_aprovacao", "aprovado")
      .eq("ativo", true);

    if (veiculosError) {
      throw new Error("Não foi possível verificar a disponibilidade de mototaxistas.");
    }

    const vehiclesByDriver = new Map<string, string[]>();
    for (const veiculo of veiculosValidos ?? []) {
      if (!veiculo.motorista_id) continue;
      const current = vehiclesByDriver.get(veiculo.motorista_id) ?? [];
      current.push(veiculo.id);
      vehiclesByDriver.set(veiculo.motorista_id, current);
    }

    // A regra operacional atual espera um único veículo elegível para o motorista.
    const vehicleEligibleDrivers = cityDriverIds.filter(
      (id) => (vehiclesByDriver.get(id)?.length ?? 0) === 1,
    );

    if (vehicleEligibleDrivers.length === 0) {
      return unavailable("no_driver_online", cidade);
    }

    const vehicleIds = vehicleEligibleDrivers
      .map((id) => vehiclesByDriver.get(id)?.[0])
      .filter((id): id is string => Boolean(id));

    const [{ data: driverDocs, error: driverDocsError }, { data: vehicleDocs, error: vehicleDocsError }] =
      await Promise.all([
        supabaseAdmin
          .from("documentos_motorista")
          .select("motorista_id, tipo_documento")
          .in("motorista_id", vehicleEligibleDrivers)
          .eq("status_analise", "aprovado"),
        supabaseAdmin
          .from("documentos_motorista")
          .select("veiculo_id, tipo_documento")
          .in("veiculo_id", vehicleIds)
          .eq("status_analise", "aprovado"),
      ]);

    if (driverDocsError || vehicleDocsError) {
      throw new Error("Não foi possível verificar a disponibilidade de mototaxistas.");
    }

    const documentsByDriver = new Map<string, Set<string>>();
    for (const driverId of vehicleEligibleDrivers) {
      documentsByDriver.set(driverId, new Set<string>());
    }

    for (const doc of driverDocs ?? []) {
      if (!doc.motorista_id) continue;
      documentsByDriver.get(doc.motorista_id)?.add(String(doc.tipo_documento));
    }

    const driverByVehicle = new Map<string, string>();
    for (const driverId of vehicleEligibleDrivers) {
      const vehicleId = vehiclesByDriver.get(driverId)?.[0];
      if (vehicleId) driverByVehicle.set(vehicleId, driverId);
    }

    for (const doc of vehicleDocs ?? []) {
      if (!doc.veiculo_id) continue;
      const driverId = driverByVehicle.get(doc.veiculo_id);
      if (driverId) documentsByDriver.get(driverId)?.add(String(doc.tipo_documento));
    }

    const documentEligibleDrivers = vehicleEligibleDrivers.filter((driverId) => {
      const docs = documentsByDriver.get(driverId) ?? new Set<string>();
      return REQUIRED_DRIVER_DOCUMENTS.every((required) => docs.has(required));
    });

    if (documentEligibleDrivers.length === 0) {
      return unavailable("no_driver_online", cidade);
    }

    const { data: corridasAtivas, error: corridasError } = await supabaseAdmin
      .from("corridas")
      .select("motorista_id")
      .in("motorista_id", documentEligibleDrivers)
      .in("status", [...DRIVER_BUSY_STATUSES]);

    if (corridasError) {
      throw new Error("Não foi possível verificar a disponibilidade de mototaxistas.");
    }

    const busyDriverIds = new Set(
      (corridasAtivas ?? [])
        .map((corrida) => corrida.motorista_id)
        .filter((id): id is string => Boolean(id)),
    );

    const hasAvailableDriver = documentEligibleDrivers.some((id) => !busyDriverIds.has(id));

    return {
      hasAvailableDriver,
      cityName: cidade.nome,
      cityUf: cidade.estado_uf,
      cityStatus: cidade.status,
      reason: hasAvailableDriver ? "available" : "no_driver_online",
    };
  });
