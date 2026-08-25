import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const sha256 = (path: string) => createHash("sha256").update(read(path)).digest("hex");

const route = read("src/routes/pagamento-pix.tsx");
const statusFunction = read("src/lib/pagamento-pix-status.functions.ts");
const searchingRoute = read("src/routes/procurando-motorista.tsx");
const paymentServer = read("src/lib/pagamento.server.ts");

test("a tela Pix cobre os cinco estados obrigatórios", () => {
  for (const state of ["generating", "ready", "confirmed", "expired", "failed"]) {
    assert.match(route, new RegExp(`screenState === ["']${state}["']`));
  }

  assert.match(route, /PIX_PAYMENT_TIMEOUT_MS/);
  assert.match(route, /POLLING_INTERVAL_MS = 3_000/);
  assert.match(route, /consultarStatusPagamentoPixFn\(\{ data: \{ rideId \} \}\)/);
  assert.doesNotMatch(route, /criarCobrancaPix/);
  assert.match(paymentServer, /criarCobrancaPixAposAceiteServer/);
});

test("estado expirado oferece cancelamento e não oferece nova cobrança", () => {
  const expiredBlock = route.slice(
    route.indexOf('screenState === "expired"'),
    route.indexOf('screenState === "failed"'),
  );

  assert.match(expiredBlock, /Cancelar corrida/);
  assert.doesNotMatch(expiredBlock, /Tentar novamente/);
  assert.match(route, /await cancelarCorridaFn\(\{ data: \{ rideId \} \}\)/);
});

test("polling valida sessão, passageiro, Pix e cobrança guardada no banco", () => {
  assert.match(statusFunction, /middleware\(\[requireSupabaseAuth\]\)/);
  assert.match(statusFunction, /\.eq\("auth_user_id", context\.userId\)/);
  assert.match(statusFunction, /\.eq\("passageiro_id", usuario\.id\)/);
  assert.match(statusFunction, /corrida\.forma_pagamento !== "pix"/);
  assert.match(statusFunction, /pagamento\.id_transacao_mercadopago/);
  assert.match(statusFunction, /paymentClient\.get\(\{/);
  assert.match(
    statusFunction,
    /String\(providerPayment\.id\) !== pagamento\.id_transacao_mercadopago/,
  );
  assert.match(statusFunction, /providerPayment\.payment_method_id !== "pix"/);
  assert.match(statusFunction, /pix_oauth_credentials_get/);
  assert.match(statusFunction, /decryptOAuthSecret/);
  assert.match(statusFunction, /PIX_OAUTH_ENCRYPTION_KEY/);
  assert.doesNotMatch(statusFunction, /MERCADOPAGO_ACCESS_TOKEN/);
  assert.match(statusFunction, /pagamentos_pix_tentativas/);
  assert.match(statusFunction, /estado_interno: "pago"/);
  assert.match(statusFunction, /\.update\(\{ status: "pago" \}\)/);
  assert.match(statusFunction, /\.eq\("status", "pendente"\)/);
});

test("só corridas Pix desviam para a cobrança", () => {
  const navigationBlock = searchingRoute.slice(
    searchingRoute.indexOf("const navigateAfterDriverAccepted"),
    searchingRoute.indexOf("// Proteção contra chamadas duplicadas"),
  );

  assert.match(navigationBlock, /formaPagamento === ["']pix["']/);
  assert.match(navigationBlock, /to: ["']\/pagamento-pix["']/);
  assert.match(navigationBlock, /to: ["']\/acompanhamento["']/);
  assert.equal(searchingRoute.match(/navigateAfterDriverAccepted\(/g)?.length, 5);
});

test("a rota gerada registra pagamento-pix", () => {
  const routeTree = read("src/routeTree.gen.ts");
  assert.match(routeTree, /\.\/routes\/pagamento-pix/);
  assert.match(routeTree, /'\/pagamento-pix'/);
});

test("arquivos congelados permanecem byte a byte iguais ao baseline", () => {
  const frozenFiles: Record<string, string> = {
    "src/lib/motorista.functions.ts":
      "7f4f99172d8db5dd328ed7d07a39e4e29b0acf03e8de5b2597f3ec9ff8fce512",
    "src/lib/pagamento.functions.ts":
      "4fb835531b2bb811d7cd73464bbe584fea54909c9d2493757d028b9e194bc070",
    "src/lib/pagamento.server.ts":
      "97fa987dc492f1e662aed32e61249ab18147b5138805db57ea5651703d1331b4",
    "src/lib/user.functions.ts": "5cbc089781ccb6c241f0780e1974ab143d7bb2732d00cbc809c96248bc7f8e6a",
    "src/routes/confirmar-corrida.tsx":
      "53ded905ef56296a61e8b7a0a54cc89d294fc40e69858616714d7534e94e1be6",
    "src/routes/acompanhamento.tsx":
      "278a9d579fe7a9324d94616e3665040e270ae597e3c6275ca9a50a50d172f35d",
    "package.json": "71b9e8dc6ef0028172aed34993d150a1d5f77adad5c7b5168046c7d0b8cd6f50",
    "bun.lock": "43a4359a9fb245f3c46484da57fb1342957f657780f7ee5c50ae1354aa64619f",
    "docs/pix/FONTE_DA_VERDADE_PIX_ZUVVI.md":
      "e20ba9c4941abe336a5229904f466b4bbbf820ef95b320d4331daab08f12b1d7",
  };

  for (const [path, expectedHash] of Object.entries(frozenFiles)) {
    assert.equal(sha256(path), expectedHash, `${path} foi alterado fora do escopo`);
  }
});
