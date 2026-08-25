const ACCOUNT_ERROR = "Não foi possível consultar a conexão segura com o Mercado Pago.";
const DISCONNECT_ERROR = "Não foi possível desconectar a conta Mercado Pago com segurança.";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

type QueryResponse = Readonly<{ data: unknown; error: unknown }>;
type MaybeSingleBuilder = Readonly<{ maybeSingle(): PromiseLike<QueryResponse> }>;
type FilterBuilder = Readonly<{ eq(column: string, value: unknown): MaybeSingleBuilder }>;
type SelectBuilder = Readonly<{ select(columns: string): FilterBuilder }>;

export type PixMercadoPagoAccountClient = Readonly<{
  from(table: string): SelectBuilder;
  rpc(functionName: string, args: Record<string, unknown>): PromiseLike<QueryResponse>;
}>;

export type PixMercadoPagoDisconnectResult =
  | Readonly<{ desconectado: true }>
  | Readonly<{
      desconectado: false;
      motivo: "corrida_pix_ativa" | "obrigacao_financeira";
    }>;

function requireUuid(value: unknown): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw new Error("invalid");
  return value.toLowerCase();
}

function readPublicAccountId(data: unknown, expectedMotoristaId: string): string | null {
  if (typeof data !== "object" || data === null) throw new Error("invalid");
  const row = data as Record<string, unknown>;
  if (requireUuid(row["id"]) !== expectedMotoristaId) throw new Error("invalid");
  const accountId = row["conta_mercado_pago_id"];
  if (accountId === null) return null;
  if (typeof accountId !== "string" || !accountId.trim() || accountId !== accountId.trim()) {
    throw new Error("invalid");
  }
  return accountId;
}

function readCredential(data: unknown, expectedMotoristaId: string) {
  if (!Array.isArray(data) || data.length !== 1) return null;
  const row = data[0];
  if (typeof row !== "object" || row === null) throw new Error("invalid");
  const credential = row as Record<string, unknown>;
  if (requireUuid(credential["motorista_id"]) !== expectedMotoristaId) throw new Error("invalid");
  if (typeof credential["mercadopago_user_id"] !== "string") throw new Error("invalid");
  if (typeof credential["connection_status"] !== "string") throw new Error("invalid");
  if (typeof credential["encryption_version"] !== "number") throw new Error("invalid");

  return Object.freeze({
    mercadoPagoUserId: credential["mercadopago_user_id"] as string,
    connectionStatus: credential["connection_status"] as string,
    encryptionVersion: credential["encryption_version"] as number,
    revokedAt: credential["revoked_at"],
    accessTokenEncrypted: credential["access_token_encrypted"],
    refreshTokenEncrypted: credential["refresh_token_encrypted"],
  });
}

export async function getPixMercadoPagoSecureConnectionStatus(
  client: PixMercadoPagoAccountClient,
  motoristaId: string,
): Promise<Readonly<{ conectado: boolean }>> {
  try {
    const normalizedMotoristaId = requireUuid(motoristaId);
    const [motoristaResult, credentialResult] = await Promise.all([
      client
        .from("motoristas")
        .select("id, conta_mercado_pago_id")
        .eq("id", normalizedMotoristaId)
        .maybeSingle(),
      client.rpc("pix_oauth_credentials_get", { _motorista_id: normalizedMotoristaId }),
    ]);

    if (motoristaResult.error || credentialResult.error) throw new Error("invalid");
    const publicAccountId = readPublicAccountId(motoristaResult.data, normalizedMotoristaId);
    const credential = readCredential(credentialResult.data, normalizedMotoristaId);

    const conectado = Boolean(
      publicAccountId &&
        credential &&
        credential.connectionStatus === "active" &&
        credential.revokedAt === null &&
        credential.encryptionVersion > 0 &&
        typeof credential.accessTokenEncrypted === "string" &&
        credential.accessTokenEncrypted.length > 0 &&
        typeof credential.refreshTokenEncrypted === "string" &&
        credential.refreshTokenEncrypted.length > 0 &&
        credential.mercadoPagoUserId === publicAccountId,
    );

    return Object.freeze({ conectado });
  } catch {
    throw new Error(ACCOUNT_ERROR);
  }
}

export async function disconnectPixMercadoPagoSafely(
  client: PixMercadoPagoAccountClient,
  motoristaId: string,
): Promise<PixMercadoPagoDisconnectResult> {
  try {
    const normalizedMotoristaId = requireUuid(motoristaId);
    const { data, error } = await client.rpc("pix_oauth_disconnect_safe", {
      _motorista_id: normalizedMotoristaId,
    });
    if (error) throw new Error("invalid");

    if (data === "disconnected") return Object.freeze({ desconectado: true });
    if (data === "blocked_active_pix") {
      return Object.freeze({ desconectado: false, motivo: "corrida_pix_ativa" });
    }
    if (data === "blocked_financial") {
      return Object.freeze({ desconectado: false, motivo: "obrigacao_financeira" });
    }
    throw new Error("invalid");
  } catch {
    throw new Error(DISCONNECT_ERROR);
  }
}
