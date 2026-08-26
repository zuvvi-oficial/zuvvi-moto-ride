import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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

console.log("PIX_DEVICE_ID_ANTIFRAUD_GUARDS_OK");
