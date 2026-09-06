import { createHmac, timingSafeEqual } from "node:crypto";

// Tolerância contra replay: rejeita assinaturas cujo `ts` esteja fora desta janela.
const SIGNATURE_MAX_AGE_SECONDS = 15 * 60;

function parseSignatureHeader(header: string): { ts: string; v1: string } | null {
  const fields: Record<string, string> = {};
  for (const pair of header.split(",")) {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    if (key) fields[key] = value;
  }
  if (!fields["ts"] || !fields["v1"]) return null;
  return { ts: fields["ts"], v1: fields["v1"] };
}

// Manifesto oficial do Mercado Pago para validação de x-signature:
// "id:{data.id};request-id:{x-request-id};ts:{ts};" — a parte de
// request-id é omitida quando o header não vem na notificação.
function buildManifest(dataId: string, requestId: string | null, ts: string): string {
  let manifest = `id:${dataId.toLowerCase()};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;
  return manifest;
}

export function verifyMercadoPagoWebhookSignature(input: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
  secret: string;
  now?: () => number;
}): boolean {
  const { signatureHeader, requestId, dataId, secret } = input;
  if (!signatureHeader || !dataId) return false;

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return false;

  const tsSeconds = Number(parsed.ts);
  if (!Number.isFinite(tsSeconds)) return false;

  const nowMs = (input.now ?? Date.now)();
  const ageSeconds = Math.abs(nowMs / 1000 - tsSeconds);
  if (ageSeconds > SIGNATURE_MAX_AGE_SECONDS) return false;

  const manifest = buildManifest(dataId, requestId, parsed.ts);
  const expectedHex = createHmac("sha256", secret).update(manifest).digest("hex");

  const expectedBuf = Buffer.from(expectedHex, "hex");
  const actualBuf = Buffer.from(parsed.v1, "hex");
  if (expectedBuf.length === 0 || expectedBuf.length !== actualBuf.length) return false;

  return timingSafeEqual(expectedBuf, actualBuf);
}
