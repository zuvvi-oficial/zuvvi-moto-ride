import { MercadoPagoConfig, Payment } from "mercadopago";
import {
  getDriverAccessToken,
  getRideContext,
  type RideContext,
} from "./pix-passageiro-auth.server";
import {
  EXPIRATION_DETAIL,
  cancelProviderPending,
  createOrResumeCharge,
  getActiveAttempt,
  getLatestAttempt,
  localExpiresAt,
  markExpiredRegenerable,
  projectProviderStatus,
  type PixChargeResult,
} from "./pix-passageiro-charge.server";

const GENERIC_ERROR = "Não foi possível processar o pagamento Pix. Tente novamente.";

export type PixPassengerStatus =
  | { state: "awaiting_charge" }
  | { state: "pending"; expiresAt: string; qrCode: string; qrCodeBase64: string }
  | { state: "confirmed" }
  | { state: "expired" }
  | { state: "failed"; message: string };

export type PixGateResult = Readonly<{
  isPix: boolean;
  liberado: boolean;
  cancelada: boolean;
}>;

async function statusForContext(ctx: RideContext): Promise<PixPassengerStatus> {
  if (ctx.formaPagamento !== "pix") return { state: "confirmed" };
  if (ctx.pagamentoStatus === "pago") return { state: "confirmed" };
  if (ctx.status === "cancelada") return { state: "failed", message: "Esta corrida foi cancelada." };
  if (!ctx.pagamentoId || !ctx.motoristaId) return { state: "awaiting_charge" };

  const active = await getActiveAttempt(ctx.pagamentoId);
  if (!active) {
    const latest = await getLatestAttempt(ctx.pagamentoId);
    if (latest?.provider_status_detail === EXPIRATION_DETAIL) return { state: "expired" };
    if (latest?.estado_interno === "falhou") {
      return { state: "failed", message: "A cobrança Pix não foi aprovada." };
    }
    return { state: "awaiting_charge" };
  }

  if (active.estado_interno === "pago") return { state: "confirmed" };
  if (active.estado_interno === "criando" || !active.mercadopago_payment_id) {
    return { state: "awaiting_charge" };
  }

  const paymentId = active.mercadopago_payment_id;
  const accessToken = await getDriverAccessToken(ctx.motoristaId);
  const paymentClient = new Payment(new MercadoPagoConfig({ accessToken }));
  const provider = await paymentClient.get({ id: paymentId });
  if (provider.id == null || String(provider.id) !== paymentId || provider.payment_method_id !== "pix") {
    throw new Error(GENERIC_ERROR);
  }

  if (provider.status === "approved") {
    await projectProviderStatus(active, paymentId, provider);
    return { state: "confirmed" };
  }

  if (provider.status === "rejected" || provider.status === "cancelled") {
    await projectProviderStatus(active, paymentId, provider);
    return { state: "failed", message: "A cobrança Pix não foi aprovada." };
  }

  const expiresAt = localExpiresAt(
    active,
    provider.date_created ?? null,
    provider.date_of_expiration ?? active.expires_at,
  );
  if (Date.now() >= Date.parse(expiresAt)) {
    const cancellation = await cancelProviderPending(accessToken, paymentId);
    if (cancellation === "approved") {
      const approved = await paymentClient.get({ id: paymentId });
      await projectProviderStatus(active, paymentId, approved);
      return { state: "confirmed" };
    }
    await markExpiredRegenerable(active, paymentId);
    return { state: "expired" };
  }

  const qrCode = provider.point_of_interaction?.transaction_data?.qr_code ?? active.pix_copia_cola;
  const qrCodeBase64 = provider.point_of_interaction?.transaction_data?.qr_code_base64 ?? null;
  if (!qrCode || !qrCodeBase64) throw new Error(GENERIC_ERROR);
  return { state: "pending", expiresAt, qrCode, qrCodeBase64 };
}

export async function getPixGateServer(rideId: string, authUserId: string): Promise<PixGateResult> {
  const ctx = await getRideContext(rideId, authUserId);
  if (ctx.formaPagamento !== "pix") return { isPix: false, liberado: true, cancelada: false };
  return {
    isPix: true,
    liberado: ctx.pagamentoStatus === "pago",
    cancelada: ctx.status === "cancelada",
  };
}

export async function criarCobrancaPixPassageiroServer(
  rideId: string,
  authUserId: string,
): Promise<PixChargeResult> {
  return createOrResumeCharge(await getRideContext(rideId, authUserId));
}

export async function consultarStatusPixPassageiroServer(
  rideId: string,
  authUserId: string,
): Promise<PixPassengerStatus> {
  const ctx = await getRideContext(rideId, authUserId);
  if (ctx.formaPagamento !== "pix") throw new Error("Esta corrida não utiliza Pix.");
  return statusForContext(ctx);
}

export async function regenerarCobrancaPixPassageiroServer(
  rideId: string,
  authUserId: string,
): Promise<PixChargeResult> {
  const ctx = await getRideContext(rideId, authUserId);
  const status = await statusForContext(ctx);
  if (status.state === "confirmed") throw new Error("O pagamento já foi confirmado.");
  if (status.state !== "expired") throw new Error("Esta cobrança Pix ainda não pode ser regenerada.");
  return createOrResumeCharge(await getRideContext(rideId, authUserId));
}

export async function cancelarCorridaPixPassageiroServer(
  rideId: string,
  authUserId: string,
): Promise<Readonly<{ cancelled: boolean; paid: boolean }>> {
  let ctx = await getRideContext(rideId, authUserId);
  if (ctx.formaPagamento !== "pix") throw new Error("Esta corrida não utiliza Pix.");
  if (ctx.pagamentoStatus === "pago") return { cancelled: false, paid: true };
  if (ctx.status === "cancelada") return { cancelled: true, paid: false };
  if (!["aceita", "aguardando_pagamento"].includes(ctx.status)) {
    throw new Error("Esta corrida não pode mais ser cancelada nesta etapa.");
  }

  const currentStatus = await statusForContext(ctx);
  if (currentStatus.state === "confirmed") return { cancelled: false, paid: true };
  ctx = await getRideContext(rideId, authUserId);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  let attempt = ctx.pagamentoId ? await getActiveAttempt(ctx.pagamentoId) : null;

  // "criando" pode ser uma resposta de rede perdida. Resolver com a mesma idempotency key
  // antes de cancelar evita deixar uma cobrança externa órfã.
  if (attempt?.estado_interno === "criando") {
    await createOrResumeCharge(ctx);
    ctx = await getRideContext(rideId, authUserId);
    if (ctx.pagamentoStatus === "pago") return { cancelled: false, paid: true };
    attempt = ctx.pagamentoId ? await getActiveAttempt(ctx.pagamentoId) : null;
  }

  if (attempt?.estado_interno === "pago") return { cancelled: false, paid: true };

  if (attempt?.estado_interno === "pendente" && attempt.mercadopago_payment_id && ctx.motoristaId) {
    const accessToken = await getDriverAccessToken(ctx.motoristaId);
    const result = await cancelProviderPending(accessToken, attempt.mercadopago_payment_id);
    if (result === "approved") {
      const provider = await new Payment(new MercadoPagoConfig({ accessToken })).get({
        id: attempt.mercadopago_payment_id,
      });
      await projectProviderStatus(attempt, attempt.mercadopago_payment_id, provider);
      return { cancelled: false, paid: true };
    }

    const now = new Date().toISOString();
    const { error: attemptError } = await db
      .from("pagamentos_pix_tentativas")
      .update({
        estado_interno: "falhou",
        provider_status: "cancelled",
        provider_status_detail: "cancelada_pelo_passageiro",
        failed_at: now,
        updated_at: now,
      })
      .eq("id", attempt.id)
      .eq("estado_interno", "pendente");
    if (attemptError) throw new Error(GENERIC_ERROR);
  }

  // Última verificação antes das atualizações locais. Uma cobrança que apareceu em outra aba
  // precisa ser resolvida no provedor; se houver dúvida, falhamos fechado e não cancelamos a corrida.
  const lateAttempt = ctx.pagamentoId ? await getActiveAttempt(ctx.pagamentoId) : null;
  if (lateAttempt && lateAttempt.id !== attempt?.id) {
    throw new Error("O Pix está sendo atualizado. Tente cancelar novamente em instantes.");
  }

  const now = new Date().toISOString();
  if (ctx.pagamentoId) {
    const { error: paymentError } = await db
      .from("pagamentos")
      .update({ status: "falhou", updated_at: now })
      .eq("id", ctx.pagamentoId)
      .eq("status", "pendente");
    if (paymentError) throw new Error(GENERIC_ERROR);
  }

  const { data: cancelledRide, error: rideError } = await db
    .from("corridas")
    .update({
      status: "cancelada",
      cancelado_por: "passageiro",
      motivo_cancelamento: "pagamento_pix_cancelado_pelo_passageiro",
      data_cancelamento: now,
      updated_at: now,
    })
    .eq("id", ctx.corridaId)
    .eq("passageiro_id", ctx.usuarioId)
    .in("status", ["aceita", "aguardando_pagamento"])
    .select("id")
    .maybeSingle();
  if (rideError || !cancelledRide) throw new Error(GENERIC_ERROR);

  if (ctx.motoristaId) {
    const { data: activeRides, error: activeError } = await db
      .from("corridas")
      .select("id")
      .eq("motorista_id", ctx.motoristaId)
      .in("status", ["aceita", "aguardando_pagamento", "motorista_a_caminho", "motorista_chegou", "em_andamento"])
      .limit(1);
    if (!activeError && (!activeRides || activeRides.length === 0)) {
      await db
        .from("motoristas")
        .update({ is_disponivel: true, updated_at: now })
        .eq("id", ctx.motoristaId)
        .eq("status_aprovacao", "aprovado");
    }
  }

  return { cancelled: true, paid: false };
}
