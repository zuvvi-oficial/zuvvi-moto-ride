import type {
  PixOAuthConsumedState,
  PixOAuthPersistence,
} from "./pix-mercadopago-oauth-flow.server.js";

const PERSISTENCE_ERROR = "Não foi possível persistir a conexão OAuth com segurança.";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

type RpcResponse = Readonly<{
  data: unknown;
  error: unknown;
}>;

export type PixOAuthRpcClient = Readonly<{
  rpc(functionName: string, args: Record<string, unknown>): PromiseLike<RpcResponse>;
}>;

function persistenceError(): never {
  throw new Error(PERSISTENCE_ERROR);
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
