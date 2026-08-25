import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const PIX_PAYMENT_TIMEOUT_MS = 5 * 60 * 1000;

const consultarPagamentoPixSchema = z.object({
  rideId: z.string().uuid(),
});

const FAILED_MERCADO_PAGO_STATUSES = new Set(["cancelled", "charged_back", "rejected", "refunded"]);

const GENERIC_ERROR = "Não foi possível consultar o pagamento Pix. Tente novamente.";

export type PixPaymentStatus =
  | {
      state: "awaiting_charge";
    }
  | {
      state: "pending";
      expiresAt: string;
      qrCode: string;
      qrCodeBase64: string;
    }
  | {
      state: "confirmed";
    }
  | {
      state: "expired";
    }
  | {
      state: "failed";
    };

type PixOAuthCredentialRow = {
  access_token_encrypted: string;
  connection_status: string;
  encryption_version: number;
  expires_at: string;
  mercadopago_user_id: string;
  motorista_id: string;
  revoked_at: string | null;
};

export function getPixPaymentExpiresAt(
  dateCreated: string | undefined,
  providerExpiration: string | undefined,
  fallbackCreatedAt: string,
) {
  const fallbackTime = new Date(fallbackCreatedAt).getTime();
  const providerCreatedTime = dateCreated ? new Date(dateCreated).getTime() : Number.NaN;
  const createdTime = Number.isFinite(providerCreatedTime) ? providerCreatedTime : fallbackTime;
  const zuvviExpirationTime = createdTime + PIX_PAYMENT_TIMEOUT_MS;
  const providerExpirationTime = providerExpiration
    ? new Date(providerExpiration).getTime()
    : Number.NaN;

  const expiresAt = Number.isFinite(providerExpirationTime)
    ? Math.min(zuvviExpirationTime, providerExpirationTime)
    : zuvviExpirationTime;

  return new Date(expiresAt).toISOString();
}

export function classifyMercadoPagoPixStatus(status: string | undefined) {
  if (status === "approved") return "confirmed" as const;
  if (status && FAILED_MERCADO_PAGO_STATUSES.has(status)) return "failed" as const;
  return "pending" as const;
}

function readActiveCredential(
  data: unknown,
  motoristaId: string,
  mercadoPagoUserId: string | null,
): PixOAuthCredentialRow {
  if (!Array.isArray(data) || data.length !== 1 || !mercadoPagoUserId) {
    throw new Error(GENERIC_ERROR);
  }

  const row = data[0] as Record<string, unknown>;
  if (
    row["motorista_id"] !== motoristaId ||
    row["mercadopago_user_id"] !== mercadoPagoUserId ||
    row["connection_status"] !== "active" ||
    row["revoked_at"] !== null ||
    row["encryption_version"] !== 1 ||
    typeof row["access_token_encrypted"] !== "string" ||
    typeof row["expires_at"] !== "string" ||
    Date.parse(row["expires_at"]) <= Date.now()
  ) {
    throw new Error(GENERIC_ERROR);
  }

  return row as PixOAuthCredentialRow;
}

async function getMotoristaAccessToken(motoristaId: string, mercadoPagoUserId: string | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const encryptionKey = process.env["PIX_OAUTH_ENCRYPTION_KEY"];
  if (!encryptionKey || encryptionKey !== encryptionKey.trim()) {
    throw new Error(GENERIC_ERROR);
  }

  const { data, error } = await supabaseAdmin.rpc(
    "pix_oauth_credentials_get" as never,
    { _motorista_id: motoristaId } as never,
  );
  if (error) throw new Error(GENERIC_ERROR);

  const credential = readActiveCredential(data, motoristaId, mercadoPagoUserId);
  const { decryptOAuthSecret } = await import("./pix-oauth-crypto.server");
  return decryptOAuthSecret(credential.access_token_encrypted, encryptionKey);
}

export const consultarStatusPagamentoPix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => consultarPagamentoPixSchema.parse(data))
  .handler(async ({ data, context }): Promise<PixPaymentStatus> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: usuario, error: usuarioError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    if (usuarioError || !usuario) throw new Error(GENERIC_ERROR);

    const { data: corrida, error: corridaError } = await supabaseAdmin
      .from("corridas")
      .select("id, passageiro_id, motorista_id, forma_pagamento")
      .eq("id", data.rideId)
      .eq("passageiro_id", usuario.id)
      .maybeSingle();

    if (corridaError || !corrida || corrida.forma_pagamento !== "pix" || !corrida.motorista_id) {
      throw new Error(GENERIC_ERROR);
    }

    const { data: pagamento, error: pagamentoError } = await supabaseAdmin
      .from("pagamentos")
      .select("id, status, created_at, id_transacao_mercadopago")
      .eq("corrida_id", corrida.id)
      .eq("meio", "pix")
      .maybeSingle();

    if (pagamentoError || !pagamento) throw new Error(GENERIC_ERROR);
    if (pagamento.status === "pago") return { state: "confirmed" };
    if (pagamento.status === "falhou" || pagamento.status === "estornado") {
      return { state: "failed" };
    }

    const { data: tentativaData, error: tentativaError } = await supabaseAdmin
      .from("pagamentos_pix_tentativas" as never)
      .select(
        "id, estado_interno, provider_status, pix_copia_cola, expires_at, created_at, mercadopago_payment_id",
      )
      .eq("pagamento_id", pagamento.id)
      .maybeSingle();

    const tentativa = tentativaData as null | {
      created_at: string;
      estado_interno: string;
      expires_at: string | null;
      id: string;
      mercadopago_payment_id: string | null;
      pix_copia_cola: string | null;
      provider_status: string | null;
    };

    if (tentativaError) throw new Error(GENERIC_ERROR);
    if (tentativa?.estado_interno === "falhou" || tentativa?.estado_interno === "estornado") {
      return { state: "failed" };
    }

    if (!pagamento.id_transacao_mercadopago || !tentativa?.mercadopago_payment_id) {
      return { state: "awaiting_charge" };
    }

    if (pagamento.id_transacao_mercadopago !== tentativa.mercadopago_payment_id) {
      throw new Error(GENERIC_ERROR);
    }

    const { data: motorista, error: motoristaError } = await supabaseAdmin
      .from("motoristas")
      .select("conta_mercado_pago_id")
      .eq("id", corrida.motorista_id)
      .maybeSingle();
    if (motoristaError || !motorista) throw new Error(GENERIC_ERROR);

    try {
      const accessToken = await getMotoristaAccessToken(
        corrida.motorista_id,
        motorista.conta_mercado_pago_id,
      );
      const { MercadoPagoConfig, Payment } = await import("mercadopago");
      const client = new MercadoPagoConfig({ accessToken });
      const paymentClient = new Payment(client);
      const providerPayment = await paymentClient.get({
        id: pagamento.id_transacao_mercadopago,
      });

      if (
        providerPayment.id == null ||
        String(providerPayment.id) !== pagamento.id_transacao_mercadopago ||
        providerPayment.payment_method_id !== "pix"
      ) {
        throw new Error(GENERIC_ERROR);
      }

      const providerState = classifyMercadoPagoPixStatus(providerPayment.status);

      if (providerState === "confirmed") {
        const approvedAt = providerPayment.date_approved ?? new Date().toISOString();
        const { error: attemptUpdateError } = await supabaseAdmin
          .from("pagamentos_pix_tentativas" as never)
          .update({
            estado_interno: "pago",
            provider_status: providerPayment.status ?? "approved",
            provider_status_detail: providerPayment.status_detail ?? null,
            approved_at: approvedAt,
            updated_at: new Date().toISOString(),
          } as never)
          .eq("id", tentativa.id)
          .in("estado_interno", ["pendente", "pago"]);

        if (attemptUpdateError) throw new Error(GENERIC_ERROR);

        const { error: paymentUpdateError } = await supabaseAdmin
          .from("pagamentos")
          .update({ status: "pago" })
          .eq("id", pagamento.id)
          .eq("status", "pendente");

        if (paymentUpdateError) throw new Error(GENERIC_ERROR);

        const { data: persistedPayment, error: persistedPaymentError } = await supabaseAdmin
          .from("pagamentos")
          .select("status")
          .eq("id", pagamento.id)
          .maybeSingle();

        if (persistedPaymentError || persistedPayment?.status !== "pago") {
          throw new Error(GENERIC_ERROR);
        }

        return { state: "confirmed" };
      }

      if (providerState === "failed") {
        const isRefund =
          providerPayment.status === "refunded" || providerPayment.status === "charged_back";
        const nextStatus = isRefund ? "estornado" : "falhou";
        const timestamp = new Date().toISOString();

        const { error: attemptUpdateError } = await supabaseAdmin
          .from("pagamentos_pix_tentativas" as never)
          .update({
            estado_interno: nextStatus,
            provider_status: providerPayment.status ?? null,
            provider_status_detail: providerPayment.status_detail ?? null,
            ...(isRefund ? { refunded_at: timestamp } : { failed_at: timestamp }),
            updated_at: timestamp,
          } as never)
          .eq("id", tentativa.id);

        const { error: paymentUpdateError } = await supabaseAdmin
          .from("pagamentos")
          .update({ status: nextStatus })
          .eq("id", pagamento.id)
          .eq("status", "pendente");

        if (attemptUpdateError || paymentUpdateError) throw new Error(GENERIC_ERROR);
        return { state: "failed" };
      }

      const expiresAt = getPixPaymentExpiresAt(
        providerPayment.date_created,
        providerPayment.date_of_expiration ?? tentativa.expires_at ?? undefined,
        tentativa.created_at ?? pagamento.created_at,
      );

      if (Date.now() >= new Date(expiresAt).getTime()) return { state: "expired" };

      const qrCode =
        providerPayment.point_of_interaction?.transaction_data?.qr_code ?? tentativa.pix_copia_cola;
      const qrCodeBase64 = providerPayment.point_of_interaction?.transaction_data?.qr_code_base64;

      if (!qrCode || !qrCodeBase64) throw new Error(GENERIC_ERROR);

      return {
        state: "pending",
        expiresAt,
        qrCode,
        qrCodeBase64,
      };
    } catch (error) {
      console.error("[Pagamento Pix] Falha ao consultar a cobrança OAuth:", error);
      throw new Error(GENERIC_ERROR);
    }
  });
