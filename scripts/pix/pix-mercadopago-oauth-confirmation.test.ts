import assert from "node:assert/strict";
import test from "node:test";
import {
  confirmPixOAuthPendingAuthorization,
  getPixOAuthPendingAuthorizationStatus,
  type PixOAuthRpcClient,
} from "../../src/lib/pix-mercadopago-oauth-supabase.server.js";

const MOTORISTA_ID = "13000000-0000-4000-8000-000000000001";
const EXPIRES_AT = "2026-08-27T20:40:00.000Z";
const PERSISTENCE_ERROR = "Não foi possível persistir a conexão OAuth com segurança.";

function createClient(
  handler: (functionName: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>,
): PixOAuthRpcClient {
  return { rpc: handler };
}

test("status pendente retorna somente booleano e validade", async () => {
  const calls: Array<{ functionName: string; args: Record<string, unknown> }> = [];
  const client = createClient(async (functionName, args) => {
    calls.push({ functionName, args });
    return { data: EXPIRES_AT, error: null };
  });

  const result = await getPixOAuthPendingAuthorizationStatus(client, MOTORISTA_ID);

  assert.deepEqual(result, {
    pendente: true,
    confirmationExpiresAt: EXPIRES_AT,
  });
  assert.deepEqual(calls, [
    {
      functionName: "pix_oauth_pending_authorization_status",
      args: { _motorista_id: MOTORISTA_ID },
    },
  ]);
});

test("status sem pendência não inventa conta ou token", async () => {
  const client = createClient(async () => ({ data: null, error: null }));
  const result = await getPixOAuthPendingAuthorizationStatus(client, MOTORISTA_ID);

  assert.deepEqual(result, { pendente: false });
  assert.deepEqual(Object.keys(result), ["pendente"]);
});

test("confirmação mapeia sucesso novo e repetição idempotente", async () => {
  for (const [providerResult, expected] of [
    ["connected", { conectado: true, jaEstavaConectado: false }],
    ["already_connected", { conectado: true, jaEstavaConectado: true }],
  ] as const) {
    const client = createClient(async (functionName, args) => {
      assert.equal(functionName, "pix_oauth_pending_authorization_confirm");
      assert.deepEqual(args, { _motorista_id: MOTORISTA_ID });
      return { data: providerResult, error: null };
    });

    assert.deepEqual(await confirmPixOAuthPendingAuthorization(client, MOTORISTA_ID), expected);
  }
});

test("confirmação mapeia expiração, ausência e conflito sem detalhe interno", async () => {
  for (const [providerResult, expected] of [
    ["expired", { conectado: false, motivo: "expirada" }],
    ["not_found", { conectado: false, motivo: "ausente" }],
    ["ownership_conflict", { conectado: false, motivo: "conta_de_outro_motorista" }],
  ] as const) {
    const client = createClient(async () => ({ data: providerResult, error: null }));
    assert.deepEqual(await confirmPixOAuthPendingAuthorization(client, MOTORISTA_ID), expected);
  }
});

test("adaptador rejeita motorista inválido antes do RPC", async () => {
  let calls = 0;
  const client = createClient(async () => {
    calls += 1;
    return { data: null, error: null };
  });

  await assert.rejects(getPixOAuthPendingAuthorizationStatus(client, "invalid"), {
    message: PERSISTENCE_ERROR,
  });
  await assert.rejects(confirmPixOAuthPendingAuthorization(client, "invalid"), {
    message: PERSISTENCE_ERROR,
  });
  assert.equal(calls, 0);
});

test("RPC com erro ou retorno inesperado falha de modo sanitizado", async () => {
  const failingClient = createClient(async () => ({ data: null, error: { code: "secret-db-error" } }));
  await assert.rejects(getPixOAuthPendingAuthorizationStatus(failingClient, MOTORISTA_ID), {
    message: PERSISTENCE_ERROR,
  });
  await assert.rejects(confirmPixOAuthPendingAuthorization(failingClient, MOTORISTA_ID), {
    message: PERSISTENCE_ERROR,
  });

  const malformedStatus = createClient(async () => ({ data: "not-a-date", error: null }));
  await assert.rejects(getPixOAuthPendingAuthorizationStatus(malformedStatus, MOTORISTA_ID), {
    message: PERSISTENCE_ERROR,
  });

  const malformedConfirm = createClient(async () => ({ data: "unexpected", error: null }));
  await assert.rejects(confirmPixOAuthPendingAuthorization(malformedConfirm, MOTORISTA_ID), {
    message: PERSISTENCE_ERROR,
  });
});
