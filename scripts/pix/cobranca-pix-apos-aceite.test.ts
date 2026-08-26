import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  garantirAccessTokenMotorista,
  montarCorpoCobrancaPix,
  type PixCredentialSnapshot,
} from "../../src/lib/pagamento.server";
import {
  buscarPagamentoPixCanonico,
  falhaCriacaoMercadoPagoPermiteCompensacao,
} from "../../src/lib/pix-mercadopago-reconcile.server";

const motoristaId = "11111111-1111-4111-8111-111111111111";
const passageiroId = "22222222-2222-4222-8222-222222222222";
const corridaId = "33333333-3333-4333-8333-333333333333";
const mercadoPagoUserId = "123456789";
const now = Date.parse("2026-08-25T09:30:00.000Z");
const externalReference = "zuvvi-pix-44444444-4444-4444-8444-444444444444";

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

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function canonicalPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: 987654321,
    external_reference: externalReference,
    transaction_amount: 18.5,
    payment_method_id: "pix",
    currency_id: "BRL",
    collector_id: Number(mercadoPagoUserId),
    status: "pending",
    status_detail: "pending_waiting_transfer",
    date_of_expiration: "2026-08-25T09:35:00.000Z",
    point_of_interaction: {
      transaction_data: {
        qr_code: "000201PIXTESTE",
        qr_code_base64: "BASE64-PIX",
      },
    },
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
    corridaId,
    passageiroId,
    passageiroNome: "Maria da Silva",
    passageiroEmail: "passageiro@example.com",
    passageiroCelular: "+55 (43) 99999-9999",
    passageiroCpf: "123.456.789-09",
    passageiroCreatedAt: "2026-08-20T10:00:00.000Z",
    externalReference,
  });

  assert.equal(body.transaction_amount, 18.5);
  assert.equal(body.application_fee, 3.7);
  assert.equal(body.payment_method_id, "pix");
  assert.equal(body.external_reference, externalReference);
  assert.match(body.notification_url, /^https:\/\/zuvvi-moto-ride\.lovable\.app\/api\/mercadopago\/webhook/);
  assert.match(body.notification_url, /source_news=webhooks/);
  assert.equal(body.payer.first_name, "Maria");
  assert.equal(body.payer.last_name, "da Silva");
  assert.deepEqual(body.payer.phone, { area_code: "43", number: "999999999" });
  assert.deepEqual(body.payer.identification, { type: "CPF", number: "12345678909" });
  assert.equal(body.additional_info.items[0]?.id, corridaId);
  assert.equal(body.additional_info.items[0]?.unit_price, 18.5);
  assert.equal(body.additional_info.payer.first_name, "Maria");
  assert.equal(body.additional_info.payer.registration_date, "2026-08-20T10:00:00.000Z");
  console.log("APPLICATION_FEE_ANTIFRAUDE_E_WEBHOOK_OK");
}

{
  assert.throws(
    () =>
      montarCorpoCobrancaPix({
        valorTotal: 18.5,
        valorComissao: 3.7,
        corridaId,
        passageiroId,
        passageiroNome: "Passageiro",
        passageiroEmail: "passageiro@example.com",
        externalReference: "referencia com espaco",
      }),
    /Não foi possível gerar o pagamento Pix/,
  );
  console.log("EXTERNAL_REFERENCE_INVALIDA_BLOQUEADA_OK");
}

{
  const seenUrls: string[] = [];
  const payment = await buscarPagamentoPixCanonico(
    {
      accessToken: "SELLER-TOKEN",
      externalReference,
      expectedAmount: 18.5,
      expectedMercadoPagoUserId: mercadoPagoUserId,
    },
    async (input, init) => {
      const url = String(input);
      seenUrls.push(url);
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer SELLER-TOKEN");
      if (url.includes("/v1/payments/search")) {
        assert.match(url, new RegExp(`external_reference=${encodeURIComponent(externalReference)}`));
        return jsonResponse({
          paging: { total: 1, limit: 2, offset: 0 },
          results: [{ id: 987654321, external_reference: externalReference }],
        });
      }
      assert.match(url, /\/v1\/payments\/987654321$/);
      return jsonResponse(canonicalPayment());
    },
  );

  assert.equal(seenUrls.length, 2);
  assert.equal(payment?.paymentId, "987654321");
  assert.equal(payment?.collectorId, mercadoPagoUserId);
  assert.equal(payment?.qrCode, "000201PIXTESTE");
  console.log("RECONCILIACAO_POR_EXTERNAL_REFERENCE_OK");
}

{
  let calls = 0;
  const payment = await buscarPagamentoPixCanonico(
    {
      accessToken: "SELLER-TOKEN",
      externalReference,
      expectedAmount: 18.5,
      expectedMercadoPagoUserId: mercadoPagoUserId,
      paymentId: "987654321",
    },
    async (input) => {
      calls += 1;
      assert.match(String(input), /\/v1\/payments\/987654321$/);
      return jsonResponse(canonicalPayment());
    },
  );
  assert.equal(calls, 1);
  assert.equal(payment?.paymentId, "987654321");
  console.log("RECONCILIACAO_DIRETA_POR_PAYMENT_ID_OK");
}

{
  const notFound = await buscarPagamentoPixCanonico(
    {
      accessToken: "SELLER-TOKEN",
      externalReference,
      expectedAmount: 18.5,
      expectedMercadoPagoUserId: mercadoPagoUserId,
    },
    async () => jsonResponse({ paging: { total: 0 }, results: [] }),
  );
  assert.equal(notFound, null);
  console.log("RECONCILIACAO_SEM_RESULTADO_FALHA_FECHADA_OK");
}

{
  await assert.rejects(
    () =>
      buscarPagamentoPixCanonico(
        {
          accessToken: "SELLER-TOKEN",
          externalReference,
          expectedAmount: 18.5,
          expectedMercadoPagoUserId: mercadoPagoUserId,
        },
        async () =>
          jsonResponse({
            results: [
              { id: 1, external_reference: externalReference },
              { id: 2, external_reference: externalReference },
            ],
          }),
      ),
    /PIX_RECONCILIACAO_REFERENCIA_AMBIGUA/,
  );
  console.log("RECONCILIACAO_REFERENCIA_AMBIGUA_BLOQUEADA_OK");
}

{
  await assert.rejects(
    () =>
      buscarPagamentoPixCanonico(
        {
          accessToken: "SELLER-TOKEN",
          externalReference,
          expectedAmount: 18.5,
          expectedMercadoPagoUserId: mercadoPagoUserId,
          paymentId: "987654321",
        },
        async () => jsonResponse(canonicalPayment({ collector_id: 999999999 })),
      ),
    /PIX_RECONCILIACAO_CANONICA_INVALIDA/,
  );
  console.log("RECONCILIACAO_VENDEDOR_DIVERGENTE_BLOQUEADA_OK");
}

{
  assert.equal(falhaCriacaoMercadoPagoPermiteCompensacao({ status: 400 }), true);
  assert.equal(falhaCriacaoMercadoPagoPermiteCompensacao({ status: 401 }), true);
  assert.equal(falhaCriacaoMercadoPagoPermiteCompensacao({ status: 403 }), true);
  assert.equal(falhaCriacaoMercadoPagoPermiteCompensacao({ status: 404 }), true);
  assert.equal(falhaCriacaoMercadoPagoPermiteCompensacao({ status: 422 }), true);
  assert.equal(falhaCriacaoMercadoPagoPermiteCompensacao({ status: 409 }), false);
  assert.equal(falhaCriacaoMercadoPagoPermiteCompensacao({ status: 429 }), false);
  assert.equal(falhaCriacaoMercadoPagoPermiteCompensacao({ status: 500 }), false);
  assert.equal(falhaCriacaoMercadoPagoPermiteCompensacao(new Error("network")), false);
  console.log("FALHA_DETERMINISTICA_VS_ESTADO_INCERTO_OK");
}

const pagamentoSource = readFileSync("src/lib/pagamento.server.ts", "utf8");
const reconciliacaoSource = readFileSync("src/lib/pix-mercadopago-reconcile.server.ts", "utf8");
const webhookSource = readFileSync("src/lib/pix-mercadopago-webhook.server.ts", "utf8");
const serverSource = readFileSync("src/server.ts", "utf8");
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
assert.match(pagamentoSource, /external_reference:\s*input\.externalReference/);
assert.match(pagamentoSource, /notification_url:\s*getPixNotificationUrl\(\)/);
assert.match(pagamentoSource, /additional_info/);
assert.match(pagamentoSource, /passageiroCelular/);
assert.match(pagamentoSource, /requestOptions:\s*\{\s*idempotencyKey,\s*meliSessionId:\s*deviceId\s*\}/);
assert.match(pagamentoSource, /externalReference:\s*idempotencyKey/);
assert.match(pagamentoSource, /pix_charge_attempt_claim/);
assert.match(pagamentoSource, /pix_charge_attempt_complete/);
assert.match(pagamentoSource, /pix_charge_failure_compensate/);
assert.match(pagamentoSource, /buscarPagamentoPixCanonico/);
assert.match(pagamentoSource, /falhaCriacaoMercadoPagoPermiteCompensacao/);
assert.match(pagamentoSource, /Estado da criação Pix incerto; tentativa mantida para reconciliação/);
assert.match(pagamentoSource, /Falha ao persistir resultado Pix; cobrança mantida para reconciliação/);
assert.doesNotMatch(
  pagamentoSource,
  /console\.error\([^\n]*error\)/,
  "erro bruto do provedor não deve ser registrado no log",
);
assert.match(pagamentoSource, /pix_oauth_credentials_get/);
assert.match(pagamentoSource, /refreshAccessToken/);

assert.match(reconciliacaoSource, /\/v1\/payments\/search/);
assert.match(reconciliacaoSource, /external_reference/);
assert.match(reconciliacaoSource, /\/v1\/payments\//);
assert.match(reconciliacaoSource, /collectorId !== input\.expectedMercadoPagoUserId/);
assert.match(reconciliacaoSource, /paymentMethodId !== "pix"/);
assert.match(reconciliacaoSource, /currencyId !== "BRL"/);

assert.match(webhookSource, /sincronizarPagamentoPixComMercadoPago/);
assert.match(webhookSource, /id_transacao_mercadopago/);
assert.match(webhookSource, /expectedMotoristaId/);
assert.match(webhookSource, /Nenhum status do payload é confiado/);
assert.match(serverSource, /isMercadoPagoWebhookRequest/);
assert.match(serverSource, /handleMercadoPagoWebhook/);

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

console.log("ETAPA4_RECONCILIACAO_E_STATIC_GUARDS_OK");
