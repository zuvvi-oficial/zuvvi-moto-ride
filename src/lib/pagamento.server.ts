// Motor server-only da Etapa 4: cobrança Pix após aceite do motorista.
// A criação financeira atômica da Etapa 3 permanece intocada.
import { MercadoPagoConfig, Payment } from "mercadopago";
import {
  buscarPagamentoPixCanonico,
  falhaCriacaoMercadoPagoPermiteCompensacao,
  type PixCanonicalPayment,
} from "./pix-mercadopago-reconcile.server";

export type PixChargeResult = {
  paymentId: string;
  qrCode: string;
  qrCodeBase64: string;
};

export type PixCredentialSnapshot = Readonly<{
  motoristaId: string;
  mercadoPagoUserId: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  encryptionVersion: number;
  expiresAt: string;
  connectionStatus: string;
  revokedAt: string | null;
  scope?: string;
  tokenType?: string;
}>;

export type PixRefreshedTokenSet = Readonly<{
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  scope?: string;
  tokenType?: string;
}>;

export type PixTokenRefreshDependencies = Readonly<{
  now?: () => number;
  decryptSecret(envelope: string, encryptionKey: string): Promise<string>;
  encryptSecret(secret: string, encryptionKey: string): Promise<string>;
  refreshAccessToken(refreshToken: string): Promise<PixRefreshedTokenSet>;
  persistRefreshedCredentials(input: Readonly<{
    motoristaId: string;
    mercadoPagoUserId: string;
    encryptedAccessToken: string;
    encryptedRefreshToken: string;
    encryptionVersion: number;
    expiresAt: string;
    scope?: string;
    tokenType?: string;
  }>): Promise<void>;
}>;

export type PixPaymentBodyInput = Readonly<{
  valorTotal: number;
  valorComissao: number;
  passageiroId: string;
  passageiroNome: string | null;
  passageiroEmail: string | null;
  passageiroCpf?: string | null;
  externalReference: string;
}>;

const GENERIC_ERROR = "Não foi possível gerar o pagamento Pix. Tente novamente.";
const INVALID_ACCOUNT_ERROR = "A conta Mercado Pago do motorista não está conectada ou válida.";
const DUPLICATE_CHARGE_ERROR = "Já existe uma tentativa de cobrança Pix para esta corrida.";
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1_000;
const OAUTH_REDIRECT_URI = "https://zuvvi-moto-ride.lovable.app/motorista/mercadopago-callback";
const ENCRYPTION_VERSION = 1;
const EXTERNAL_REFERENCE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/u;

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function requireEnvironment(name: string): string {
  const value = process.env[name];
  if (!value || value !== value.trim()) throw new Error(GENERIC_ERROR);
  return value;
}

function readCredentialRow(data: unknown): PixCredentialSnapshot | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  if (data.length !== 1 || typeof data[0] !== "object" || data[0] === null) {
    throw new Error(INVALID_ACCOUNT_ERROR);
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
    throw new Error(INVALID_ACCOUNT_ERROR);
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

export async function garantirAccessTokenMotorista(
  credential: PixCredentialSnapshot | null,
  expectedMotoristaId: string,
  expectedMercadoPagoUserId: string | null,
  encryptionKey: string,
  dependencies: PixTokenRefreshDependencies,
): Promise<string> {
  if (
    !credential ||
    !expectedMercadoPagoUserId ||
    credential.motoristaId !== expectedMotoristaId ||
    credential.connectionStatus !== "active" ||
    credential.revokedAt !== null ||
    credential.mercadoPagoUserId !== expectedMercadoPagoUserId ||
    credential.encryptionVersion !== ENCRYPTION_VERSION
  ) {
    throw new Error(INVALID_ACCOUNT_ERROR);
  }

  const now = dependencies.now ?? Date.now;
  const nowValue = now();
  const expiresAt = Date.parse(credential.expiresAt);
  if (!Number.isFinite(nowValue) || Number.isNaN(expiresAt)) {
    throw new Error(INVALID_ACCOUNT_ERROR);
  }

  if (expiresAt > nowValue + TOKEN_REFRESH_MARGIN_MS) {
    return dependencies.decryptSecret(credential.encryptedAccessToken, encryptionKey);
  }

  const refreshToken = await dependencies.decryptSecret(
    credential.encryptedRefreshToken,
    encryptionKey,
  );
  const refreshed = await dependencies.refreshAccessToken(refreshToken);
  if (refreshed.userId !== expectedMercadoPagoUserId) {
    throw new Error(INVALID_ACCOUNT_ERROR);
  }

  const [encryptedAccessToken, encryptedRefreshToken] = await Promise.all([
    dependencies.encryptSecret(refreshed.accessToken, encryptionKey),
    dependencies.encryptSecret(refreshed.refreshToken, encryptionKey),
  ]);

  await dependencies.persistRefreshedCredentials({
    motoristaId: expectedMotoristaId,
    mercadoPagoUserId: refreshed.userId,
    encryptedAccessToken,
    encryptedRefreshToken,
    encryptionVersion: ENCRYPTION_VERSION,
    expiresAt: refreshed.expiresAt,
    ...(refreshed.scope ? { scope: refreshed.scope } : {}),
    ...(refreshed.tokenType ? { tokenType: refreshed.tokenType } : {}),
  });

  return refreshed.accessToken;
}

export function montarCorpoCobrancaPix(input: PixPaymentBodyInput) {
  const valorTotal = roundCurrency(input.valorTotal);
  const valorComissao = roundCurrency(input.valorComissao);
  const passageiroCpf = input.passageiroCpf?.replace(/\D/gu, "") ?? "";
  if (
    !Number.isFinite(valorTotal) ||
    !Number.isFinite(valorComissao) ||
    valorTotal <= 0 ||
    valorComissao < 0 ||
    valorComissao > valorTotal ||
    !EXTERNAL_REFERENCE_PATTERN.test(input.externalReference)
  ) {
    throw new Error(GENERIC_ERROR);
  }

  return {
    transaction_amount: valorTotal,
    application_fee: valorComissao,
    external_reference: input.externalReference,
    description: "Corrida Zuvvi",
    payment_method_id: "pix",
    payer: {
      email: input.passageiroEmail ?? `passageiro+${input.passageiroId}@zuvvi.app`,
      first_name: input.passageiroNome ?? "Passageiro",
      ...(passageiroCpf.length === 11
        ? { identification: { type: "CPF", number: passageiroCpf } }
        : {}),
    },
  } as const;
}

async function carregarCredencialMotorista(
  supabaseAdmin: any,
  motoristaId: string,
): Promise<PixCredentialSnapshot | null> {
  const { data, error } = await supabaseAdmin.rpc("pix_oauth_credentials_get", {
    _motorista_id: motoristaId,
  });
  if (error) throw new Error(INVALID_ACCOUNT_ERROR);
  return readCredentialRow(data);
}

async function criarDependenciasOAuth(
  supabaseAdmin: any,
  encryptionKey: string,
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
      if (error) throw new Error(INVALID_ACCOUNT_ERROR);
    },
  };
}

async function obterAccessTokenValido(
  supabaseAdmin: any,
  motoristaId: string,
  contaMercadoPagoId: string | null,
): Promise<string> {
  const encryptionKey = requireEnvironment("PIX_OAUTH_ENCRYPTION_KEY");
  const credential = await carregarCredencialMotorista(supabaseAdmin, motoristaId);
  const dependencies = await criarDependenciasOAuth(supabaseAdmin, encryptionKey);
  return garantirAccessTokenMotorista(
    credential,
    motoristaId,
    contaMercadoPagoId,
    encryptionKey,
    dependencies,
  );
}

async function compensarFalhaCriacaoPixSemCobrancaConhecida(
  supabaseAdmin: any,
  rideId: string,
  motoristaId: string,
  tentativaId: string,
  providerStatusDetail: string,
): Promise<void> {
  const { data, error } = await supabaseAdmin.rpc("pix_charge_failure_compensate", {
    _corrida_id: rideId,
    _motorista_id: motoristaId,
    _tentativa_id: tentativaId,
    _provider_status_detail: providerStatusDetail,
  });

  if (error || data !== true) {
    console.error("[Pagamento] Falha ao compensar criação Pix sem cobrança externa conhecida.");
    throw new Error(GENERIC_ERROR);
  }
}

async function persistirResultadoPix(
  supabaseAdmin: any,
  tentativaId: string,
  payment: Readonly<{
    paymentId: string;
    status: string | null;
    statusDetail: string | null;
    qrCode: string;
    expiresAt: string | null;
  }>,
): Promise<boolean> {
  const { error } = await supabaseAdmin.rpc("pix_charge_attempt_complete", {
    _tentativa_id: tentativaId,
    _mercadopago_payment_id: payment.paymentId,
    _provider_status: payment.status,
    _provider_status_detail: payment.statusDetail,
    _pix_copia_cola: payment.qrCode,
    _expires_at: payment.expiresAt,
  });
  return !error;
}

async function reconciliarEPersistirPagamentoPix(
  supabaseAdmin: any,
  input: Readonly<{
    accessToken: string;
    tentativaId: string;
    externalReference: string;
    valorTotal: number;
    mercadoPagoUserId: string;
    paymentId?: string | null;
  }>,
): Promise<PixChargeResult | null> {
  const canonical: PixCanonicalPayment | null = await buscarPagamentoPixCanonico({
    accessToken: input.accessToken,
    externalReference: input.externalReference,
    expectedAmount: input.valorTotal,
    expectedMercadoPagoUserId: input.mercadoPagoUserId,
    paymentId: input.paymentId ?? null,
  });

  if (!canonical) return null;

  const persisted = await persistirResultadoPix(supabaseAdmin, input.tentativaId, {
    paymentId: canonical.paymentId,
    status: canonical.status,
    statusDetail: canonical.statusDetail,
    qrCode: canonical.qrCode,
    expiresAt: canonical.expiresAt,
  });
  if (!persisted) throw new Error(GENERIC_ERROR);

  return {
    paymentId: canonical.paymentId,
    qrCode: canonical.qrCode,
    qrCodeBase64: canonical.qrCodeBase64,
  };
}

export async function prepararCobrancaPixAntesAceiteServer(
  rideId: string,
  motoristaId: string,
): Promise<Readonly<{ isPix: boolean }>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: corrida, error: corridaError } = await supabaseAdmin
    .from("corridas")
    .select("id, forma_pagamento, status, motorista_id")
    .eq("id", rideId)
    .maybeSingle();

  if (corridaError || !corrida) throw new Error("Corrida não encontrada.");
  if (corrida.forma_pagamento !== "pix") return Object.freeze({ isPix: false });
  if (corrida.status !== "solicitada" || corrida.motorista_id !== null) {
    throw new Error("Esta corrida não está mais disponível.");
  }

  const { data: motorista, error: motoristaError } = await supabaseAdmin
    .from("motoristas")
    .select("conta_mercado_pago_id")
    .eq("id", motoristaId)
    .maybeSingle();
  if (motoristaError || !motorista) throw new Error(INVALID_ACCOUNT_ERROR);

  await obterAccessTokenValido(
    supabaseAdmin as any,
    motoristaId,
    motorista.conta_mercado_pago_id,
  );
  return Object.freeze({ isPix: true });
}

export async function criarCobrancaPixAposAceiteServer(
  rideId: string,
  motoristaId: string,
): Promise<PixChargeResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: motorista, error: motoristaError } = await supabaseAdmin
    .from("motoristas")
    .select("conta_mercado_pago_id")
    .eq("id", motoristaId)
    .maybeSingle();
  if (motoristaError || !motorista || !motorista.conta_mercado_pago_id) {
    throw new Error(INVALID_ACCOUNT_ERROR);
  }
  const mercadoPagoUserId = motorista.conta_mercado_pago_id;

  const accessToken = await obterAccessTokenValido(
    supabaseAdmin as any,
    motoristaId,
    mercadoPagoUserId,
  );

  const { data: claimRows, error: claimError } = await (supabaseAdmin as any).rpc(
    "pix_charge_attempt_claim",
    {
      _corrida_id: rideId,
      _motorista_id: motoristaId,
    },
  );
  if (claimError) {
    if (
      claimError.code === "23505" ||
      String(claimError.message ?? "").includes("ETAPA4_COBRANCA_JA_REQUISITADA")
    ) {
      throw new Error(DUPLICATE_CHARGE_ERROR);
    }
    throw new Error(GENERIC_ERROR);
  }
  if (!Array.isArray(claimRows) || claimRows.length !== 1) throw new Error(GENERIC_ERROR);

  const claim = claimRows[0] as Record<string, unknown>;
  const tentativaId = typeof claim["tentativa_id"] === "string" ? claim["tentativa_id"] : null;
  const passageiroId = typeof claim["passageiro_id"] === "string" ? claim["passageiro_id"] : null;
  const idempotencyKey =
    typeof claim["idempotency_key"] === "string" ? claim["idempotency_key"] : null;
  const valorTotal = Number(claim["valor_total"]);
  const valorComissao = Number(claim["valor_comissao"]);
  if (!tentativaId || !passageiroId || !idempotencyKey) throw new Error(GENERIC_ERROR);

  const { data: passageiro, error: passageiroError } = await supabaseAdmin
    .from("usuarios")
    .select("id, nome, email, cpf")
    .eq("id", passageiroId)
    .maybeSingle();
  if (passageiroError || !passageiro) throw new Error(GENERIC_ERROR);

  let mpPaymentId: string | null = null;
  let qrCode: string | null = null;
  let qrCodeBase64: string | null = null;
  let providerStatus: string | null = null;
  let providerStatusDetail: string | null = null;
  let expiresAt: string | null = null;

  try {
    const client = new MercadoPagoConfig({ accessToken });
    const payment = new Payment(client);
    const response = await payment.create({
      body: montarCorpoCobrancaPix({
        valorTotal,
        valorComissao,
        passageiroId,
        passageiroNome: passageiro.nome,
        passageiroEmail: passageiro.email,
        passageiroCpf: passageiro.cpf,
        externalReference: idempotencyKey,
      }),
      requestOptions: { idempotencyKey },
    });

    mpPaymentId = response.id != null ? String(response.id) : null;
    qrCode = response.point_of_interaction?.transaction_data?.qr_code ?? null;
    qrCodeBase64 = response.point_of_interaction?.transaction_data?.qr_code_base64 ?? null;
    providerStatus = response.status ?? null;
    providerStatusDetail = response.status_detail ?? null;
    expiresAt = response.date_of_expiration ?? null;
  } catch (error) {
    console.error("[PixPaymentDiag] create_failed", {
      status: typeof (error as any)?.status === "number" ? (error as any).status : 0,
      errorCode:
        typeof (error as any)?.error === "string"
          ? (error as any).error.slice(0, 128)
          : "unknown",
    });
    if (falhaCriacaoMercadoPagoPermiteCompensacao(error)) {
      console.error("[Pagamento] Mercado Pago rejeitou a criação Pix sem cobrança externa.");
      await compensarFalhaCriacaoPixSemCobrancaConhecida(
        supabaseAdmin as any,
        rideId,
        motoristaId,
        tentativaId,
        "mercadopago_create_rejected",
      );
      throw new Error(GENERIC_ERROR);
    }

    try {
      const reconciled = await reconciliarEPersistirPagamentoPix(supabaseAdmin as any, {
        accessToken,
        tentativaId,
        externalReference: idempotencyKey,
        valorTotal,
        mercadoPagoUserId,
      });
      if (reconciled) return reconciled;
    } catch {
      // Estado externo permanece incerto; não compensar nem criar uma segunda cobrança.
    }

    console.error(
      "[Pagamento] Estado da criação Pix incerto; tentativa mantida para reconciliação.",
    );
    throw new Error(GENERIC_ERROR);
  }

  if (!mpPaymentId || !qrCode || !qrCodeBase64) {
    try {
      const reconciled = await reconciliarEPersistirPagamentoPix(supabaseAdmin as any, {
        accessToken,
        tentativaId,
        externalReference: idempotencyKey,
        valorTotal,
        mercadoPagoUserId,
        paymentId: mpPaymentId,
      });
      if (reconciled) return reconciled;
    } catch {
      // A resposta externa não foi validada canonicamente; falhar fechado.
    }

    console.error(
      "[Pagamento] Resposta Pix incompleta; tentativa mantida para reconciliação canônica.",
    );
    throw new Error(GENERIC_ERROR);
  }

  const persisted = await persistirResultadoPix(supabaseAdmin as any, tentativaId, {
    paymentId: mpPaymentId,
    status: providerStatus,
    statusDetail: providerStatusDetail,
    qrCode,
    expiresAt,
  });
  if (!persisted) {
    try {
      const reconciled = await reconciliarEPersistirPagamentoPix(supabaseAdmin as any, {
        accessToken,
        tentativaId,
        externalReference: idempotencyKey,
        valorTotal,
        mercadoPagoUserId,
        paymentId: mpPaymentId,
      });
      if (reconciled) return reconciled;
    } catch {
      // Mantém a cobrança externa intacta para Webhook/reconciliação posterior.
    }

    console.error(
      "[Pagamento] Falha ao persistir resultado Pix; cobrança mantida para reconciliação.",
    );
    throw new Error(GENERIC_ERROR);
  }

  return { paymentId: mpPaymentId, qrCode, qrCodeBase64 };
}

// Mantém a Server Function existente disponível, agora sempre validando que o chamador
// é o motorista atribuído à corrida. Nenhum token geral da plataforma é utilizado.
export async function criarCobrancaPixServer(
  rideId: string,
  authUserId: string,
): Promise<PixChargeResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: usuario, error } = await supabaseAdmin
    .from("usuarios")
    .select("id, is_motorista")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error || !usuario || !usuario.is_motorista) throw new Error(INVALID_ACCOUNT_ERROR);
  return criarCobrancaPixAposAceiteServer(rideId, usuario.id);
}
