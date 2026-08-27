const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;
const OAUTH_REDIRECT_URI = "https://zuvvi-moto-ride.lovable.app/motorista/mercadopago-callback";
const GENERIC_ERROR = "Não foi possível processar o pagamento Pix. Tente novamente.";
const INVALID_ACCOUNT_ERROR = "A conta Mercado Pago do motorista não está conectada ou válida.";

export type RideContext = Readonly<{
  authUserId: string;
  usuarioId: string;
  corridaId: string;
  status: string;
  motoristaId: string | null;
  formaPagamento: string;
  pagamentoId: string | null;
  pagamentoStatus: string | null;
  valorTotal: number | null;
  valorComissao: number | null;
  mercadopagoPaymentId: string | null;
}>;

type Credential = Readonly<{
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

function requireEnvironment(name: string): string {
  const value = process.env[name];
  if (!value || value !== value.trim()) throw new Error(GENERIC_ERROR);
  return value;
}

function parseCredential(data: unknown): Credential {
  if (!Array.isArray(data) || data.length !== 1 || !data[0] || typeof data[0] !== "object") {
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

  return {
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
  };
}

export async function getRideContext(rideId: string, authUserId: string): Promise<RideContext> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;

  const { data: usuario, error: usuarioError } = await db
    .from("usuarios")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (usuarioError || !usuario?.id) throw new Error("Usuário não encontrado.");

  const { data: corrida, error: corridaError } = await db
    .from("corridas")
    .select("id, passageiro_id, motorista_id, forma_pagamento, status")
    .eq("id", rideId)
    .eq("passageiro_id", usuario.id)
    .maybeSingle();
  if (corridaError || !corrida) throw new Error("Corrida não encontrada.");

  if (corrida.forma_pagamento !== "pix") {
    return {
      authUserId,
      usuarioId: usuario.id,
      corridaId: corrida.id,
      status: corrida.status,
      motoristaId: corrida.motorista_id ?? null,
      formaPagamento: corrida.forma_pagamento,
      pagamentoId: null,
      pagamentoStatus: null,
      valorTotal: null,
      valorComissao: null,
      mercadopagoPaymentId: null,
    };
  }

  const { data: pagamento, error: pagamentoError } = await db
    .from("pagamentos")
    .select("id, status, meio, valor_total, valor_comissao, id_transacao_mercadopago")
    .eq("corrida_id", corrida.id)
    .eq("meio", "pix")
    .maybeSingle();
  if (pagamentoError || !pagamento) throw new Error("Pagamento Pix da corrida não encontrado.");

  return {
    authUserId,
    usuarioId: usuario.id,
    corridaId: corrida.id,
    status: corrida.status,
    motoristaId: corrida.motorista_id ?? null,
    formaPagamento: corrida.forma_pagamento,
    pagamentoId: pagamento.id,
    pagamentoStatus: pagamento.status,
    valorTotal: Number(pagamento.valor_total),
    valorComissao: Number(pagamento.valor_comissao),
    mercadopagoPaymentId: pagamento.id_transacao_mercadopago ?? null,
  };
}

export async function getDriverAccessToken(motoristaId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const encryptionKey = requireEnvironment("PIX_OAUTH_ENCRYPTION_KEY");

  const { data: motorista, error: motoristaError } = await db
    .from("motoristas")
    .select("conta_mercado_pago_id")
    .eq("id", motoristaId)
    .maybeSingle();
  if (motoristaError || !motorista?.conta_mercado_pago_id) throw new Error(INVALID_ACCOUNT_ERROR);

  const { data: credentialData, error: credentialError } = await db.rpc("pix_oauth_credentials_get", {
    _motorista_id: motoristaId,
  });
  if (credentialError) throw new Error(INVALID_ACCOUNT_ERROR);

  const credential = parseCredential(credentialData);
  if (
    credential.motoristaId !== motoristaId ||
    credential.mercadoPagoUserId !== String(motorista.conta_mercado_pago_id) ||
    credential.connectionStatus !== "active" ||
    credential.revokedAt !== null ||
    credential.encryptionVersion !== 1
  ) {
    throw new Error(INVALID_ACCOUNT_ERROR);
  }

  const { decryptOAuthSecret, encryptOAuthSecret } = await import("./pix-oauth-crypto.server");
  const expiresAt = Date.parse(credential.expiresAt);
  if (Number.isNaN(expiresAt)) throw new Error(INVALID_ACCOUNT_ERROR);

  if (expiresAt > Date.now() + TOKEN_REFRESH_MARGIN_MS) {
    return decryptOAuthSecret(credential.encryptedAccessToken, encryptionKey);
  }

  const refreshToken = await decryptOAuthSecret(credential.encryptedRefreshToken, encryptionKey);
  const { createMercadoPagoOAuthClient } = await import("./pix-mercadopago-oauth.server");
  const oauthClient = createMercadoPagoOAuthClient({
    clientId: requireEnvironment("MERCADOPAGO_CLIENT_ID"),
    clientSecret: requireEnvironment("MERCADOPAGO_CLIENT_SECRET"),
    redirectUri: OAUTH_REDIRECT_URI,
  });
  const refreshed = await oauthClient.refreshAccessToken(refreshToken);
  if (refreshed.userId !== credential.mercadoPagoUserId) throw new Error(INVALID_ACCOUNT_ERROR);

  const [encryptedAccessToken, encryptedRefreshToken] = await Promise.all([
    encryptOAuthSecret(refreshed.accessToken, encryptionKey),
    encryptOAuthSecret(refreshed.refreshToken, encryptionKey),
  ]);

  const { error: persistError } = await db.rpc("pix_oauth_credentials_upsert", {
    _motorista_id: motoristaId,
    _mercadopago_user_id: refreshed.userId,
    _access_token_encrypted: encryptedAccessToken,
    _refresh_token_encrypted: encryptedRefreshToken,
    _encryption_version: 1,
    _expires_at: refreshed.expiresAt,
    _scope: refreshed.scope ?? null,
    _token_type: refreshed.tokenType ?? null,
  });
  if (persistError) throw new Error(INVALID_ACCOUNT_ERROR);

  return refreshed.accessToken;
}
