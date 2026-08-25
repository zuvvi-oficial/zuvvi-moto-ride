import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  garantirAccessTokenMotorista,
  montarCorpoCobrancaPix,
  type PixCredentialSnapshot,
} from "../../src/lib/pagamento.server";

const motoristaId = "11111111-1111-4111-8111-111111111111";
const mercadoPagoUserId = "123456789";
const now = Date.parse("2026-08-25T09:30:00.000Z");

function credential(overrides: Partial<PixCredentialSnapshot> = {}): PixCredentialSnapshot {
  return {
    motoristaId,
    mercadoPagoUserId,
    encryptedAccessToken: "enc-access",
    encryptedRefreshToken: "enc-refresh",
    encryptionVersion: 1,
    expiresAt: "2026-08-25T10:30:00.000Z",
    connectionStatus: "active",
    revokedAt: null,
    ...overrides,
  };
}

{
  let refreshCalls = 0;
  const token = await garantirAccessTokenMotorista(
    credential(),
    motoristaId,
    mercadoPagoUserId,
    "test-key",
    {
      now: () => now,
      decryptSecret: async (value) => {
        assert.equal(value, "enc-access");
        return "ACCESS-DO-MOTORISTA";
      },
      encryptSecret: async () => "unused",
      refreshAccessToken: async () => {
        refreshCalls += 1;
        throw new Error("não deveria renovar");
      },
      persistRefreshedCredentials: async () => {
        throw new Error("não deveria persistir");
      },
    },
  );

  assert.equal(token, "ACCESS-DO-MOTORISTA");
  assert.equal(refreshCalls, 0);
  console.log("MOTORISTA_CONECTADO_OK");
}

{
  await assert.rejects(
    () =>
      garantirAccessTokenMotorista(null, motoristaId, mercadoPagoUserId, "test-key", {
        now: () => now,
        decryptSecret: async () => "unused",
        encryptSecret: async () => "unused",
        refreshAccessToken: async () => {
          throw new Error("unused");
        },
        persistRefreshedCredentials: async () => undefined,
      }),
    /não está conectada ou válida/,
  );
  console.log("MOTORISTA_DESCONECTADO_BLOQUEADO_OK");
}

{
  let persisted = false;
  let decryptedRefresh = false;
  const token = await garantirAccessTokenMotorista(
    credential({ expiresAt: "2026-08-25T09:29:00.000Z" }),
    motoristaId,
    mercadoPagoUserId,
    "test-key",
    {
      now: () => now,
      decryptSecret: async (value) => {
        assert.equal(value, "enc-refresh");
        decryptedRefresh = true;
        return "REFRESH-ANTIGO";
      },
      encryptSecret: async (value) => `encrypted:${value}`,
      refreshAccessToken: async (value) => {
        assert.equal(value, "REFRESH-ANTIGO");
        return {
          userId: mercadoPagoUserId,
          accessToken: "ACCESS-NOVO",
          refreshToken: "REFRESH-NOVO",
          expiresAt: "2026-08-25T15:30:00.000Z",
          scope: "offline_access",
          tokenType: "Bearer",
        };
      },
      persistRefreshedCredentials: async (input) => {
        persisted = true;
        assert.equal(input.motoristaId, motoristaId);
        assert.equal(input.mercadoPagoUserId, mercadoPagoUserId);
        assert.equal(input.encryptedAccessToken, "encrypted:ACCESS-NOVO");
        assert.equal(input.encryptedRefreshToken, "encrypted:REFRESH-NOVO");
        assert.equal(input.expiresAt, "2026-08-25T15:30:00.000Z");
      },
    },
  );

  assert.equal(token, "ACCESS-NOVO");
  assert.equal(decryptedRefresh, true);
  assert.equal(persisted, true);
  console.log("TOKEN_EXPIRADO_RENOVADO_E_ROTACIONADO_OK");
}

{
  const body = montarCorpoCobrancaPix({
    valorTotal: 18.5,
    valorComissao: 3.7,
    passageiroId: "22222222-2222-4222-8222-222222222222",
    passageiroNome: "Passageiro",
    passageiroEmail: "passageiro@example.com",
  });

  assert.equal(body.transaction_amount, 18.5);
  assert.equal(body.application_fee, 3.7);
  assert.equal(body.payment_method_id, "pix");
  console.log("APPLICATION_FEE_COMISSAO_CONGELADA_OK");
}

const pagamentoSource = readFileSync("src/lib/pagamento.server.ts", "utf8");
const motoristaSource = readFileSync("src/lib/motorista.functions.ts", "utf8");
const etapa3RepoPath = "supabase/migrations/20260825091547_criacao_financeira_atomica.sql";
const etapa3RunnerPath =
  "/tmp/zuvvi_migrations_preexistentes/20260825091547_criacao_financeira_atomica.sql";
const etapa3Source = readFileSync(
  existsSync(etapa3RepoPath) ? etapa3RepoPath : etapa3RunnerPath,
  "utf8",
);

assert.doesNotMatch(
  pagamentoSource,
  /MERCADOPAGO_ACCESS_TOKEN/,
  "Etapa 4 não pode usar o token geral da plataforma",
);
assert.match(pagamentoSource, /application_fee:\s*valorComissao/);
assert.match(pagamentoSource, /pix_charge_attempt_claim/);
assert.match(pagamentoSource, /pix_charge_attempt_complete/);
assert.match(pagamentoSource, /pix_oauth_credentials_get/);
assert.match(pagamentoSource, /refreshAccessToken/);

const aceitarStart = motoristaSource.indexOf("export const aceitarCorrida");
const aceitarEnd = motoristaSource.indexOf("export const recusarCorrida", aceitarStart);
assert.notEqual(aceitarStart, -1);
assert.notEqual(aceitarEnd, -1);
const aceitarSource = motoristaSource.slice(aceitarStart, aceitarEnd);
assert.match(aceitarSource, /prepararCobrancaPixAntesAceiteServer/);
assert.match(aceitarSource, /criarCobrancaPixAposAceiteServer/);
assert.match(aceitarSource, /accept_corrida_atomic/);

assert.match(
  etapa3Source,
  /create or replace function public\.criar_corrida_financeira_atomica/i,
  "Etapa 3 congelada deve continuar presente",
);

console.log("ETAPA4_STATIC_GUARDS_OK");
