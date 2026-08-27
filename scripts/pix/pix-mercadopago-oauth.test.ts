import assert from "node:assert/strict";
import test from "node:test";
import { createMercadoPagoOAuthClient } from "../../src/lib/pix-mercadopago-oauth.server.js";

const CLIENT_ID = "123456789";
const CLIENT_SECRET = "client-secret-test-only";
const REDIRECT_URI = "https://zuvvi.example/motorista/mercadopago-callback";
const STATE = "s".repeat(43);
const CODE_CHALLENGE = "c".repeat(43);
const CODE_VERIFIER = "v".repeat(43);
const FIXED_NOW = 1_700_000_000_000;

const VALID_TOKEN_RESPONSE = {
  access_token: "access-token-test-only",
  refresh_token: "refresh-token-test-only",
  user_id: "987654321",
  expires_in: 15_552_000,
  scope: "offline_access payments write",
  token_type: "bearer",
  public_key: "public-key-not-returned",
};

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function clientWith(fetchImplementation: typeof fetch, timeoutMs = 10_000) {
  return createMercadoPagoOAuthClient(
    {
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      redirectUri: REDIRECT_URI,
      timeoutMs,
    },
    { fetch: fetchImplementation, now: () => FIXED_NOW },
  );
}

test("monta URL oficial com state e PKCE S256 sem expor segredo ou verifier", () => {
  const client = clientWith(async () => response(VALID_TOKEN_RESPONSE));
  const url = new URL(
    client.buildAuthorizationUrl({ state: STATE, codeChallenge: CODE_CHALLENGE }),
  );

  assert.equal(url.origin + url.pathname, "https://auth.mercadopago.com.br/authorization");
  assert.equal(url.searchParams.get("client_id"), CLIENT_ID);
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("platform_id"), "mp");
  assert.equal(url.searchParams.get("state"), STATE);
  assert.equal(url.searchParams.get("redirect_uri"), REDIRECT_URI);
  assert.equal(url.searchParams.get("code_challenge"), CODE_CHALLENGE);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.toString().includes(CLIENT_SECRET), false);
  assert.equal(url.toString().includes(CODE_VERIFIER), false);
});

test("troca código enviando PKCE e retorna somente credenciais validadas", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const client = clientWith(async (input, init) => {
    capturedUrl = String(input);
    capturedInit = init;
    return response(VALID_TOKEN_RESPONSE);
  });

  const result = await client.exchangeAuthorizationCode({
    code: "TG-AUTHORIZATION-CODE",
    codeVerifier: CODE_VERIFIER,
  });

  assert.equal(capturedUrl, "https://api.mercadopago.com/oauth/token");
  assert.equal(capturedInit?.method, "POST");
  assert.equal(capturedInit?.redirect, undefined);
  assert.deepEqual(JSON.parse(String(capturedInit?.body)), {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "authorization_code",
    code: "TG-AUTHORIZATION-CODE",
    redirect_uri: REDIRECT_URI,
    code_verifier: CODE_VERIFIER,
  });
  assert.deepEqual(result, {
    userId: "987654321",
    accessToken: "access-token-test-only",
    refreshToken: "refresh-token-test-only",
    expiresInSeconds: 15_552_000,
    expiresAt: new Date(FIXED_NOW + 15_552_000_000).toISOString(),
    scope: "offline_access payments write",
    tokenType: "bearer",
  });
  assert.equal("publicKey" in result, false);
});

test("renova credenciais e exige rotação completa do retorno", async () => {
  let requestBody: Record<string, unknown> | undefined;
  const client = clientWith(async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return response({
      ...VALID_TOKEN_RESPONSE,
      access_token: "rotated-access-token",
      refresh_token: "rotated-refresh-token",
    });
  });

  const result = await client.refreshAccessToken("old-refresh-token");

  assert.deepEqual(requestBody, {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: "old-refresh-token",
  });
  assert.equal(result.accessToken, "rotated-access-token");
  assert.equal(result.refreshToken, "rotated-refresh-token");
});

test("identifica user_id da própria aplicação via client_credentials sem retornar token", async () => {
  let requestBody: Record<string, unknown> | undefined;
  const client = clientWith(async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return response({
      access_token: "platform-access-token-never-returned",
      token_type: "bearer",
      expires_in: 21_600,
      user_id: 5555555555,
    });
  });

  const result = await client.getApplicationOwnerUserId();

  assert.deepEqual(requestBody, {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "client_credentials",
  });
  assert.equal(result, "5555555555");
  assert.equal(typeof result, "string");
  assert.equal(result.includes("platform-access-token-never-returned"), false);
});

test("client_credentials rejeita user_id inválido da aplicação", async () => {
  const client = clientWith(async () =>
    response({
      access_token: "platform-access-token-never-returned",
      expires_in: 21_600,
      user_id: "not-numeric",
    }),
  );

  await assert.rejects(() => client.getApplicationOwnerUserId(), {
    message: "Não foi possível concluir a comunicação segura com o Mercado Pago.",
  });
});

test("normaliza user_id numérico seguro", async () => {
  const client = clientWith(async () => response({ ...VALID_TOKEN_RESPONSE, user_id: 123456 }));
  const result = await client.exchangeAuthorizationCode({
    code: "TG-CODE",
    codeVerifier: CODE_VERIFIER,
  });

  assert.equal(result.userId, "123456");
});

test("rejeita callback inseguro ou com parâmetros dinâmicos", () => {
  assert.throws(
    () =>
      createMercadoPagoOAuthClient({
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        redirectUri: "http://zuvvi.example/callback",
      }),
    { message: "Parâmetros OAuth Mercado Pago inválidos." },
  );
  assert.throws(
    () =>
      createMercadoPagoOAuthClient({
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        redirectUri: "https://zuvvi.example/callback?motorista=123",
      }),
    { message: "Parâmetros OAuth Mercado Pago inválidos." },
  );
});

test("rejeita state, challenge, verifier e código inválidos antes da rede", async () => {
  let calls = 0;
  const client = clientWith(async () => {
    calls += 1;
    return response(VALID_TOKEN_RESPONSE);
  });

  assert.throws(
    () => client.buildAuthorizationUrl({ state: "curto", codeChallenge: CODE_CHALLENGE }),
    { message: "Parâmetros OAuth Mercado Pago inválidos." },
  );
  assert.throws(
    () => client.buildAuthorizationUrl({ state: STATE, codeChallenge: "!".repeat(43) }),
    { message: "Parâmetros OAuth Mercado Pago inválidos." },
  );
  await assert.rejects(
    () => client.exchangeAuthorizationCode({ code: "abc", codeVerifier: CODE_VERIFIER }),
    { message: "Parâmetros OAuth Mercado Pago inválidos." },
  );
  await assert.rejects(
    () => client.exchangeAuthorizationCode({ code: "TG-CODE", codeVerifier: "curto" }),
    { message: "Parâmetros OAuth Mercado Pago inválidos." },
  );
  assert.equal(calls, 0);
});

test("rejeita HTTP não aprovado sem vazar resposta do provedor", async () => {
  const providerSecret = "provider-detail-must-not-leak";
  const client = clientWith(async () => response({ message: providerSecret }, 401));

  await assert.rejects(
    () =>
      client.exchangeAuthorizationCode({
        code: "TG-CODE",
        codeVerifier: CODE_VERIFIER,
      }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(
        error.message,
        "Não foi possível concluir a comunicação segura com o Mercado Pago.",
      );
      assert.equal(error.message.includes(providerSecret), false);
      assert.equal(error.message.includes(CLIENT_SECRET), false);
      return true;
    },
  );
});

test("rejeita timeout de rede com erro sanitizado", async () => {
  const client = clientWith(
    (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("network-secret")), {
          once: true,
        });
      }),
    5,
  );

  await assert.rejects(() => client.refreshAccessToken("refresh-token"), {
    message: "Não foi possível concluir a comunicação segura com o Mercado Pago.",
  });
});

test("rejeita resposta excessiva ou JSON inválido", async () => {
  const excessiveClient = clientWith(async () => new Response("x".repeat(65_537)));
  const invalidJsonClient = clientWith(async () => new Response("not-json"));

  await assert.rejects(() => excessiveClient.refreshAccessToken("refresh-token"), {
    message: "Não foi possível concluir a comunicação segura com o Mercado Pago.",
  });
  await assert.rejects(() => invalidJsonClient.refreshAccessToken("refresh-token"), {
    message: "Não foi possível concluir a comunicação segura com o Mercado Pago.",
  });
});

test("rejeita resposta sem credenciais completas ou com validade inválida", async () => {
  const invalidPayloads = [
    { ...VALID_TOKEN_RESPONSE, access_token: "" },
    { ...VALID_TOKEN_RESPONSE, refresh_token: undefined },
    { ...VALID_TOKEN_RESPONSE, user_id: "not-numeric" },
    { ...VALID_TOKEN_RESPONSE, expires_in: 0 },
    { ...VALID_TOKEN_RESPONSE, expires_in: 31_536_001 },
  ];

  for (const payload of invalidPayloads) {
    const client = clientWith(async () => response(payload));
    await assert.rejects(() => client.refreshAccessToken("refresh-token"), {
      message: "Não foi possível concluir a comunicação segura com o Mercado Pago.",
    });
  }
});
