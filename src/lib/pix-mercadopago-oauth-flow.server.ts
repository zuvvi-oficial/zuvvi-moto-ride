import {
  createPkceChallenge,
  decryptOAuthSecret,
  encryptOAuthSecret,
  generateOAuthState,
  generatePkceVerifier,
  hashOAuthState,
} from "./pix-oauth-crypto.server.js";
import type { MercadoPagoOAuthClient } from "./pix-mercadopago-oauth.server.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const STATE_PATTERN = /^[A-Za-z0-9_-]{43,128}$/u;
const AUTHORIZATION_CODE_MIN_CHARS = 4;
const AUTHORIZATION_CODE_MAX_CHARS = 500;
const ENCRYPTION_VERSION = 1;
const STATE_TTL_MS = 5 * 60 * 1_000;

const START_ERROR = "Não foi possível iniciar a conexão segura com o Mercado Pago.";
const COMPLETE_ERROR = "Não foi possível concluir a conexão segura com o Mercado Pago.";

type CompletionStage =
  | "validate_input"
  | "consume_state"
  | "decrypt_verifier"
  | "exchange_token"
  | "encrypt_tokens"
  | "persist_pending_authorization";

type MercadoPagoOAuthFlowClient = Pick<
  MercadoPagoOAuthClient,
  "buildAuthorizationUrl" | "exchangeAuthorizationCode"
>;

function logCompletionStage(stage: CompletionStage): void {
  console.info("[PixOAuthDiag] completion_stage", { stage });
}

export type PixOAuthStateRecord = Readonly<{
  motoristaId: string;
  stateHash: string;
  encryptedCodeVerifier: string;
  encryptionVersion: number;
  expiresAt: string;
}>;

export type PixOAuthConsumedState = Readonly<{
  encryptedCodeVerifier: string;
  encryptionVersion: number;
}>;

export type PixOAuthPendingAuthorizationRecord = Readonly<{
  motoristaId: string;
  mercadoPagoUserId: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  encryptionVersion: number;
  expiresAt: string;
  scope?: string;
  tokenType?: string;
}>;

export type PixOAuthPersistence = Readonly<{
  createState(input: PixOAuthStateRecord): Promise<void>;
  consumeState(input: {
    motoristaId: string;
    stateHash: string;
  }): Promise<PixOAuthConsumedState | null>;
  storePendingAuthorization(
    input: PixOAuthPendingAuthorizationRecord,
  ): Promise<Readonly<{ confirmationExpiresAt: string }>>;
}>;

type PixOAuthFlowConfig = Readonly<{
  encryptionKey: string;
  oauthClient: MercadoPagoOAuthFlowClient;
  persistence: PixOAuthPersistence;
}>;

type PixOAuthFlowDependencies = Readonly<{
  now?: () => number;
  generateState?: () => string;
  generateVerifier?: () => string;
}>;

export type PixMercadoPagoOAuthFlow = Readonly<{
  startConnection(motoristaId: string): Promise<Readonly<{ authorizationUrl: string }>>;
  completeConnection(input: {
    motoristaId: string;
    code: string;
    state: string;
  }): Promise<Readonly<{ pending: true; confirmationExpiresAt: string }>>;
}>;

function requireUuid(value: unknown): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw new Error("invalid");
  return value.toLowerCase();
}

function requireState(value: unknown): string {
  if (typeof value !== "string" || !STATE_PATTERN.test(value)) throw new Error("invalid");
  return value;
}

function requireAuthorizationCode(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length < AUTHORIZATION_CODE_MIN_CHARS ||
    value.length > AUTHORIZATION_CODE_MAX_CHARS ||
    value !== value.trim()
  ) {
    throw new Error("invalid");
  }

  return value;
}

function requireNow(now: () => number): number {
  const value = now();
  if (!Number.isFinite(value) || value < 0) throw new Error("invalid");
  return value;
}

export function createPixMercadoPagoOAuthFlow(
  config: PixOAuthFlowConfig,
  dependencies: PixOAuthFlowDependencies = {},
): PixMercadoPagoOAuthFlow {
  const now = dependencies.now ?? Date.now;
  const createState = dependencies.generateState ?? generateOAuthState;
  const createVerifier = dependencies.generateVerifier ?? generatePkceVerifier;

  return Object.freeze({
    async startConnection(motoristaId) {
      try {
        const validatedMotoristaId = requireUuid(motoristaId);
        const createdAt = requireNow(now);
        const state = requireState(createState());
        const verifier = createVerifier();
        const [stateHash, codeChallenge, encryptedCodeVerifier] = await Promise.all([
          hashOAuthState(state),
          createPkceChallenge(verifier),
          encryptOAuthSecret(verifier, config.encryptionKey),
        ]);
        const authorizationUrl = config.oauthClient.buildAuthorizationUrl({
          state,
          codeChallenge,
        });

        await config.persistence.createState({
          motoristaId: validatedMotoristaId,
          stateHash,
          encryptedCodeVerifier,
          encryptionVersion: ENCRYPTION_VERSION,
          expiresAt: new Date(createdAt + STATE_TTL_MS).toISOString(),
        });

        return Object.freeze({ authorizationUrl });
      } catch {
        throw new Error(START_ERROR);
      }
    },

    async completeConnection(input) {
      let stage: CompletionStage = "validate_input";

      try {
        logCompletionStage(stage);
        const motoristaId = requireUuid(input.motoristaId);
        const state = requireState(input.state);
        const code = requireAuthorizationCode(input.code);
        const stateHash = await hashOAuthState(state);

        stage = "consume_state";
        logCompletionStage(stage);
        const consumedState = await config.persistence.consumeState({ motoristaId, stateHash });

        if (!consumedState || consumedState.encryptionVersion !== ENCRYPTION_VERSION) {
          throw new Error("invalid");
        }

        stage = "decrypt_verifier";
        logCompletionStage(stage);
        const codeVerifier = await decryptOAuthSecret(
          consumedState.encryptedCodeVerifier,
          config.encryptionKey,
        );

        stage = "exchange_token";
        logCompletionStage(stage);
        const tokenSet = await config.oauthClient.exchangeAuthorizationCode({
          code,
          codeVerifier,
        });

        stage = "encrypt_tokens";
        logCompletionStage(stage);
        const [encryptedAccessToken, encryptedRefreshToken] = await Promise.all([
          encryptOAuthSecret(tokenSet.accessToken, config.encryptionKey),
          encryptOAuthSecret(tokenSet.refreshToken, config.encryptionKey),
        ]);

        stage = "persist_pending_authorization";
        logCompletionStage(stage);
        const pendingAuthorization = await config.persistence.storePendingAuthorization({
          motoristaId,
          mercadoPagoUserId: tokenSet.userId,
          encryptedAccessToken,
          encryptedRefreshToken,
          encryptionVersion: ENCRYPTION_VERSION,
          expiresAt: tokenSet.expiresAt,
          ...(tokenSet.scope ? { scope: tokenSet.scope } : {}),
          ...(tokenSet.tokenType ? { tokenType: tokenSet.tokenType } : {}),
        });

        console.info("[PixOAuthDiag] completion_succeeded", { stage });
        return Object.freeze({
          pending: true as const,
          confirmationExpiresAt: pendingAuthorization.confirmationExpiresAt,
        });
      } catch {
        console.error("[PixOAuthDiag] completion_failed", { stage });
        throw new Error(COMPLETE_ERROR);
      }
    },
  });
}
