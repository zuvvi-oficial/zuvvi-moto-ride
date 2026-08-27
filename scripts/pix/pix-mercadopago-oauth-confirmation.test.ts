import assert from "node:assert/strict";
import test from "node:test";
import {
  cancelPixOAuthPendingAuthorization,
  confirmPixOAuthPendingAuthorization,
  getPixOAuthPendingAuthorizationStatus,
  type PixOAuthRpcClient,
} from "../../src/lib/pix-mercadopago-oauth-supabase.server.js";

const MOTORISTA_ID = "13000000-0000-4000-8000-000000000001";
const PLATFORM_USER_ID = "5555555555";
const EXPIRES_AT = "2026-08-27T20:40:00.000Z";
const PERSISTENCE_ERROR = "Não foi possível persistir a conexão OAuth com segurança.";

function createClient(
  handler: (
    functionName: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>,
): PixOAuthRpcClient {
  return { rpc: handler };
}

test("status pendente retorna somente dica mascarada, reconexão e validade", async () => {
  const calls: Array<{ functionName: string; args: Record<string, unknown> }> = [];
  const client = createClient(async (functionName, args) => {
    calls.push({ functionName, args });
    return {
      data: {
        confirmation_expires_at: EXPIRES_AT,
        account_hint: "4321",
        reconnection: true,
      },
      error: null,
    };
  });

  const result = await getPixOAuthPendingAuthorizationStatus(client, MOTORISTA_ID);

  assert.deepEqual(result, {
    pendente: true,
    confirmationExpiresAt: EXPIRES_AT,
    accountHint: "4321",
    reconexao: true,
  });
  assert.deepEqual(calls, [
    {
      functionName: "pix_oauth_pending_authorization_summary",
      args: { _motorista_id: MOTORISTA_ID },
    },
  ]);
  assert.equal("mercadoPagoUserId" in result, false);
});

test("status sem pendência não inventa conta ou token", async () => {
  const client = createClient(async () => ({ data: null, error: null }));
  const result = await getPixOAuthPendingAuthorizationStatus(client, MOTORISTA_ID);

  assert.deepEqual(result, { pendente: false });
  assert.deepEqual(Object.keys(result), ["pendente"]);
});

test("cancelamento usa apenas motorista autenticado e retorna booleano", async () => {
  const client = createClient(async (functionName, args) => {
    assert.equal(functionName, "pix_oauth_pending_authorization_cancel");
    assert.deepEqual(args, { _motorista_id: MOTORISTA_ID });
    return { data: true, error: null };
  });

  assert.equal(await cancelPixOAuthPendingAuthorization(client, MOTORISTA_ID), true);
});

test("confirmação envia a conta integradora somente à RPC privilegiada", async () => {
  const client = createClient(async (functionName, args) => {
    assert.equal(functionName, "pix_oauth_pending_authorization_confirm");
    assert.deepEqual(args, {
      _motorista_id: MOTORISTA_ID,
      _platform_mercadopago_user_id: PLATFORM_USER_ID,
    });
    return { data: "connected", error: null };
  });

  assert.deepEqual(
    await confirmPixOAuthPendingAuthorization(client, MOTORISTA_ID, PLATFORM_USER_ID),
    { conectado: true, jaEstavaConectado: false },
  );
});

test("confirmação mapeia sucesso novo e repetição idempotente", async () => {
  for (const [providerResult, expected] of [
    ["connected", { conectado: true, jaEstavaConectado: false }],
    ["already_connected", { conectado: true, jaEstavaConectado: true }],
  ] as const) {
    const client = createClient(async () => ({ data: providerResult, error: null }));

    assert.deepEqual(
      await confirmPixOAuthPendingAuthorization(client, MOTORISTA_ID, PLATFORM_USER_ID),
      expected,
    );
  }
});

test("confirmação mapeia falhas sanitizadas inclusive conta da plataforma", async () => {
  for (const [providerResult, expected] of [
    ["expired", { conectado: false, motivo: "expirada" }],
    ["not_found", { conectado: false, motivo: "ausente" }],
    ["ownership_conflict", { conectado: false, motivo: "conta_de_outro_motorista" }],
    ["platform_account", { conectado: false, motivo: "conta_da_plataforma" }],
  ] as const) {
    const client = createClient(async () => ({ data: providerResult, error: null }));
    assert.deepEqual(
      await confirmPixOAuthPendingAuthorization(client, MOTORISTA_ID, PLATFORM_USER_ID),
      expected,
    );
  }
});

test("adaptador rejeita motorista ou platform user inválidos antes do RPC", async () => {
  let calls = 0;
  const client = createClient(async () => {
    calls += 1;
    return { data: null, error: null };
  });

  await assert.rejects(getPixOAuthPendingAuthorizationStatus(client, "invalid"), {
    message: PERSISTENCE_ERROR,
  });
  await assert.rejects(cancelPixOAuthPendingAuthorization(client, "invalid"), {
    message: PERSISTENCE_ERROR,
  });
  await assert.rejects(confirmPixOAuthPendingAuthorization(client, "invalid", PLATFORM_USER_ID), {
    message: PERSISTENCE_ERROR,
  });
  await assert.rejects(confirmPixOAuthPendingAuthorization(client, MOTORISTA_ID, "invalid"), {
    message: PERSISTENCE_ERROR,
  });
  assert.equal(calls, 0);
});

test("RPC com erro ou retorno inesperado falha de modo sanitizado", async () => {
  const failingClient = createClient(async () => ({
    data: null,
    error: { code: "secret-db-error" },
  }));
  await assert.rejects(getPixOAuthPendingAuthorizationStatus(failingClient, MOTORISTA_ID), {
    message: PERSISTENCE_ERROR,
  });
  await assert.rejects(cancelPixOAuthPendingAuthorization(failingClient, MOTORISTA_ID), {
    message: PERSISTENCE_ERROR,
  });
  await assert.rejects(
    confirmPixOAuthPendingAuthorization(failingClient, MOTORISTA_ID, PLATFORM_USER_ID),
    { message: PERSISTENCE_ERROR },
  );

  const malformedStatus = createClient(async () => ({ data: "not-an-object", error: null }));
  await assert.rejects(getPixOAuthPendingAuthorizationStatus(malformedStatus, MOTORISTA_ID), {
    message: PERSISTENCE_ERROR,
  });

  const malformedCancel = createClient(async () => ({ data: "yes", error: null }));
  await assert.rejects(cancelPixOAuthPendingAuthorization(malformedCancel, MOTORISTA_ID), {
    message: PERSISTENCE_ERROR,
  });

  const malformedConfirm = createClient(async () => ({ data: "unexpected", error: null }));
  await assert.rejects(
    confirmPixOAuthPendingAuthorization(malformedConfirm, MOTORISTA_ID, PLATFORM_USER_ID),
    { message: PERSISTENCE_ERROR },
  );
});
