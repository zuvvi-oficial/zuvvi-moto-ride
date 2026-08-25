import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  calcularDeadlinePix,
  derivarEstadoPagamentoPix,
  getPixPaymentTimeoutSeconds,
} from "../../src/lib/pagamento-pix-status.functions";

const createdAt = "2026-08-25T12:00:00.000Z";
const now = Date.parse("2026-08-25T12:01:00.000Z");

assert.equal(getPixPaymentTimeoutSeconds(undefined), 300);
assert.equal(getPixPaymentTimeoutSeconds("300"), 300);
assert.equal(getPixPaymentTimeoutSeconds("59"), 300);
assert.equal(getPixPaymentTimeoutSeconds("901"), 300);
assert.equal(getPixPaymentTimeoutSeconds("abc"), 300);

assert.equal(calcularDeadlinePix(createdAt, null, 300), "2026-08-25T12:05:00.000Z");
assert.equal(
  calcularDeadlinePix(createdAt, "2026-08-25T12:03:00.000Z", 300),
  "2026-08-25T12:03:00.000Z",
);
assert.equal(
  calcularDeadlinePix(createdAt, "2026-08-25T12:10:00.000Z", 300),
  "2026-08-25T12:05:00.000Z",
);

assert.equal(
  derivarEstadoPagamentoPix({ pagamentoStatus: "pendente", corridaStatus: "aceita" }, now).status,
  "gerando",
);

assert.equal(
  derivarEstadoPagamentoPix(
    {
      pagamentoStatus: "pendente",
      corridaStatus: "aceita",
      tentativaEstado: "criando",
      tentativaCreatedAt: createdAt,
    },
    now,
  ).status,
  "gerando",
);

assert.equal(
  derivarEstadoPagamentoPix(
    {
      pagamentoStatus: "pendente",
      corridaStatus: "aceita",
      tentativaEstado: "pendente",
      providerStatus: "pending",
      pixCopiaCola: "000201PIX",
      tentativaCreatedAt: createdAt,
    },
    now,
  ).status,
  "aguardando",
);

assert.equal(
  derivarEstadoPagamentoPix(
    {
      pagamentoStatus: "pendente",
      corridaStatus: "aceita",
      tentativaEstado: "pendente",
      providerStatus: "in_process",
      pixCopiaCola: "000201PIX",
      tentativaCreatedAt: createdAt,
    },
    now,
  ).status,
  "analisando",
);

// Provider approved sozinho nunca libera a corrida.
assert.equal(
  derivarEstadoPagamentoPix(
    {
      pagamentoStatus: "pendente",
      corridaStatus: "aceita",
      tentativaEstado: "pendente",
      providerStatus: "approved",
      pixCopiaCola: "000201PIX",
      tentativaCreatedAt: createdAt,
    },
    now,
  ).status,
  "analisando",
);

assert.equal(
  derivarEstadoPagamentoPix(
    {
      pagamentoStatus: "pago",
      corridaStatus: "aceita",
      tentativaEstado: "pendente",
      providerStatus: "approved",
      pixCopiaCola: "000201PIX",
      tentativaCreatedAt: createdAt,
    },
    now,
  ).status,
  "pago",
);

assert.equal(
  derivarEstadoPagamentoPix(
    {
      pagamentoStatus: "falhou",
      corridaStatus: "cancelada",
      tentativaEstado: "falhou",
      tentativaCreatedAt: createdAt,
    },
    now,
  ).status,
  "falhou",
);

assert.equal(
  derivarEstadoPagamentoPix(
    {
      pagamentoStatus: "estornado",
      corridaStatus: "cancelada",
      tentativaEstado: "estornado",
      tentativaCreatedAt: createdAt,
    },
    now,
  ).status,
  "estornado",
);

assert.equal(
  derivarEstadoPagamentoPix(
    {
      pagamentoStatus: "pendente",
      corridaStatus: "aceita",
      tentativaEstado: "pendente",
      providerStatus: "pending",
      pixCopiaCola: "000201PIX",
      tentativaCreatedAt: createdAt,
    },
    Date.parse("2026-08-25T12:05:00.000Z"),
  ).status,
  "expirado",
);

assert.equal(
  derivarEstadoPagamentoPix(
    {
      pagamentoStatus: "pendente",
      corridaStatus: "aceita",
      tentativaEstado: "pendente",
      providerStatus: "expired",
      pixCopiaCola: "000201PIX",
      tentativaCreatedAt: createdAt,
    },
    now,
  ).status,
  "expirado",
);

const routeSource = readFileSync("src/routes/pagamento-pix.tsx", "utf8");
const statusSource = readFileSync("src/lib/pagamento-pix-status.functions.ts", "utf8");
const searchingSource = readFileSync("src/routes/procurando-motorista.tsx", "utf8");

assert.match(routeSource, /QRCodeSVG/);
assert.match(routeSource, /useOnlineStatus/);
assert.match(routeSource, /Já paguei/);
assert.match(routeSource, /pagamento-pix/);
assert.doesNotMatch(routeSource, /SUPABASE_SERVICE_ROLE_KEY/);
assert.doesNotMatch(routeSource, /MERCADOPAGO_CLIENT_SECRET/);
assert.doesNotMatch(routeSource, /PIX_OAUTH_ENCRYPTION_KEY/);
assert.doesNotMatch(routeSource, /pagamentos_pix_tentativas/);

assert.match(statusSource, /corrida\.passageiro_id !== passageiro\.id/);
assert.match(statusSource, /corrida\.forma_pagamento !== "pix"/);
assert.match(statusSource, /pagamento\.status === "pago"/);
assert.doesNotMatch(statusSource, /Access Token/);
assert.doesNotMatch(statusSource, /Refresh Token/);

assert.match(searchingSource, /formaPagamento === 'pix'/);
assert.match(searchingSource, /to: '\/pagamento-pix'/);
assert.match(searchingSource, /to: '\/acompanhamento'/);

console.log("PIX Etapa 5: estados, ownership e isolamento da tela aprovados.");
