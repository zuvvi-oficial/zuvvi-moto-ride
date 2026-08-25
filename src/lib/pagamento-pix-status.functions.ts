import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type PagamentoPixTelaStatus =
  "gerando" | "aguardando" | "analisando" | "pago" | "expirado" | "falhou" | "estornado";

export type PagamentoPixTelaSnapshot = Readonly<{
  status: PagamentoPixTelaStatus;
  valor: number;
  pixCopiaCola: string | null;
  deadlineAt: string | null;
  remainingSeconds: number | null;
  serverNow: string;
  podeAcompanhar: boolean;
}>;

export type PagamentoPixEstadoInput = Readonly<{
  pagamentoStatus: string;
  corridaStatus: string;
  tentativaEstado?: string | null;
  providerStatus?: string | null;
  pixCopiaCola?: string | null;
  tentativaCreatedAt?: string | null;
  providerExpiresAt?: string | null;
}>;

const statusSchema = z.object({ rideId: z.string().uuid() });
const DEFAULT_PIX_PAYMENT_TIMEOUT_SECONDS = 5 * 60;
const MIN_PIX_PAYMENT_TIMEOUT_SECONDS = 60;
const MAX_PIX_PAYMENT_TIMEOUT_SECONDS = 15 * 60;

function parseDateMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getPixPaymentTimeoutSeconds(rawValue?: string | null): number {
  if (!rawValue) return DEFAULT_PIX_PAYMENT_TIMEOUT_SECONDS;
  const parsed = Number(rawValue);
  if (
    !Number.isInteger(parsed) ||
    parsed < MIN_PIX_PAYMENT_TIMEOUT_SECONDS ||
    parsed > MAX_PIX_PAYMENT_TIMEOUT_SECONDS
  ) {
    return DEFAULT_PIX_PAYMENT_TIMEOUT_SECONDS;
  }
  return parsed;
}

export function calcularDeadlinePix(
  tentativaCreatedAt: string | null | undefined,
  providerExpiresAt: string | null | undefined,
  timeoutSeconds = DEFAULT_PIX_PAYMENT_TIMEOUT_SECONDS,
): string | null {
  const createdAtMs = parseDateMs(tentativaCreatedAt);
  if (createdAtMs === null) return null;

  const zuvviDeadlineMs = createdAtMs + timeoutSeconds * 1_000;
  const providerDeadlineMs = parseDateMs(providerExpiresAt);
  const effectiveDeadlineMs =
    providerDeadlineMs !== null ? Math.min(zuvviDeadlineMs, providerDeadlineMs) : zuvviDeadlineMs;

  return new Date(effectiveDeadlineMs).toISOString();
}

export function derivarEstadoPagamentoPix(
  input: PagamentoPixEstadoInput,
  nowMs: number,
  timeoutSeconds = DEFAULT_PIX_PAYMENT_TIMEOUT_SECONDS,
): Readonly<{ status: PagamentoPixTelaStatus; deadlineAt: string | null }> {
  if (!Number.isFinite(nowMs)) throw new Error("PIX_STATUS_RELOGIO_INVALIDO");

  const deadlineAt = calcularDeadlinePix(
    input.tentativaCreatedAt,
    input.providerExpiresAt,
    timeoutSeconds,
  );
  const deadlineMs = parseDateMs(deadlineAt);
  const providerStatus = input.providerStatus?.trim().toLowerCase() ?? null;
  const tentativaEstado = input.tentativaEstado?.trim().toLowerCase() ?? null;
  const pagamentoStatus = input.pagamentoStatus.trim().toLowerCase();
  const pixCopiaCola = input.pixCopiaCola?.trim() || null;

  // O agregado é a única autoridade para liberar a corrida.
  if (pagamentoStatus === "pago") return { status: "pago", deadlineAt };
  if (pagamentoStatus === "estornado" || tentativaEstado === "estornado") {
    return { status: "estornado", deadlineAt };
  }
  if (pagamentoStatus === "falhou" || tentativaEstado === "falhou") {
    return { status: "falhou", deadlineAt };
  }

  if (providerStatus === "expired" || (deadlineMs !== null && nowMs >= deadlineMs)) {
    return { status: "expirado", deadlineAt };
  }

  if (providerStatus === "rejected" || providerStatus === "cancelled") {
    return { status: "falhou", deadlineAt };
  }

  if (!tentativaEstado || tentativaEstado === "criando" || !pixCopiaCola) {
    return { status: "gerando", deadlineAt };
  }

  // Mesmo que o provedor diga approved, a UI não libera antes do agregado = pago.
  if (
    tentativaEstado === "pago" ||
    providerStatus === "approved" ||
    providerStatus === "in_process" ||
    providerStatus === "in_mediation"
  ) {
    return { status: "analisando", deadlineAt };
  }

  return { status: "aguardando", deadlineAt };
}

function remainingSeconds(deadlineAt: string | null, nowMs: number): number | null {
  const deadlineMs = parseDateMs(deadlineAt);
  if (deadlineMs === null) return null;
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1_000));
}

export const getPagamentoPixPassageiroStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => statusSchema.parse(data))
  .handler(async ({ context, data }): Promise<PagamentoPixTelaSnapshot> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: passageiro, error: passageiroError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    if (passageiroError || !passageiro) throw new Error("Pagamento Pix não encontrado.");

    const { data: corrida, error: corridaError } = await supabaseAdmin
      .from("corridas")
      .select("id, passageiro_id, forma_pagamento, status")
      .eq("id", data.rideId)
      .maybeSingle();

    if (
      corridaError ||
      !corrida ||
      corrida.passageiro_id !== passageiro.id ||
      corrida.forma_pagamento !== "pix"
    ) {
      throw new Error("Pagamento Pix não encontrado.");
    }

    const { data: pagamento, error: pagamentoError } = await supabaseAdmin
      .from("pagamentos")
      .select("id, valor_total, status")
      .eq("corrida_id", corrida.id)
      .eq("meio", "pix")
      .maybeSingle();

    if (pagamentoError || !pagamento) throw new Error("Pagamento Pix não encontrado.");

    // A tabela Pix já existe no banco real, mas os tipos gerados do projeto ainda não a incluem.
    // O cast fica limitado a esta consulta server-side até a regeneração oficial dos tipos.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tentativaRows, error: tentativaError } = await (supabaseAdmin as any)
      .from("pagamentos_pix_tentativas")
      .select("estado_interno, provider_status, pix_copia_cola, expires_at, created_at")
      .eq("pagamento_id", pagamento.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (tentativaError) throw new Error("Não foi possível atualizar o pagamento Pix.");

    const tentativa =
      Array.isArray(tentativaRows) && tentativaRows.length > 0
        ? (tentativaRows[0] as Record<string, unknown>)
        : null;

    const nowMs = Date.now();
    const serverNow = new Date(nowMs).toISOString();
    const timeoutSeconds = getPixPaymentTimeoutSeconds(process.env["PIX_PAYMENT_TIMEOUT_SECONDS"]);

    const derived = derivarEstadoPagamentoPix(
      {
        pagamentoStatus: String(pagamento.status),
        corridaStatus: String(corrida.status),
        tentativaEstado:
          tentativa && typeof tentativa["estado_interno"] === "string"
            ? tentativa["estado_interno"]
            : null,
        providerStatus:
          tentativa && typeof tentativa["provider_status"] === "string"
            ? tentativa["provider_status"]
            : null,
        pixCopiaCola:
          tentativa && typeof tentativa["pix_copia_cola"] === "string"
            ? tentativa["pix_copia_cola"]
            : null,
        tentativaCreatedAt:
          tentativa && typeof tentativa["created_at"] === "string" ? tentativa["created_at"] : null,
        providerExpiresAt:
          tentativa && typeof tentativa["expires_at"] === "string" ? tentativa["expires_at"] : null,
      },
      nowMs,
      timeoutSeconds,
    );

    const pixCopiaCola =
      derived.status === "aguardando" || derived.status === "analisando"
        ? tentativa && typeof tentativa["pix_copia_cola"] === "string"
          ? tentativa["pix_copia_cola"]
          : null
        : null;

    return Object.freeze({
      status: derived.status,
      valor: Number(pagamento.valor_total),
      pixCopiaCola,
      deadlineAt: derived.deadlineAt,
      remainingSeconds: remainingSeconds(derived.deadlineAt, nowMs),
      serverNow,
      podeAcompanhar: pagamento.status === "pago",
    });
  });
