import type {
  PixOAuthConsumedState,
  PixOAuthPersistence,
} from "./pix-mercadopago-oauth-flow.server.js";

const PERSISTENCE_ERROR = "Não foi possível persistir a conexão OAuth com segurança.";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const MERCADOPAGO_USER_ID_PATTERN = /^\d{1,128}$/u;

type RpcResponse = Readonly<{
  data: unknown;
  error: unknown;
}>;

export type PixOAuthRpcClient = Readonly<{
  rpc(functionName: string, args: Record<string, unknown>): PromiseLike<RpcResponse>;
}>;

export type PixOAuthPendingStatus =
  | Readonly<{ pendente: false }>
  | Readonly<{
      pendente: true;
      confirmationExpiresAt: string;
      accountHint: string;
      reconexao: boolean;
    }>;

export type PixOAuthPendingConfirmationResult =
  | Readonly<{ conectado: true; jaEstavaConectado: boolean }>
  | Readonly<{
      conectado: false;
      motivo:
        | "expirada"
        | "ausente"
        | "conta_de_outro_motorista"
        | "conta_da_plataforma";
    }>;

function persistenceError(): never {
  throw new Error(PERSISTENCE_ERROR);
}

function requireMotoristaId(value: unknown): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) persistenceError();
  return value.toLowerCase();
}

function requireMercadoPagoUserId(value: unknown): string {
  if (typeof value !== "string" || !MERCADOPAGO_USER_ID_PATTERN.test(value)) {
    persistenceError();
  }
  return value;
}

function readCreatedState(data: unknown): void {
  if (typeof data !== "string" || !UUID_PATTERN.test(data)) persistenceError();
}

function readConsumedState(data: unknown): PixOAuthConsumedState | null {
  if (Array.isArray(data) && data.length === 0) return null;
  if (!Array.isArray(data) || data.length !== 1) persistenceError();

  const row = data[0];
  if (
    typeof row !== "object" ||
    row === null ||
    typeof (row as Record<string, unknown>)["encrypted_code_verifier"] !== "string" ||
    !Number.isInteger((row as Record<string, unknown>)["envelope_version"]) ||
    ((row as Record<string, unknown>)["envelope_version"] as number) < 1
  ) {
    persistenceError();
  }

  return Object.freeze({
    encryptedCodeVerifier: (row as Record<string, unknown>)["encrypted_code_verifier"] as string,
    encryptionVersion: (row as Record<string, unknown>)["envelope_version"] as number,
  });
}

function readPendingConfirmationExpiry(data: unknown): string {
  if (typeof data !== "string") persistenceError();
  const timestamp = Date.parse(data);
  if (!Number.isFinite(timestamp) || timestamp <= 0) persistenceError();
  return new Date(timestamp).toISOString();
}

function readPendingStatus(data: unknown): PixOAuthPendingStatus {
  if (data === null) return Object.freeze({ pendente: false });
  if (typeof data !== "object" || Array.isArray(data)) persistenceError();

  const row = data as Record<string, unknown>;
  const accountHint = row["account_hint"];
  const reconexao = row["reconnection"];
  if (
    typeof accountHint !== "string" ||
    accountHint.length < 1 ||
    accountHint.length > 4 ||
    typeof reconexao !== "boolean"
  ) {
    persistenceError();
  }

  return Object.freeze({
    pendente: true,
    confirmationExpiresAt: readPendingConfirmationExpiry(row["confirmation_expires_at"]),
    accountHint,
    reconexao,
  });
}

function readPendingConfirmationResult(data: unknown): PixOAuthPendingConfirmationResult {
  if (data === "connected") {
    return Object.freeze({ conectado: true, jaEstavaConectado: false });
  }
  if (data === "already_connected") {
    return Object.freeze({ conectado: true, jaEstavaConectado: true });
  }
  if (data === "expired") {
    return Object.freeze({ conectado: false, motivo: "expirada" });
  }
  if (data === "not_found") {
    return Object.freeze({ conectado: false, motivo: "ausente" });
  }
  if (data === "ownership_conflict") {
    return Object.freeze({ conectado: false, motivo: "conta_de_outro_motorista" });
  }
  if (data === "platform_account") {
    return Object.freeze({ conectado: false, motivo: "conta_da_plataforma" });
  }

  return persistenceError();
}

export function createPixOAuthSupabasePersistenceFromClient(
  client: PixOAuthRpcClient,
): PixOAuthPersistence {
  return Object.freeze({
    async createState(input) {
      const { data, error } = await client.rpc("pix_oauth_state_create", {
        _motorista_id: input.motoristaId,
        _state_hash: input.stateHash,
        _code_verifier_encrypted: input.encryptedCodeVerifier,
        _encryption_version: input.encryptionVersion,
        _expires_at: input.expiresAt,
      });

      if (error) persistenceError();
      readCreatedState(data);
    },

    async consumeState(input) {
      const { data, error } = await client.rpc("pix_oauth_state_consume", {
        _motorista_id: input.motoristaId,
        _state_hash: input.stateHash,
      });

      if (error) persistenceError();
      return readConsumedState(data);
    },

    async storePendingAuthorization(input) {
      const { data, error } = await client.rpc("pix_oauth_pending_authorization_upsert", {
        _motorista_id: input.motoristaId,
        _mercadopago_user_id: input.mercadoPagoUserId,
        _access_token_encrypted: input.encryptedAccessToken,
        _refresh_token_encrypted: input.encryptedRefreshToken,
        _encryption_version: input.encryptionVersion,
        _token_expires_at: input.expiresAt,
        _scope: input.scope ?? null,
        _token_type: input.tokenType ?? null,
      });

      if (error) persistenceError();
      return Object.freeze({ confirmationExpiresAt: readPendingConfirmationExpiry(data) });
    },
  });
}

export async function getPixOAuthPendingAuthorizationStatus(
  client: PixOAuthRpcClient,
  motoristaId: string,
): Promise<PixOAuthPendingStatus> {
  const normalizedMotoristaId = requireMotoristaId(motoristaId);
  const { data, error } = await client.rpc("pix_oauth_pending_authorization_summary", {
    _motorista_id: normalizedMotoristaId,
  });

  if (error) persistenceError();
  return readPendingStatus(data);
}

export async function cancelPixOAuthPendingAuthorization(
  client: PixOAuthRpcClient,
  motoristaId: string,
): Promise<boolean> {
  const normalizedMotoristaId = requireMotoristaId(motoristaId);
  const { data, error } = await client.rpc("pix_oauth_pending_authorization_cancel", {
    _motorista_id: normalizedMotoristaId,
  });

  if (error || typeof data !== "boolean") persistenceError();
  return data;
}

export async function confirmPixOAuthPendingAuthorization(
  client: PixOAuthRpcClient,
  motoristaId: string,
  platformMercadoPagoUserId: string,
): Promise<PixOAuthPendingConfirmationResult> {
  const normalizedMotoristaId = requireMotoristaId(motoristaId);
  const normalizedPlatformUserId = requireMercadoPagoUserId(platformMercadoPagoUserId);
  const { data, error } = await client.rpc("pix_oauth_pending_authorization_confirm", {
    _motorista_id: normalizedMotoristaId,
    _platform_mercadopago_user_id: normalizedPlatformUserId,
  });

  if (error) persistenceError();
  return readPendingConfirmationResult(data);
}
