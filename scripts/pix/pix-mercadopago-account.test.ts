import assert from "node:assert/strict";
import test from "node:test";
import {
  disconnectPixMercadoPagoSafely,
  getPixMercadoPagoSecureConnectionStatus,
  type PixMercadoPagoAccountClient,
} from "../../src/lib/pix-mercadopago-account.server.js";

const MOTORISTA_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

type Options = Readonly<{
  publicAccountId?: string | null;
  credentialStatus?: string;
  credentialUserId?: string;
  revokedAt?: string | null;
  queryError?: boolean;
  rpcError?: boolean;
  disconnectResult?: unknown;
}>;

function createClient(options: Options = {}) {
  const calls: Array<Readonly<{ kind: string; name: string; args?: unknown }>> = [];
  const publicAccountId = options.publicAccountId === undefined ? "123456789" : options.publicAccountId;

  const client = {
    from(table: string) {
      return {
        select(columns: string) {
          return {
            eq(column: string, value: unknown) {
              calls.push({ kind: "query", name: table, args: { columns, column, value } });
              return {
                async maybeSingle() {
                  return {
                    data: { id: MOTORISTA_ID, conta_mercado_pago_id: publicAccountId },
                    error: options.queryError ? { code: "query_error" } : null,
                  };
                },
              };
            },
          };
        },
      };
    },
    async rpc(functionName: string, args: Record<string, unknown>) {
      calls.push({ kind: "rpc", name: functionName, args });
      if (options.rpcError) return { data: null, error: { code: "rpc_error" } };

      if (functionName === "pix_oauth_credentials_get") {
        return {
          data: [
            {
              motorista_id: MOTORISTA_ID,
              mercadopago_user_id: options.credentialUserId ?? "123456789",
              access_token_encrypted: "v1.access",
              refresh_token_encrypted: "v1.refresh",
              encryption_version: 1,
              expires_at: "2027-01-01T00:00:00.000Z",
              scope: "offline_access read write",
              token_type: "Bearer",
              connection_status: options.credentialStatus ?? "active",
              connected_at: "2026-08-25T00:00:00.000Z",
              last_refreshed_at: "2026-08-25T00:00:00.000Z",
              revoked_at: options.revokedAt ?? null,
            },
          ],
          error: null,
        };
      }

      if (functionName === "pix_oauth_disconnect_safe") {
        return { data: options.disconnectResult ?? "disconnected", error: null };
      }

      return { data: null, error: { code: "unexpected_rpc" } };
    },
  } as PixMercadoPagoAccountClient;

  return { client, calls };
}

test("status conectado exige projeção pública e credencial privada ativas e coerentes", async () => {
  const { client, calls } = createClient();
  assert.deepEqual(await getPixMercadoPagoSecureConnectionStatus(client, MOTORISTA_ID), {
    conectado: true,
  });
  assert.equal(calls.filter(({ name }) => name === "pix_oauth_credentials_get").length, 1);
});

test("status seguro reprova ausência pública, revogação e conta privada divergente", async () => {
  for (const options of [
    { publicAccountId: null },
    { credentialStatus: "revoked", revokedAt: "2026-08-25T01:00:00.000Z" },
    { credentialUserId: "999999999" },
  ] satisfies Options[]) {
    const { client } = createClient(options);
    assert.deepEqual(await getPixMercadoPagoSecureConnectionStatus(client, MOTORISTA_ID), {
      conectado: false,
    });
  }
});

test("falhas de consulta de status são sanitizadas", async () => {
  const { client } = createClient({ queryError: true });
  await assert.rejects(getPixMercadoPagoSecureConnectionStatus(client, MOTORISTA_ID), {
    message: "Não foi possível consultar a conexão segura com o Mercado Pago.",
  });
});

test("desconexão segura mapeia sucesso e bloqueios sem expor detalhes internos", async () => {
  for (const [providerResult, expected] of [
    ["disconnected", { desconectado: true }],
    ["blocked_active_pix", { desconectado: false, motivo: "corrida_pix_ativa" }],
    ["blocked_financial", { desconectado: false, motivo: "obrigacao_financeira" }],
  ] as const) {
    const { client, calls } = createClient({ disconnectResult: providerResult });
    assert.deepEqual(await disconnectPixMercadoPagoSafely(client, MOTORISTA_ID), expected);
    const call = calls.find(({ name }) => name === "pix_oauth_disconnect_safe");
    assert.deepEqual(call?.args, { _motorista_id: MOTORISTA_ID });
  }
});

test("resultado inesperado ou erro RPC de desconexão falha de modo sanitizado", async () => {
  for (const options of [{ disconnectResult: "unexpected" }, { rpcError: true }] satisfies Options[]) {
    const { client } = createClient(options);
    await assert.rejects(disconnectPixMercadoPagoSafely(client, MOTORISTA_ID), {
      message: "Não foi possível desconectar a conta Mercado Pago com segurança.",
    });
  }
});
