import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CPF_PIX_INVALIDO_ERROR,
  exigirCpfValidoParaPix,
  validarCpfBrasileiro,
} from "../../src/lib/pix-cpf";

const clientSource = readFileSync("src/lib/pix-device-id.ts", "utf8");
const sessionFnSource = readFileSync("src/lib/pix-device-session.functions.ts", "utf8");
const sessionServerSource = readFileSync("src/lib/pix-device-session.server.ts", "utf8");
const paymentSource = readFileSync("src/lib/pagamento.server.ts", "utf8");
const confirmSource = readFileSync("src/routes/confirmar-corrida.tsx", "utf8");

assert.match(clientSource, /https:\/\/www\.mercadopago\.com\/v2\/security\.js/);
assert.match(clientSource, /MP_DEVICE_SESSION_ID/);
assert.match(clientSource, /setAttribute\("view", "checkout"\)/);
assert.doesNotMatch(clientSource, /console\.(log|error|warn)/);

assert.match(sessionFnSource, /requireSupabaseAuth/);
assert.match(sessionFnSource, /pagamentos_pix_device_sessions/);
assert.doesNotMatch(sessionFnSource, /return[^;]*deviceId/);

assert.match(sessionServerSource, /\.gt\("expires_at", new Date\(\)\.toISOString\(\)\)/);
assert.match(paymentSource, /obterPixDeviceIdValido/);
assert.match(paymentSource, /meliSessionId:\s*deviceId/);
assert.match(paymentSource, /requestOptions:\s*\{\s*idempotencyKey,\s*meliSessionId:\s*deviceId\s*\}/);

const pixGuardStart = confirmSource.indexOf("if (metodoPagamento === 'pix')");
const createRideStart = confirmSource.indexOf("const result = await criarCorridaFn");
assert.ok(pixGuardStart >= 0, "Device ID deve ser exclusivo do Pix");
assert.ok(createRideStart > pixGuardStart, "Device ID deve ser registrado antes da corrida Pix");
assert.match(
  confirmSource.slice(pixGuardStart, createRideStart),
  /registrarPixDeviceSessionFn/,
);

assert.equal(validarCpfBrasileiro("529.982.247-25"), true, "CPF válido com máscara deve passar");
assert.equal(validarCpfBrasileiro("12345678909"), true, "CPF válido sem máscara deve passar");
assert.equal(validarCpfBrasileiro("529.982.247-24"), false, "dígito verificador incorreto deve falhar");
assert.equal(validarCpfBrasileiro("111.111.111-11"), false, "sequência repetida deve falhar");
assert.equal(validarCpfBrasileiro("123.456.789-0"), false, "CPF incompleto deve falhar");
assert.equal(validarCpfBrasileiro(null), false, "CPF ausente deve falhar");
assert.equal(exigirCpfValidoParaPix("529.982.247-25"), "52998224725");
assert.throws(
  () => exigirCpfValidoParaPix("529.982.247-24"),
  (error: unknown) => error instanceof Error && error.message === CPF_PIX_INVALIDO_ERROR,
  "CPF inválido deve retornar mensagem clara para correção do cadastro",
);

assert.match(sessionFnSource, /\.select\("id, cpf"\)/);
const sessionCpfGuard = sessionFnSource.indexOf("exigirCpfValidoParaPix(usuario.cpf)");
const sessionUpsert = sessionFnSource.indexOf('.from("pagamentos_pix_device_sessions")');
assert.ok(sessionCpfGuard >= 0 && sessionCpfGuard < sessionUpsert, "CPF deve ser validado antes da sessão Pix");

const serverCpfGuard = sessionServerSource.indexOf("exigirCpfValidoParaPix(passageiro.cpf)");
const serverDeviceLookup = sessionServerSource.indexOf('.from("pagamentos_pix_device_sessions")');
assert.ok(
  serverCpfGuard >= 0 && serverCpfGuard < serverDeviceLookup,
  "guarda server-side deve validar CPF antes de liberar o Device ID",
);

assert.match(paymentSource, /exigirCpfValidoParaPix\(input\.passageiroCpf\)/);
assert.doesNotMatch(paymentSource, /passageiroCpf\.length\s*===\s*11/);
assert.match(paymentSource, /identification:\s*\{\s*type:\s*"CPF"\s+as const,\s*number:\s*passageiroCpf\s*\}/);

const chargeStart = paymentSource.indexOf("export async function criarCobrancaPixAposAceiteServer");
const chargeSource = paymentSource.slice(chargeStart);
const chargeCpfGuard = chargeSource.indexOf("const deviceId = await obterPixDeviceIdValido");
const chargeClaim = chargeSource.indexOf('"pix_charge_attempt_claim"');
assert.ok(chargeStart >= 0, "motor de cobrança Pix deve existir");
assert.ok(
  chargeCpfGuard >= 0 && chargeCpfGuard < chargeClaim,
  "CPF deve ser validado antes de reservar a tentativa interna de cobrança",
);

console.log("PIX_DEVICE_ID_ANTIFRAUD_GUARDS_OK");
console.log("CPF_PIX_VALIDACAO_REAL_OK");
