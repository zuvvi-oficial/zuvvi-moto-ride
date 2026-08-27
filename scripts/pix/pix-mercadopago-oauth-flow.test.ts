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
      generateState: () => STATE,
      generateVerifier: () => VERIFIER,
    },
  );

  const result = await flow.startConnection(MOTORISTA_ID);

  assert.deepEqual(Object.keys(result), ["authorizationUrl"]);
  assert.equal(capturedState, STATE);
  assert.equal(capturedChallenge.length, 43);
  assert.equal(persisted?.motoristaId, MOTORISTA_ID);
  assert.equal(persisted?.stateHash, await hashOAuthState(STATE));
  assert.equal(persisted?.encryptionVersion, 1);
  assert.equal(persisted?.expiresAt, new Date(FIXED_NOW + 5 * 60_000).toISOString());
  assert.notEqual(persisted?.encryptedCodeVerifier, VERIFIER);
  assert.equal(
    await decryptOAuthSecret(persisted?.encryptedCodeVerifier ?? "", ENCRYPTION_KEY),
    VERIFIER,
  );
  assert.equal(JSON.stringify(result).includes(VERIFIER), false);
});

test("falha ao persistir início não devolve URL nem detalhe interno", async () => {
  const flow = createPixMercadoPagoOAuthFlow(
    {
      encryptionKey: ENCRYPTION_KEY,
      oauthClient: createOAuthClient(),
      persistence: createPersistence({
        createState: async () => {
          throw new Error("database-secret-detail");
        },
      }),
    },
    { generateState: () => STATE, generateVerifier: () => VERIFIER },
  );

  await assert.rejects(() => flow.startConnection(MOTORISTA_ID), {
    message: "Não foi possível iniciar a conexão segura com o Mercado Pago.",
  });
});

test("conclusão consome state, cifra tokens e persiste somente autorização pendente", async () => {
  const encryptedVerifier = await encryptOAuthSecret(VERIFIER, ENCRYPTION_KEY);
  let consumedInput: { motoristaId: string; stateHash: string } | undefined;
  let exchangeInput: { code: string; codeVerifier: string } | undefined;
  let persisted: PixOAuthPendingAuthorizationRecord | undefined;
  const flow = createPixMercadoPagoOAuthFlow({
    encryptionKey: ENCRYPTION_KEY,
    oauthClient: createOAuthClient({
      exchangeAuthorizationCode: async (input) => {
        exchangeInput = input;
        return TOKEN_SET;
      },
    }),
    persistence: createPersistence({
      consumeState: async (input) => {
        consumedInput = input;
        return { encryptedCodeVerifier: encryptedVerifier, encryptionVersion: 1 };
      },
      storePendingAuthorization: async (input) => {
        persisted = input;
        return { confirmationExpiresAt: PENDING_EXPIRES_AT };
      },
    }),
  });

  const result = await flow.completeConnection({
    motoristaId: MOTORISTA_ID,
    code: CODE,
    state: STATE,
  });

  assert.deepEqual(result, {
    pending: true,
    confirmationExpiresAt: PENDING_EXPIRES_AT,
  });
  assert.deepEqual(consumedInput, {
    motoristaId: MOTORISTA_ID,
    stateHash: await hashOAuthState(STATE),
  });
  assert.deepEqual(exchangeInput, { code: CODE, codeVerifier: VERIFIER });
  assert.equal(persisted?.motoristaId, MOTORISTA_ID);
  assert.equal(persisted?.mercadoPagoUserId, TOKEN_SET.userId);
  assert.equal(persisted?.encryptionVersion, 1);
  assert.equal(persisted?.expiresAt, EXPIRES_AT);
  assert.equal(persisted?.scope, TOKEN_SET.scope);
  assert.equal(persisted?.tokenType, TOKEN_SET.tokenType);
  assert.notEqual(persisted?.encryptedAccessToken, TOKEN_SET.accessToken);
  assert.notEqual(persisted?.encryptedRefreshToken, TOKEN_SET.refreshToken);
  assert.equal(
    await decryptOAuthSecret(persisted?.encryptedAccessToken ?? "", ENCRYPTION_KEY),
    TOKEN_SET.accessToken,
  );
  assert.equal(
    await decryptOAuthSecret(persisted?.encryptedRefreshToken ?? "", ENCRYPTION_KEY),
    TOKEN_SET.refreshToken,
  );
});

test("state consumido não pode ser reutilizado", async () => {
  const encryptedVerifier = await encryptOAuthSecret(VERIFIER, ENCRYPTION_KEY);
  let available = true;
  let exchanges = 0;
  let pendingWrites = 0;
  const flow = createPixMercadoPagoOAuthFlow({
    encryptionKey: ENCRYPTION_KEY,
    oauthClient: createOAuthClient({
      exchangeAuthorizationCode: async () => {
        exchanges += 1;
        return TOKEN_SET;
      },
    }),
    persistence: createPersistence({
      consumeState: async () => {
        if (!available) return null;
        available = false;
        return { encryptedCodeVerifier: encryptedVerifier, encryptionVersion: 1 };
      },
      storePendingAuthorization: async () => {
        pendingWrites += 1;
        return { confirmationExpiresAt: PENDING_EXPIRES_AT };
      },
    }),
  });

  await flow.completeConnection({ motoristaId: MOTORISTA_ID, code: CODE, state: STATE });
  await assert.rejects(
    () => flow.completeConnection({ motoristaId: MOTORISTA_ID, code: CODE, state: STATE }),
    { message: COMPLETE_ERROR },
  );
  assert.equal(exchanges, 1);
  assert.equal(pendingWrites, 1);
});

test("state ausente, expirado ou de outro motorista falha antes do provedor", async () => {
  let exchanges = 0;
  let pendingWrites = 0;
  let consumedMotoristaId = "";
  const flow = createPixMercadoPagoOAuthFlow({
    encryptionKey: ENCRYPTION_KEY,
    oauthClient: createOAuthClient({
      exchangeAuthorizationCode: async () => {
        exchanges += 1;
        return TOKEN_SET;
      },
    }),
    persistence: createPersistence({
      consumeState: async ({ motoristaId }) => {
        consumedMotoristaId = motoristaId;
        return null;
      },
      storePendingAuthorization: async () => {
        pendingWrites += 1;
        return { confirmationExpiresAt: PENDING_EXPIRES_AT };
      },
    }),
  });

  await assert.rejects(
    () => flow.completeConnection({ motoristaId: OUTRO_MOTORISTA_ID, code: CODE, state: STATE }),
    { message: COMPLETE_ERROR },
  );
  assert.equal(consumedMotoristaId, OUTRO_MOTORISTA_ID);
  assert.equal(exchanges, 0);
  assert.equal(pendingWrites, 0);
});

test("versão de envelope desconhecida falha antes de trocar o code", async () => {
  let exchanges = 0;
  const flow = createPixMercadoPagoOAuthFlow({
    encryptionKey: ENCRYPTION_KEY,
    oauthClient: createOAuthClient({
      exchangeAuthorizationCode: async () => {
        exchanges += 1;
        return TOKEN_SET;
      },
    }),
    persistence: createPersistence({
      consumeState: async () => ({
        encryptedCodeVerifier: "provider-secret-must-not-be-read",
        encryptionVersion: 2,
      }),
    }),
  });

  await assert.rejects(
    () => flow.completeConnection({ motoristaId: MOTORISTA_ID, code: CODE, state: STATE }),
    { message: COMPLETE_ERROR },
  );
  assert.equal(exchanges, 0);
});

test("falhas do provedor ou da persistência são sanitizadas e não vazam tokens", async () => {
  const encryptedVerifier = await encryptOAuthSecret(VERIFIER, ENCRYPTION_KEY);
  const providerFailure = createPixMercadoPagoOAuthFlow({
    encryptionKey: ENCRYPTION_KEY,
    oauthClient: createOAuthClient({
      exchangeAuthorizationCode: async () => {
        throw new Error("provider-secret-detail");
      },
    }),
    persistence: createPersistence({
      consumeState: async () => ({
        encryptedCodeVerifier: encryptedVerifier,
        encryptionVersion: 1,
      }),
    }),
  });
  const persistenceFailure = createPixMercadoPagoOAuthFlow({
    encryptionKey: ENCRYPTION_KEY,
    oauthClient: createOAuthClient(),
    persistence: createPersistence({
      consumeState: async () => ({
        encryptedCodeVerifier: encryptedVerifier,
        encryptionVersion: 1,
      }),
      storePendingAuthorization: async () => {
        throw new Error(`database-secret ${TOKEN_SET.accessToken}`);
      },
    }),
  });

  for (const flow of [providerFailure, persistenceFailure]) {
    await assert.rejects(
      () => flow.completeConnection({ motoristaId: MOTORISTA_ID, code: CODE, state: STATE }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, COMPLETE_ERROR);
        assert.equal(error.message.includes("secret"), false);
        assert.equal(error.message.includes(TOKEN_SET.accessToken), false);
        return true;
      },
    );
  }
});

test("entradas inválidas falham antes de consumir state", async () => {
  let consumes = 0;
  const flow = createPixMercadoPagoOAuthFlow({
    encryptionKey: ENCRYPTION_KEY,
    oauthClient: createOAuthClient(),
    persistence: createPersistence({
      consumeState: async () => {
        consumes += 1;
        return null;
      },
    }),
  });

  await assert.rejects(
    () => flow.completeConnection({ motoristaId: "invalid", code: CODE, state: STATE }),
    { message: COMPLETE_ERROR },
  );
  await assert.rejects(
    () => flow.completeConnection({ motoristaId: MOTORISTA_ID, code: " abc ", state: STATE }),
    { message: COMPLETE_ERROR },
  );
  await assert.rejects(
    () => flow.completeConnection({ motoristaId: MOTORISTA_ID, code: CODE, state: "short" }),
    { message: COMPLETE_ERROR },
  );
  assert.equal(consumes, 0);
});

test("adaptador chama exatamente os três RPCs e mapeia autorização pendente", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client: PixOAuthRpcClient = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (name === "pix_oauth_state_create") {
        return { data: "90000000-0000-4000-8000-000000000001", error: null };
      }
      if (name === "pix_oauth_state_consume") {
        return {
          data: [{ encrypted_code_verifier: "v1.envelope", envelope_version: 1 }],
          error: null,
        };
      }
      if (name === "pix_oauth_pending_authorization_upsert") {
        return { data: PENDING_EXPIRES_AT, error: null };
      }
      return { data: null, error: { code: "unexpected_rpc" } };
    },
  };
  const persistence = createPixOAuthSupabasePersistenceFromClient(client);

  await persistence.createState({
    motoristaId: MOTORISTA_ID,
    stateHash: "a".repeat(64),
    encryptedCodeVerifier: "v1.envelope",
    encryptionVersion: 1,
    expiresAt: EXPIRES_AT,
  });
  const consumed = await persistence.consumeState({
    motoristaId: MOTORISTA_ID,
    stateHash: "a".repeat(64),
  });
  const pending = await persistence.storePendingAuthorization({
    motoristaId: MOTORISTA_ID,
    mercadoPagoUserId: TOKEN_SET.userId,
    encryptedAccessToken: "v1.access-envelope",
    encryptedRefreshToken: "v1.refresh-envelope",
    encryptionVersion: 1,
    expiresAt: EXPIRES_AT,
    scope: TOKEN_SET.scope,
    tokenType: TOKEN_SET.tokenType,
  });

  assert.deepEqual(consumed, {
    encryptedCodeVerifier: "v1.envelope",
    encryptionVersion: 1,
  });
  assert.deepEqual(pending, { confirmationExpiresAt: PENDING_EXPIRES_AT });
  assert.deepEqual(calls, [
    {
      name: "pix_oauth_state_create",
      args: {
        _motorista_id: MOTORISTA_ID,
        _state_hash: "a".repeat(64),
        _code_verifier_encrypted: "v1.envelope",
        _encryption_version: 1,
        _expires_at: EXPIRES_AT,
      },
    },
    {
      name: "pix_oauth_state_consume",
      args: { _motorista_id: MOTORISTA_ID, _state_hash: "a".repeat(64) },
    },
    {
      name: "pix_oauth_pending_authorization_upsert",
      args: {
        _motorista_id: MOTORISTA_ID,
        _mercadopago_user_id: TOKEN_SET.userId,
        _access_token_encrypted: "v1.access-envelope",
        _refresh_token_encrypted: "v1.refresh-envelope",
        _encryption_version: 1,
        _token_expires_at: EXPIRES_AT,
        _scope: TOKEN_SET.scope,
        _token_type: TOKEN_SET.tokenType,
      },
    },
  ]);
});

test("adaptador converte ausência em null e rejeita RPC malformado ou com erro", async () => {
  const empty = createPixOAuthSupabasePersistenceFromClient({
    rpc: async () => ({ data: [], error: null }),
  });
  const malformed = createPixOAuthSupabasePersistenceFromClient({
    rpc: async () => ({ data: [{ envelope_version: 1 }], error: null }),
  });
  const failed = createPixOAuthSupabasePersistenceFromClient({
    rpc: async () => ({ data: null, error: { message: "database-secret-detail" } }),
  });

  assert.equal(
    await empty.consumeState({ motoristaId: MOTORISTA_ID, stateHash: "a".repeat(64) }),
    null,
  );
  await assert.rejects(
    () => malformed.consumeState({ motoristaId: MOTORISTA_ID, stateHash: "a".repeat(64) }),
    { message: "Não foi possível persistir a conexão OAuth com segurança." },
  );
  await assert.rejects(
    () =>
      failed.storePendingAuthorization({
        motoristaId: MOTORISTA_ID,
        mercadoPagoUserId: TOKEN_SET.userId,
        encryptedAccessToken: "v1.access",
        encryptedRefreshToken: "v1.refresh",
        encryptionVersion: 1,
        expiresAt: EXPIRES_AT,
      }),
    { message: "Não foi possível persistir a conexão OAuth com segurança." },
  );
});