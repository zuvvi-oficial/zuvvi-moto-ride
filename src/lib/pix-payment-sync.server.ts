import {
  garantirAccessTokenMotorista,
  type PixCredentialSnapshot,
  type PixTokenRefreshDependencies,
} from "./pagamento.server";

const OAUTH_REDIRECT_URI =
  "https://zuvvi-moto-ride.lovable.app/motorista/mercadopago-callback";
const ENCRYPTION_VERSION = 1;

export type PixPaymentSyncResult = "pendente" | "pago" | "falhou" | "estornado" | null;

type SyncInput = Readonly<{
  rideId: string;
  expectedPassageiroId?: string;
  expectedMotoristaId?: string;
}>;

function requireEnvironment(name: string): string {
  const value = process.env[name];
  if (!value || value !== value.trim()) {
    throw new Error("Não foi possível confirmar o pagamento Pix.");
  }
  return value;
}

function readCredentialRow(data: unknown): PixCredentialSnapshot | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  if (data.length !== 1 || typeof data[0] !== "object" || data[0] === null) {
    throw new Error("Não foi possível confirmar o pagamento Pix.");
  }

  const row = data[0] as Record<string, unknown>;
  if (
    typeof row["motorista_id"] !== "string" ||
    typeof row["mercadopago_user_id"] !== "string" ||
    typeof row["access_token_encrypted"] !== "string" ||
    typeof row["refresh_token_encrypted"] !== "string" ||
    typeof row["expires_at"] !== "string" ||
    typeof row["connection_status"] !== "string" ||
    !Number.isInteger(row["encryption_version"])
  ) {
    throw new Error("Não foi possível confirmar o pagamento Pix.");
  }

  return Object.freeze({
    motoristaId: row["motorista_id"],
    mercadoPagoUserId: row["mercadopago_user_id"],
    encryptedAccessToken: row["access_token_encrypted"],
    encryptedRefreshToken: row["refresh_token_encrypted"],
    encryptionVersion: row["encryption_version"] as number,
    expiresAt: row["expires_at"],
    connectionStatus: row["connection_status"],
    revokedAt: typeof row["revoked_at"] === "string" ? row["revoked_at"] : null,
    ...(typeof row["scope"] === "string" ? { scope: row["scope"] } : {}),
    ...(typeof row["token_type"] === "string" ? { tokenType: row["token_type"] } : {}),
  });
}

async function createRefreshDependencies(
  supabaseAdmin: any,
): Promise<PixTokenRefreshDependencies> {
  const [{ decryptOAuthSecret, encryptOAuthSecret }, { createMercadoPagoOAuthClient }] =
    await Promise.all([
      import("./pix-oauth-crypto.server"),
      import("./pix-mercadopago-oauth.server"),
    ]);

  const oauthClient = createMercadoPagoOAuthClient({
    clientId: requireEnvironment("MERCADOPAGO_CLIENT_ID"),
    clientSecret: requireEnvironment("MERCADOPAGO_CLIENT_SECRET"),
    redirectUri: OAUTH_REDIRECT_URI,
  });

  return {
    decryptSecret: decryptOAuthSecret,
    encryptSecret: encryptOAuthSecret,
    refreshAccessToken: (refreshToken) => oauthClient.refreshAccessToken(refreshToken),
    async persistRefreshedCredentials(input) {
      const { error } = await supabaseAdmin.rpc("pix_oauth_credentials_upsert", {
        _motorista_id: input.motoristaId,
        _mercadopago_user_id: input.mercadoPagoUserId,
        _access_token_encrypted: input.encryptedAccessToken,
        _refresh_token_encrypted: input.encryptedRefreshToken,
        _encryption_version: input.encryptionVersion,
        _expires_at: input.expiresAt,
        _scope: input.scope ?? null,
        _token_type: input.tokenType ?? null,
      });
      if (error) throw new Error("Não foi possível confirmar o pagamento Pix.");
    },
  };
}

async function getDriverAccessToken(
  supabaseAdmin: any,
  motoristaId: string,
  mercadoPagoUserId: string,
): Promise<string> {
  const { data: credentialRows, error: credentialError } = await supabaseAdmin.rpc(
    "pix_oauth_credentials_get",
    { _motorista_id: motoristaId },
  );
  if (credentialError) throw new Error("Não foi possível confirmar o pagamento Pix.");

  const credential = readCredentialRow(credentialRows);
  const dependencies = await createRefreshDependencies(supabaseAdmin);

  return garantirAccessTokenMotorista(
    credential,
    motoristaId,
    mercadoPagoUserId,
    requireEnvironment("PIX_OAUTH_ENCRYPTION_KEY"),
    dependencies,
  );
}

function sameCurrencyAmount(actual: unknown, expected: number): boolean {
  const parsed = Number(actual);
  return (
    Number.isFinite(parsed) &&
    Math.round(parsed * 100) === Math.round(Number(expected) * 100)
  );
}

export async function sincronizarPagamentoPixComMercadoPago(
  input: SyncInput,
): Promise<PixPaymentSyncResult> {
  if (!input.expectedPassageiroId && !input.expectedMotoristaId) {
    throw new Error("Não foi possível confirmar o pagamento Pix.");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: corrida, error: corridaError } = await supabaseAdmin
    .from("corridas")
    .select("id, passageiro_id, motorista_id, forma_pagamento")
    .eq("id", input.rideId)
    .maybeSingle();

  if (
    corridaError ||
    !corrida ||
    corrida.forma_pagamento !== "pix" ||
    !corrida.motorista_id ||
    (input.expectedPassageiroId && corrida.passageiro_id !== input.expectedPassageiroId) ||
    (input.expectedMotoristaId && corrida.motorista_id !== input.expectedMotoristaId)
  ) {
    throw new Error("Não foi possível confirmar o pagamento Pix.");
  }

  const { data: pagamento, error: pagamentoError } = await supabaseAdmin
    .from("pagamentos")
    .select("id, status, valor_total, id_transacao_mercadopago")
    .eq("corrida_id", corrida.id)
    .eq("meio", "pix")
    .maybeSingle();

  if (pagamentoError || !pagamento) {
    throw new Error("Não foi possível confirmar o pagamento Pix.");
  }

  if (pagamento.status === "pago") return "pago";
  if (pagamento.status === "falhou") return "falhou";
  if (pagamento.status === "estornado") return "estornado";

  const { data: tentativaRows, error: tentativaError } = await (supabaseAdmin as any)
    .from("pagamentos_pix_tentativas")
    .select(
      "id, motorista_id, mercadopago_payment_id, idempotency_key, estado_interno, valor_total",
    )
    .eq("pagamento_id", pagamento.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (tentativaError || !Array.isArray(tentativaRows) || tentativaRows.length === 0) {
    return null;
  }

  const tentativa = tentativaRows[0] as Record<string, unknown>;
  const tentativaId = typeof tentativa["id"] === "string" ? tentativa["id"] : null;
  const paymentId =
    typeof tentativa["mercadopago_payment_id"] === "string"
      ? tentativa["mercadopago_payment_id"]
      : typeof pagamento.id_transacao_mercadopago === "string"
        ? pagamento.id_transacao_mercadopago
        : null;
  const externalReference =
    typeof tentativa["idempotency_key"] === "string" ? tentativa["idempotency_key"] : null;

  if (!tentativaId || !paymentId || !externalReference) return "pendente";
  if (tentativa["motorista_id"] !== corrida.motorista_id) {
    throw new Error("Não foi possível confirmar o pagamento Pix.");
  }

  const { data: motorista, error: motoristaError } = await supabaseAdmin
    .from("motoristas")
    .select("conta_mercado_pago_id")
    .eq("id", corrida.motorista_id)
    .maybeSingle();

  if (motoristaError || !motorista?.conta_mercado_pago_id) {
    throw new Error("Não foi possível confirmar o pagamento Pix.");
  }

  const accessToken = await getDriverAccessToken(
    supabaseAdmin,
    corrida.motorista_id,
    motorista.conta_mercado_pago_id,
  );

  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) return "pendente";

  const provider = (await response.json()) as Record<string, unknown>;
  const providerId = provider["id"] != null ? String(provider["id"]) : null;
  const providerCollectorId =
    provider["collector_id"] != null ? String(provider["collector_id"]) : null;
  const providerExternalReference =
    typeof provider["external_reference"] === "string" ? provider["external_reference"] : null;

  if (
    providerId !== paymentId ||
    providerCollectorId !== motorista.conta_mercado_pago_id ||
    providerExternalReference !== externalReference ||
    provider["payment_method_id"] !== "pix" ||
    provider["currency_id"] !== "BRL" ||
    !sameCurrencyAmount(provider["transaction_amount"], Number(pagamento.valor_total))
  ) {
    throw new Error("Não foi possível confirmar o pagamento Pix.");
  }

  const providerStatus =
    typeof provider["status"] === "string" ? provider["status"].trim().toLowerCase() : null;
  const providerStatusDetail =
    typeof provider["status_detail"] === "string" ? provider["status_detail"] : null;

  if (!providerStatus) return "pendente";

  const { data: projected, error: projectionError } = await (supabaseAdmin as any).rpc(
    "pix_payment_status_project",
    {
      _tentativa_id: tentativaId,
      _mercadopago_payment_id: paymentId,
      _provider_status: providerStatus,
      _provider_status_detail: providerStatusDetail,
    },
  );

  if (projectionError) throw new Error("Não foi possível confirmar o pagamento Pix.");
  if (projected === "pago" || projected === "falhou" || projected === "estornado") {
    return projected;
  }
  return "pendente";
}
