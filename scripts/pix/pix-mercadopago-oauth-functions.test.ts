import assert from "node:assert/strict";
import test from "node:test";
import { parsePixMercadoPagoOAuthCompletionInput } from "../../src/lib/pix-mercadopago-oauth-input.js";
import {
  createPixMercadoPagoOAuthRuntime,
  type PixOAuthServerSupabaseClient,
} from "../../src/lib/pix-mercadopago-oauth-runtime.server.js";

const AUTH_USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_AUTH_USER_ID = "22222222-2222-4222-8222-222222222222";
const MOTORISTA_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_MOTORISTA_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CREATED_STATE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
const REDIRECT_URI = "https://zuvvi-moto-ride.lovable.app/motorista/mercadopago-callback";
const FIXED_NOW = Date.parse("2026-08-25T03:30:00.000Z");

type QueryCall = Readonly<{
  table: string;
  columns: string;
  column: string;
  value: unknown;
}>;

type RpcCall = Readonly<{
  functionName: string;
  args: Record<string, unknown>;
}>;

type FakeOptions = Readonly<{
  users?: Record<string, Readonly<{ id: string; is_motorista: boolean }>>;
  motoristas?: ReadonlyArray<string>;
  userQueryError?: boolean;
  motoristaQueryError?: boolean;
}>;

function createFakeSupabase(options: FakeOptions = {}) {
  const users: Record<string, Readonly<{ id: string; is_motorista: boolean }>> = options.users ??
  Object.freeze({
    [AUTH_USER_ID]: Object.freeze({ id: MOTORISTA_ID, is_motorista: true }),
    [OTHER_AUTH_USER_ID]: Object.freeze({ id: OTHER_MOTORISTA_ID, is_motorista: true }),
  });
  const motoristas = options.motoristas ?? [MOTORISTA_ID, OTHER_MOTORISTA_ID];
  const queryCalls: QueryCall[] = [];
  const rpcCalls: RpcCall[] = [];
  let encryptedVerifier: string | undefined;
  let stateMotoristaId: string | undefined;
  let stateHash: string | undefined;

  const client = {
    from(table: string) {
      return {
        select(columns: string) {
          return {
            eq(column: string, value: unknown) {
              queryCalls.push(Object.freeze({ table, columns, column, value }));

              return {
                async maybeSingle() {
                  if (table === "usuarios") {
                    return {
                      data: users[String(value)] ?? null,
                      error: options.userQueryError ? { code: "query_error" } : null,
                    };
                  }

                  if (table === "motoristas") {
                    return {
                      data: motoristas.includes(String(value)) ? { id: value } : null,
                      error: options.motoristaQueryError ? { code: "query_error" } : null,
                    };
                  }

                  return { data: null, error: { code: "unexpected_table" } };
                },
              };
            },
          };
        },
      };
    },

    async rpc(functionName: string, args: Record<string, unknown>) {
      rpcCalls.push(Object.freeze({ functionName, args: Object.freeze({ ...args }) }));

      if (functionName === "pix_oauth_state_create") {
        encryptedVerifier = String(args["_code_verifier_encrypted"]);
        stateMotoristaId = String(args["_motorista_id"]);
        stateHash = String(args["_state_hash"]);
        return { data: CREATED_STATE_ID, error: null };
      }

      if (functionName === "pix_oauth_state_consume") {
        const matches =
          args["_motorista_id"] === stateMotoristaId && args["_state_hash"] === stateHash;

        return {
          data: matches
            ? [
                {
                  encrypted_code_verifier: encryptedVerifier,
                  envelope_version: 1,
                },
              ]
            : [],
          error: null,
        };
      }

      if (functionName === "pix_oauth_credentials_upsert") {
        return { data: null, error: null };
      }

      return { data: null, error: { code: "unexpected_rpc" } };
    },
  } as PixOAuthServerSupabaseClient;

  return { client, queryCalls, rpcCalls };
}

function createRuntime(client: PixOAuthServerSupabaseClient, fetchImplementation?: typeof fetch) {
  return createPixMercadoPagoOAuthRuntime(
    {
      clientId: "client-id-test",
      clientSecret: "client-secret-test",
      encryptionKey: ENCRYPTION_KEY,
      redirectUri: REDIRECT_URI,
      supabaseClient: client,
    },
    {
      now: () => FIXED_NOW,
      ...(fetchImplementation ? { fetch: fetchImplementation } : {}),
    },
  );
}

test("início usa somente a identidade autenticada e não devolve state separado", async () => {
  const fake = createFakeSupabase();
  const runtime = createRuntime(fake.client);
  const result = await runtime.startForAuthenticatedUser(AUTH_USER_ID);
  const authorizationUrl = new URL(result.authorizationUrl);

  assert.deepEqual(Object.keys(result), ["authorizationUrl"]);
  assert.equal(authorizationUrl.origin, "https://auth.mercadopago.com.br");
  assert.equal(authorizationUrl.searchParams.get("redirect_uri"), REDIRECT_URI);
  assert.equal(authorizationUrl.searchParams.get("code_challenge_method"), "S256");
  assert.ok(authorizationUrl.searchParams.get("state"));
  assert.deepEqual(fake.queryCalls, [
    {
      table: "usuarios",
      columns: "id, is_motorista",
      column: "auth_user_id",
      value: AUTH_USER_ID,
    },
    { table: "motoristas", columns: "id", column: "id", value: MOTORISTA_ID },
  ]);
  assert.equal(fake.rpcCalls[0]?.functionName, "pix_oauth_state_create");
  assert.equal(fake.rpcCalls[0]?.args["_motorista_id"], MOTORISTA_ID);
});

test("conclusão mantém motorista da sessão e retorna somente confirmação", async () => {
  const fake = createFakeSupabase();
  const providerCalls: Array<{ input: string; body: Record<string, unknown> }> = [];
  const providerFetch = async (input: string | URL | Request, init?: RequestInit) => {
    providerCalls.push({
      input: String(input),
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    });

    return new Response(
      JSON.stringify({
        user_id: "987654321",
        access_token: "access-token-test",
        refresh_token: "refresh-token-test",
        expires_in: 21_600,
        scope: "offline_access read write",
        token_type: "Bearer",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  const runtime = createRuntime(fake.client, providerFetch);
  const started = await runtime.startForAuthenticatedUser(AUTH_USER_ID);
  const state = new URL(started.authorizationUrl).searchParams.get("state");
  assert.ok(state);

  const result = await runtime.completeForAuthenticatedUser(AUTH_USER_ID, {
    code: "authorization-code-test",
    state,
  });

  assert.deepEqual(result, { connected: true });
  assert.deepEqual(Object.keys(result), ["connected"]);
  assert.equal(providerCalls.length, 1);
  assert.equal(providerCalls[0]?.input, "https://api.mercadopago.com/oauth/token");
  assert.equal(providerCalls[0]?.body["code"], "authorization-code-test");
  assert.equal(typeof providerCalls[0]?.body["code_verifier"], "string");
  const upsert = fake.rpcCalls.find(
    ({ functionName }) => functionName === "pix_oauth_credentials_upsert",
  );
  assert.equal(upsert?.args["_motorista_id"], MOTORISTA_ID);
  assert.equal(upsert?.args["_mercadopago_user_id"], "987654321");
  assert.notEqual(upsert?.args["_access_token_encrypted"], "access-token-test");
  assert.notEqual(upsert?.args["_refresh_token_encrypted"], "refresh-token-test");
});

test("schema aceita somente code e state e rejeita identidade enviada pelo navegador", () => {
  const validInput = {
    code: "authorization-code-test",
    state: "s".repeat(43),
  };

  assert.deepEqual(parsePixMercadoPagoOAuthCompletionInput(validInput), validInput);
  for (const extra of [
    { motorista_id: MOTORISTA_ID },
    { motoristaId: MOTORISTA_ID },
    { usuario_id: MOTORISTA_ID },
    { status: "conectado" },
    { access_token: "forbidden" },
  ]) {
    assert.throws(() => parsePixMercadoPagoOAuthCompletionInput({ ...validInput, ...extra }), {
      message: "Parâmetros OAuth inválidos.",
    });
  }
});

test("configuração ausente ou inválida falha antes de consulta, RPC ou rede", () => {
  const fake = createFakeSupabase();
  let networkCalls = 0;
  const baseConfig = {
    clientId: "client-id-test",
    clientSecret: "client-secret-test",
    encryptionKey: ENCRYPTION_KEY,
    redirectUri: REDIRECT_URI,
    supabaseClient: fake.client,
  };

  for (const invalid of [
    { clientId: undefined },
    { clientSecret: undefined },
    { encryptionKey: undefined },
    { encryptionKey: Buffer.alloc(31).toString("base64") },
    { redirectUri: "http://inseguro.example/callback" },
  ]) {
    assert.throws(
      () =>
        createPixMercadoPagoOAuthRuntime(
          { ...baseConfig, ...invalid },
          {
            fetch: async () => {
              networkCalls += 1;
              throw new Error("network should not run");
            },
          },
        ),
      { message: "A conexão segura com o Mercado Pago não está disponível." },
    );
  }

  assert.equal(fake.queryCalls.length, 0);
  assert.equal(fake.rpcCalls.length, 0);
  assert.equal(networkCalls, 0);
});

test("usuário inválido, inexistente ou sem perfil de motorista falha antes do OAuth", async () => {
  const scenarios: Array<{
    authUserId: string;
    options?: FakeOptions;
    maximumQueries: number;
  }> = [
    { authUserId: "not-a-uuid", maximumQueries: 0 },
    { authUserId: AUTH_USER_ID, options: { users: {} }, maximumQueries: 1 },
    {
      authUserId: AUTH_USER_ID,
      options: { users: { [AUTH_USER_ID]: { id: MOTORISTA_ID, is_motorista: false } } },
      maximumQueries: 1,
    },
    {
      authUserId: AUTH_USER_ID,
      options: { motoristas: [] },
      maximumQueries: 2,
    },
    {
      authUserId: AUTH_USER_ID,
      options: { userQueryError: true },
      maximumQueries: 1,
    },
  ];

  for (const scenario of scenarios) {
    const fake = createFakeSupabase(scenario.options);
    const runtime = createRuntime(fake.client);
    await assert.rejects(runtime.startForAuthenticatedUser(scenario.authUserId), {
      message: "Não foi possível iniciar a conexão segura com o Mercado Pago.",
    });
    assert.ok(fake.queryCalls.length <= scenario.maximumQueries);
    assert.equal(fake.rpcCalls.length, 0);
  }
});

test("state criado por outro motorista é recusado antes de chamar o provedor", async () => {
  const fake = createFakeSupabase();
  let providerCalls = 0;
  const runtime = createRuntime(fake.client, async () => {
    providerCalls += 1;
    throw new Error("provider should not run");
  });
  const started = await runtime.startForAuthenticatedUser(AUTH_USER_ID);
  const state = new URL(started.authorizationUrl).searchParams.get("state");
  assert.ok(state);

  await assert.rejects(
    runtime.completeForAuthenticatedUser(OTHER_AUTH_USER_ID, {
      code: "authorization-code-test",
      state,
    }),
    { message: "Não foi possível concluir a conexão segura com o Mercado Pago." },
  );

  assert.equal(providerCalls, 0);
  assert.equal(
    fake.rpcCalls.filter(({ functionName }) => functionName === "pix_oauth_credentials_upsert")
      .length,
    0,
  );
});
