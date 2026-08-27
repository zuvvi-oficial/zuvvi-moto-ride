import assert from "node:assert/strict";
import test from "node:test";
import type { MercadoPagoOAuthClient } from "../../src/lib/pix-mercadopago-oauth.server.js";
import {
  createPixMercadoPagoOAuthFlow,
  type PixOAuthPendingAuthorizationRecord,
  type PixOAuthPersistence,
  type PixOAuthStateRecord,
} from "../../src/lib/pix-mercadopago-oauth-flow.server.js";
import {
  createPixOAuthSupabasePersistenceFromClient,
  type PixOAuthRpcClient,
} from "../../src/lib/pix-mercadopago-oauth-supabase.server.js";
import {
  decryptOAuthSecret,
  encryptOAuthSecret,
  hashOAuthState,
} from "../../src/lib/pix-oauth-crypto.server.js";

const MOTORISTA_ID = "80000000-0000-4000-8000-000000000001";
const OUTRO_MOTORISTA_ID = "80000000-0000-4000-8000-000000000002";
const STATE = "s".repeat(43);
const VERIFIER = "v".repeat(64);
const CODE = "TG-AUTHORIZATION-CODE";
const ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
const FIXED_NOW = 1_700_000_000_000;
const EXPIRES_AT = new Date(FIXED_NOW + 15_552_000_000).toISOString();
const PENDING_EXPIRES_AT = new Date(FIXED_NOW + 10 * 60_000).toISOString();
const COMPLETE_ERROR = "Não foi possível concluir a conexão segura com o Mercado Pago.";

const TOKEN_SET = Object.freeze({
  userId: "987654321",
  accessToken: "access-token-test-only",
  refreshToken: "refresh-token-test-only",
  expiresInSeconds: 15_552_000,
  expiresAt: EXPIRES_AT,
  scope: "offline_access payments write",
  tokenType: "bearer",
});

function createOAuthClient(
  overrides: Partial<MercadoPagoOAuthClient> = {},
): MercadoPagoOAuthClient {
  return {
    buildAuthorizationUrl: ({ state, codeChallenge }) =>
      `https://auth.mercadopago.com.br/authorization?state=${state}&code_challenge=${codeChallenge}`,
    exchangeAuthorizationCode: async () => TOKEN_SET,
    refreshAccessToken: async () => TOKEN_SET,
    getApplicationOwnerUserId: async () => "5555555555",
    ...overrides,
  };
}

function createPersistence(overrides: Partial<PixOAuthPersistence> = {}): PixOAuthPersistence {
  return {
    createState: async () => undefined,
    consumeState: async () => null,
    storePendingAuthorization: async () => ({ confirmationExpiresAt: PENDING_EXPIRES_AT }),
    ...overrides,
  };
}

test("início persiste apenas hash e verifier cifrado por cinco minutos", async () => {
  let persisted: PixOAuthStateRecord | undefined;
  let capturedState = "";
  let capturedChallenge = "";
  const flow = createPixMercadoPagoOAuthFlow(
    {
      encryptionKey: ENCRYPTION_KEY,
      oauthClient: createOAuthClient({
        buildAuthorizationUrl: ({ state, codeChallenge }) => {
          capturedState = state;
          capturedChallenge = codeChallenge;
          return `https://auth.mercadopago.com.br/authorization?state=${state}`;
        },
      }),
      persistence: createPersistence({
        createState: async (input) => {
          persisted = input;
        },
      }),
    },
    {
      now: () => FIXED_NOW,
      randomBytes: (length) => Buffer.alloc(length, 5),
    },
  );

  const result = await flow.start(MOTORISTA_ID);

  assert.match(result.authorizationUrl, /^https:\/\/auth\.mercadopago\.com\.br\/authorization\?/u);
  assert.ok(persisted);
  assert.equal(persisted.motoristaId, MOTORISTA_ID);
  assert.equal(persisted.stateHash, hashOAuthState(capturedState));
  assert.notEqual(persisted.encryptedCodeVerifier, VERIFIER);
  assert.equal(persisted.encryptionVersion, 1);
  assert.equal(Date.parse(persisted.expiresAt), FIXED_NOW + 5 * 60_000);
  assert.equal(capturedState.length, 43);
  assert.equal(capturedChallenge.length, 43);
});

test("conclusão consome state do mesmo motorista e mantém autorização apenas pendente", async () => {
  let consumedInput: { motoristaId: string; stateHash: string } | undefined;
  let pending: PixOAuthPendingAuthorizationRecord | undefined;
  const encryptedVerifier = encryptOAuthSecret(VERIFIER, ENCRYPTION_KEY);

  const flow = createPixMercadoPagoOAuthFlow(
    {
      encryptionKey: ENCRYPTION_KEY,
      oauthClient: createOAuthClient(),
      persistence: createPersistence({
        consumeState: async (input) => {
          consumedInput = input;
          return {
            encryptedCodeVerifier: encryptedVerifier,
            encryptionVersion: 1,
          };
        },
        storePendingAuthorization: async (input) => {
          pending = input;
          return { confirmationExpiresAt: PENDING_EXPIRES_AT };
        },
      }),
    },
    { now: () => FIXED_NOW },
  );

  const result = await flow.complete(MOTORISTA_ID, { code: CODE, state: STATE });

  assert.deepEqual(consumedInput, {
    motoristaId: MOTORISTA_ID,
    stateHash: hashOAuthState(STATE),
  });
  assert.ok(pending);
  assert.equal(pending.motoristaId, MOTORISTA_ID);
  assert.equal(pending.mercadoPagoUserId, TOKEN_SET.userId);
  assert.notEqual(pending.encryptedAccessToken, TOKEN_SET.accessToken);
  assert.notEqual(pending.encryptedRefreshToken, TOKEN_SET.refreshToken);
  assert.equal(decryptOAuthSecret(pending.encryptedAccessToken, ENCRYPTION_KEY), TOKEN_SET.accessToken);
  assert.equal(
    decryptOAuthSecret(pending.encryptedRefreshToken, ENCRYPTION_KEY),
    TOKEN_SET.refreshToken,
  );
  assert.equal(result.pending, true);
  assert.equal(result.confirmationExpiresAt, PENDING_EXPIRES_AT);
  assert.equal("mercadoPagoUserId" in result, false);
});

test("state ausente ou inválido falha sem trocar código", async () => {
  let exchangeCalls = 0;
  const flow = createPixMercadoPagoOAuthFlow(
    {
      encryptionKey: ENCRYPTION_KEY,
      oauthClient: createOAuthClient({
        exchangeAuthorizationCode: async () => {
          exchangeCalls += 1;
          return TOKEN_SET;
        },
      }),
      persistence: createPersistence({ consumeState: async () => null }),
    },
    { now: () => FIXED_NOW },
  );

  await assert.rejects(flow.complete(MOTORISTA_ID, { code: CODE, state: STATE }), {
    message: COMPLETE_ERROR,
  });
  assert.equal(exchangeCalls, 0);
});

test("state de outro motorista não pode ser consumido", async () => {
  const encryptedVerifier = encryptOAuthSecret(VERIFIER, ENCRYPTION_KEY);
  const rows = new Map<string, { motoristaId: string; encryptedCodeVerifier: string }>([
    [hashOAuthState(STATE), { motoristaId: OUTRO_MOTORISTA_ID, encryptedCodeVerifier: encryptedVerifier }],
  ]);

  const flow = createPixMercadoPagoOAuthFlow(
    {
      encryptionKey: ENCRYPTION_KEY,
      oauthClient: createOAuthClient(),
      persistence: createPersistence({
        consumeState: async ({ motoristaId, stateHash }) => {
          const row = rows.get(stateHash);
          if (!row || row.motoristaId !== motoristaId) return null;
          return { encryptedCodeVerifier: row.encryptedCodeVerifier, encryptionVersion: 1 };
        },
      }),
    },
    { now: () => FIXED_NOW },
  );

  await assert.rejects(flow.complete(MOTORISTA_ID, { code: CODE, state: STATE }), {
    message: COMPLETE_ERROR,
  });
});

test("falha de persistência da pendência não retorna credenciais", async () => {
  const encryptedVerifier = encryptOAuthSecret(VERIFIER, ENCRYPTION_KEY);
  const flow = createPixMercadoPagoOAuthFlow(
    {
      encryptionKey: ENCRYPTION_KEY,
      oauthClient: createOAuthClient(),
      persistence: createPersistence({
        consumeState: async () => ({
          encryptedCodeVerifier: encryptedVerifier,
          encryptionVersion: 1,
        }),
        storePendingAuthorization: async () => {
          throw new Error("db-secret-error");
        },
      }),
    },
    { now: () => FIXED_NOW },
  );

  await assert.rejects(flow.complete(MOTORISTA_ID, { code: CODE, state: STATE }), {
    message: COMPLETE_ERROR,
  });
});

test("adaptação Supabase persiste pendência sem expor segredos no retorno", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client: PixOAuthRpcClient = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (name === "pix_oauth_state_consume") {
        return {
          data: [
            {
              encrypted_code_verifier: encryptOAuthSecret(VERIFIER, ENCRYPTION_KEY),
              envelope_version: 1,
            },
          ],
          error: null,
        };
      }
      if (name === "pix_oauth_pending_authorization_upsert") {
        return { data: PENDING_EXPIRES_AT, error: null };
      }
      return { data: "80000000-0000-4000-8000-000000000099", error: null };
    },
  };
  const persistence = createPixOAuthSupabasePersistenceFromClient(client);
  const flow = createPixMercadoPagoOAuthFlow(
    {
      encryptionKey: ENCRYPTION_KEY,
      oauthClient: createOAuthClient(),
      persistence,
    },
    { now: () => FIXED_NOW },
  );

  const result = await flow.complete(MOTORISTA_ID, { code: CODE, state: STATE });
  const pendingCall = calls.find(({ name }) => name === "pix_oauth_pending_authorization_upsert");

  assert.ok(pendingCall);
  assert.equal(pendingCall.args["_mercadopago_user_id"], TOKEN_SET.userId);
  assert.equal(typeof pendingCall.args["_access_token_encrypted"], "string");
  assert.equal(typeof pendingCall.args["_refresh_token_encrypted"], "string");
  assert.notEqual(pendingCall.args["_access_token_encrypted"], TOKEN_SET.accessToken);
  assert.equal(result.pending, true);
  assert.equal("accessToken" in result, false);
  assert.equal("refreshToken" in result, false);
});
