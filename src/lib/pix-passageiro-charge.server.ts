import { MercadoPagoConfig, Payment } from "mercadopago";
import {
  getDriverAccessToken,
  getRideContext,
  type RideContext,
} from "./pix-passageiro-auth.server";

export const PIX_SLA_MS = 5 * 60 * 1000;
export const EXPIRATION_DETAIL = "zuvvi_sla_expirado_regeneravel";
const GENERIC_ERROR = "Não foi possível processar o pagamento Pix. Tente novamente.";

export type PixChargeResult = Readonly<{
  paymentId: string;
  qrCode: string;
  qrCodeBase64: string;
}>;

export type PixAttempt = Readonly<{
  id: string;
  pagamento_id: string;
  motorista_id: string;
  mercadopago_payment_id: string | null;
  idempotency_key: string;
  estado_interno: string;
  provider_status: string | null;
  provider_status_detail: string | null;
  pix_copia_cola: string | null;
  expires_at: string | null;
  created_at: string;
}>;

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function getActiveAttempt(pagamentoId: string): Promise<PixAttempt | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data, error } = await db
    .from("pagamentos_pix_tentativas")
    .select("id, pagamento_id, motorista_id, mercadopago_payment_id, idempotency_key, estado_interno, provider_status, provider_status_detail, pix_copia_cola, expires_at, created_at")
    .eq("pagamento_id", pagamentoId)
    .in("estado_interno", ["criando", "pendente", "pago"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(GENERIC_ERROR);
  return (data as PixAttempt | null) ?? null;
}

export async function getLatestAttempt(pagamentoId: string): Promise<PixAttempt | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data, error } = await db
    .from("pagamentos_pix_tentativas")
    .select("id, pagamento_id, motorista_id, mercadopago_payment_id, idempotency_key, estado_interno, provider_status, provider_status_detail, pix_copia_cola, expires_at, created_at")
    .eq("pagamento_id", pagamentoId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(GENERIC_ERROR);
  return (data as PixAttempt | null) ?? null;
}

function buildPixBody(input: {
  valorTotal: number;
  valorComissao: number;
  passageiroId: string;
  nome: string | null;
  email: string | null;
}) {
  const valorTotal = roundCurrency(input.valorTotal);
  const valorComissao = roundCurrency(input.valorComissao);
  if (
    !Number.isFinite(valorTotal) ||
    valorTotal <= 0 ||
    !Number.isFinite(valorComissao) ||
    valorComissao < 0 ||
    valorComissao > valorTotal
  ) {
    throw new Error(GENERIC_ERROR);
  }

  return {
    transaction_amount: valorTotal,
    application_fee: valorComissao,
    description: "Corrida Zuvvi",
    payment_method_id: "pix",
    payer: {
      email: input.email ?? `passageiro+${input.passageiroId}@zuvvi.app`,
      first_name: input.nome ?? "Passageiro",
    },
  } as const;
}

async function ensureCreatingAttempt(ctx: RideContext): Promise<PixAttempt> {
  if (!ctx.pagamentoId || !ctx.motoristaId || ctx.valorTotal == null || ctx.valorComissao == null) {
    throw new Error(GENERIC_ERROR);
  }

  const active = await getActiveAttempt(ctx.pagamentoId);
  if (active) return active;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const latest = await getLatestAttempt(ctx.pagamentoId);

  if (
    latest?.estado_interno === "falhou" &&
    latest.provider_status_detail === EXPIRATION_DETAIL &&
    latest.mercadopago_payment_id &&
    ctx.mercadopagoPaymentId === latest.mercadopago_payment_id
  ) {
    const { error: cleanupError } = await db
      .from("pagamentos")
      .update({ id_transacao_mercadopago: null, updated_at: new Date().toISOString() })
      .eq("id", ctx.pagamentoId)
      .eq("status", "pendente")
      .eq("id_transacao_mercadopago", latest.mercadopago_payment_id);
    if (cleanupError) throw new Error(GENERIC_ERROR);
  }

  if (!latest) {
    const { data: claimRows, error: claimError } = await db.rpc("pix_charge_attempt_claim", {
      _corrida_id: ctx.corridaId,
      _motorista_id: ctx.motoristaId,
    });
    if (!claimError && Array.isArray(claimRows) && claimRows.length === 1) {
      const claimed = await getActiveAttempt(ctx.pagamentoId);
      if (claimed) return claimed;
    }
    if (
      claimError &&
      claimError.code !== "23505" &&
      !String(claimError.message ?? "").includes("ETAPA4_COBRANCA_JA_REQUISITADA")
    ) {
      throw new Error(GENERIC_ERROR);
    }
  }

  const { data: inserted, error: insertError } = await db
    .from("pagamentos_pix_tentativas")
    .insert({
      pagamento_id: ctx.pagamentoId,
      motorista_id: ctx.motoristaId,
      idempotency_key: `zuvvi-${crypto.randomUUID()}`,
      estado_interno: "criando",
      valor_total: ctx.valorTotal,
      valor_comissao: ctx.valorComissao,
    })
    .select("id, pagamento_id, motorista_id, mercadopago_payment_id, idempotency_key, estado_interno, provider_status, provider_status_detail, pix_copia_cola, expires_at, created_at")
    .maybeSingle();

  if (insertError) {
    if (insertError.code === "23505") {
      const raced = await getActiveAttempt(ctx.pagamentoId);
      if (raced) return raced;
    }
    throw new Error(GENERIC_ERROR);
  }
  if (!inserted) throw new Error(GENERIC_ERROR);
  return inserted as PixAttempt;
}

async function completeAttempt(attempt: PixAttempt, provider: any): Promise<PixChargeResult> {
  const paymentId = provider?.id != null ? String(provider.id) : null;
  const qrCode = provider?.point_of_interaction?.transaction_data?.qr_code ?? null;
  const qrCodeBase64 = provider?.point_of_interaction?.transaction_data?.qr_code_base64 ?? null;
  if (!paymentId || !qrCode || !qrCodeBase64) throw new Error(GENERIC_ERROR);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { error } = await db.rpc("pix_charge_attempt_complete", {
    _tentativa_id: attempt.id,
    _mercadopago_payment_id: paymentId,
    _provider_status: provider.status ?? "pending",
    _provider_status_detail: provider.status_detail ?? null,
    _pix_copia_cola: qrCode,
    _expires_at: provider.date_of_expiration ?? null,
  });
  if (error) throw new Error(GENERIC_ERROR);
  return { paymentId, qrCode, qrCodeBase64 };
}

export async function createOrResumeCharge(ctx: RideContext): Promise<PixChargeResult> {
  if (
    ctx.formaPagamento !== "pix" ||
    !ctx.motoristaId ||
    !ctx.pagamentoId ||
    ctx.pagamentoStatus !== "pendente" ||
    !["aceita", "aguardando_pagamento"].includes(ctx.status)
  ) {
    throw new Error(GENERIC_ERROR);
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data: passageiro, error: passageiroError } = await db
    .from("usuarios")
    .select("id, nome, email")
    .eq("id", ctx.usuarioId)
    .maybeSingle();
  if (passageiroError || !passageiro) throw new Error(GENERIC_ERROR);

  const attempt = await ensureCreatingAttempt(ctx);
  const accessToken = await getDriverAccessToken(ctx.motoristaId);
  const paymentClient = new Payment(new MercadoPagoConfig({ accessToken }));

  if (attempt.estado_interno === "pendente" && attempt.mercadopago_payment_id) {
    const existing = await paymentClient.get({ id: attempt.mercadopago_payment_id });
    const paymentId = existing.id != null ? String(existing.id) : null;
    const qrCode = existing.point_of_interaction?.transaction_data?.qr_code ?? attempt.pix_copia_cola;
    const qrCodeBase64 = existing.point_of_interaction?.transaction_data?.qr_code_base64 ?? null;
    if (!paymentId || !qrCode || !qrCodeBase64) throw new Error(GENERIC_ERROR);
    return { paymentId, qrCode, qrCodeBase64 };
  }

  if (attempt.estado_interno !== "criando") throw new Error(GENERIC_ERROR);

  const freshContext = await getRideContext(ctx.corridaId, ctx.authUserId);
  const freshAttempt = await getActiveAttempt(ctx.pagamentoId);
  if (
    freshContext.status !== ctx.status ||
    freshContext.pagamentoStatus !== "pendente" ||
    !freshAttempt ||
    freshAttempt.id !== attempt.id ||
    freshAttempt.estado_interno !== "criando"
  ) {
    throw new Error(GENERIC_ERROR);
  }

  // Em falha de rede, a tentativa continua "criando". A próxima chamada repete a criação
  // com a MESMA idempotency key, evitando cobrança duplicada no Mercado Pago.
  const provider = await paymentClient.create({
    body: buildPixBody({
      valorTotal: ctx.valorTotal ?? 0,
      valorComissao: ctx.valorComissao ?? 0,
      passageiroId: ctx.usuarioId,
      nome: passageiro.nome ?? null,
      email: passageiro.email ?? null,
    }),
    requestOptions: { idempotencyKey: attempt.idempotency_key },
  });
  return completeAttempt(attempt, provider);
}

export async function projectProviderStatus(
  attempt: PixAttempt,
  paymentId: string,
  provider: any,
): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data, error } = await db.rpc("pix_payment_status_project", {
    _tentativa_id: attempt.id,
    _mercadopago_payment_id: paymentId,
    _provider_status: provider.status ?? "pending",
    _provider_status_detail: provider.status_detail ?? null,
  });
  if (error) throw new Error(GENERIC_ERROR);
  return typeof data === "string" ? data : String(data ?? "");
}

export async function markExpiredRegenerable(attempt: PixAttempt, paymentId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const now = new Date().toISOString();

  const { error: attemptError } = await db
    .from("pagamentos_pix_tentativas")
    .update({
      estado_interno: "falhou",
      provider_status: "cancelled",
      provider_status_detail: EXPIRATION_DETAIL,
      failed_at: now,
      updated_at: now,
    })
    .eq("id", attempt.id)
    .eq("estado_interno", "pendente")
    .eq("mercadopago_payment_id", paymentId);
  if (attemptError) throw new Error(GENERIC_ERROR);

  const { error: paymentError } = await db
    .from("pagamentos")
    .update({ id_transacao_mercadopago: null, updated_at: now })
    .eq("id", attempt.pagamento_id)
    .eq("status", "pendente")
    .eq("id_transacao_mercadopago", paymentId);
  if (paymentError) throw new Error(GENERIC_ERROR);
}

export async function cancelProviderPending(
  accessToken: string,
  paymentId: string,
): Promise<"cancelled" | "approved"> {
  const paymentClient = new Payment(new MercadoPagoConfig({ accessToken }));
  const before = await paymentClient.get({ id: paymentId });
  if (before.status === "approved") return "approved";
  if (before.status === "cancelled") return "cancelled";
  if (!["pending", "in_process", "authorized"].includes(before.status ?? "")) {
    throw new Error(GENERIC_ERROR);
  }

  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "cancelled" }),
    },
  );

  if (response.ok) {
    const payload = (await response.json()) as { status?: string };
    if (payload.status === "approved") return "approved";
    if (payload.status === "cancelled") return "cancelled";
  }

  const after = await paymentClient.get({ id: paymentId });
  if (after.status === "approved") return "approved";
  if (after.status === "cancelled") return "cancelled";
  throw new Error(GENERIC_ERROR);
}

export function localExpiresAt(
  attempt: PixAttempt,
  providerCreatedAt?: string | null,
  providerExpiration?: string | null,
): string {
  const attemptCreatedAt = Date.parse(attempt.created_at);
  const providerCreated = providerCreatedAt ? Date.parse(providerCreatedAt) : Number.NaN;
  const createdAt = Number.isFinite(providerCreated) ? providerCreated : attemptCreatedAt;
  if (!Number.isFinite(createdAt)) throw new Error(GENERIC_ERROR);

  const localDeadline = createdAt + PIX_SLA_MS;
  const providerDeadline = providerExpiration ? Date.parse(providerExpiration) : Number.NaN;
  return new Date(
    Number.isFinite(providerDeadline) ? Math.min(localDeadline, providerDeadline) : localDeadline,
  ).toISOString();
}
