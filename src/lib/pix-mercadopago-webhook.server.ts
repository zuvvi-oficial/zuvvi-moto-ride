import { sincronizarPagamentoPixComMercadoPago } from "./pix-payment-sync.server";

const WEBHOOK_PATH = "/api/mercadopago/webhook";
const PAYMENT_ID_PATTERN = /^\d{1,32}$/u;

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null ? (value as JsonRecord) : null;
}

function asPaymentId(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).trim();
  return PAYMENT_ID_PATTERN.test(normalized) ? normalized : null;
}

function extractPaymentId(url: URL, payload: unknown): string | null {
  const queryId = asPaymentId(url.searchParams.get("data.id") ?? url.searchParams.get("id"));
  if (queryId) return queryId;

  const root = asRecord(payload);
  const data = asRecord(root?.["data"]);
  return asPaymentId(data?.["id"] ?? root?.["id"]);
}

function extractTopic(url: URL, payload: unknown): string | null {
  const root = asRecord(payload);
  const raw = root?.["type"] ?? root?.["topic"] ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  return typeof raw === "string" ? raw.trim().toLowerCase() : null;
}

function asShortString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return null;
}

export function isMercadoPagoWebhookRequest(request: Request): boolean {
  try {
    return new URL(request.url).pathname === WEBHOOK_PATH;
  } catch {
    return false;
  }
}

// --- Validação de assinatura (x-signature) conforme a documentação oficial do Mercado Pago ---
// https://www.mercadopago.com.br/developers/pt/docs/checkout-api/webhooks -> "Validação de origem da notificação"

const textEncoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(message));
  return toHex(new Uint8Array(signature));
}

async function sha256Hex(message: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(message));
  return toHex(new Uint8Array(digest));
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

function parseSignatureHeader(header: string | null): Readonly<{ ts: string; v1: string }> | null {
  if (!header) return null;

  let ts: string | null = null;
  let v1: string | null = null;
  for (const part of header.split(",")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    if (key === "ts") ts = value;
    else if (key === "v1") v1 = value;
  }

  return ts && v1 ? Object.freeze({ ts, v1 }) : null;
}

async function isValidMercadoPagoSignature(request: Request, url: URL): Promise<boolean> {
  const secret = process.env["MERCADOPAGO_WEBHOOK_SECRET"];
  if (!secret) {
    console.error("[PixWebhook] MERCADOPAGO_WEBHOOK_SECRET não configurado; rejeitando notificação.");
    return false;
  }

  const signatureHeader = parseSignatureHeader(request.headers.get("x-signature"));
  const requestId = request.headers.get("x-request-id");
  const dataId = url.searchParams.get("data.id");
  if (!signatureHeader || !requestId || !dataId) return false;

  const normalizedDataId = /[A-Za-z]/u.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `id:${normalizedDataId};request-id:${requestId};ts:${signatureHeader.ts};`;
  const expected = await hmacSha256Hex(secret, manifest);

  return timingSafeEqualHex(expected, signatureHeader.v1.toLowerCase());
}

// --- Deduplicação de eventos via private.mercadopago_webhook_eventos ---

type WebhookEventRow = Readonly<{
  processing_status: string;
  processing_attempts: number;
}>;

async function findWebhookEvent(supabaseAdmin: any, eventKey: string): Promise<WebhookEventRow | null> {
  const { data, error } = await supabaseAdmin
    .schema("private")
    .from("mercadopago_webhook_eventos")
    .select("processing_status, processing_attempts")
    .eq("event_key", eventKey)
    .maybeSingle();

  if (error) {
    console.error("[PixWebhook] Falha ao consultar deduplicação de evento.");
    return null;
  }
  return data ?? null;
}

async function upsertWebhookEventProcessing(
  supabaseAdmin: any,
  input: Readonly<{
    eventKey: string;
    requestId: string | null;
    topic: string;
    action: string | null;
    resourceId: string;
    payloadHash: string;
    previousAttempts: number;
  }>,
): Promise<void> {
  const { error } = await supabaseAdmin
    .schema("private")
    .from("mercadopago_webhook_eventos")
    .upsert(
      {
        event_key: input.eventKey,
        request_id: input.requestId,
        topic: input.topic,
        action: input.action,
        resource_id: input.resourceId,
        payload_hash: input.payloadHash,
        processing_status: "processing",
        processing_attempts: input.previousAttempts + 1,
      },
      { onConflict: "event_key" },
    );

  if (error) {
    console.error("[PixWebhook] Falha ao registrar evento para deduplicação.");
  }
}

async function markWebhookEventOutcome(
  supabaseAdmin: any,
  eventKey: string,
  outcome: Readonly<{ status: "processed" | "failed"; errorCode?: string | null }>,
): Promise<void> {
  const { error } = await supabaseAdmin
    .schema("private")
    .from("mercadopago_webhook_eventos")
    .update({
      processing_status: outcome.status,
      processed_at: outcome.status === "processed" ? new Date().toISOString() : null,
      error_code: outcome.errorCode ?? null,
    })
    .eq("event_key", eventKey);

  if (error) {
    console.error("[PixWebhook] Falha ao atualizar status do evento processado.");
  }
}

export async function handleMercadoPagoWebhook(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
  }

  const url = new URL(request.url);

  // Nenhum processamento acontece antes da assinatura ser validada.
  const signatureValid = await isValidMercadoPagoSignature(request, url);
  if (!signatureValid) {
    console.warn("[PixWebhook] Assinatura x-signature ausente ou inválida.");
    return new Response("Unauthorized", { status: 401 });
  }

  const rawBody = await request.text().catch(() => "");
  let payload: unknown = null;
  try {
    payload = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    // Algumas notificações podem trazer o ID apenas na query string.
  }

  const topic = extractTopic(url, payload);
  if (topic && topic !== "payment") return new Response("ok", { status: 200 });

  const paymentId = extractPaymentId(url, payload);
  if (!paymentId) return new Response("ok", { status: 200 });

  const root = asRecord(payload);
  const notificationId = asShortString(root?.["id"]);
  const action = typeof root?.["action"] === "string" ? (root["action"] as string) : null;
  const requestId = request.headers.get("x-request-id");
  const eventKey = notificationId
    ? `mercadopago:notification:${notificationId}`
    : `mercadopago:fallback:payment:${paymentId}:${action ?? "unknown"}`;
  const payloadHash = await sha256Hex(rawBody || url.search);

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const existingEvent = await findWebhookEvent(supabaseAdmin as any, eventKey);
    if (existingEvent?.processing_status === "processed") {
      return new Response("ok", { status: 200 });
    }

    await upsertWebhookEventProcessing(supabaseAdmin as any, {
      eventKey,
      requestId,
      topic: topic ?? "payment",
      action,
      resourceId: paymentId,
      payloadHash,
      previousAttempts: existingEvent?.processing_attempts ?? 0,
    });

    const { data: pagamento, error: pagamentoError } = await supabaseAdmin
      .from("pagamentos")
      .select("corrida_id, meio")
      .eq("id_transacao_mercadopago", paymentId)
      .maybeSingle();

    if (pagamentoError) throw new Error("pagamento_lookup_failed");
    if (!pagamento || pagamento.meio !== "pix") {
      await markWebhookEventOutcome(supabaseAdmin as any, eventKey, { status: "processed" });
      return new Response("ok", { status: 200 });
    }

    const { data: corrida, error: corridaError } = await supabaseAdmin
      .from("corridas")
      .select("id, motorista_id, forma_pagamento")
      .eq("id", pagamento.corrida_id)
      .maybeSingle();

    if (corridaError) throw new Error("corrida_lookup_failed");
    if (!corrida || corrida.forma_pagamento !== "pix" || !corrida.motorista_id) {
      await markWebhookEventOutcome(supabaseAdmin as any, eventKey, { status: "processed" });
      return new Response("ok", { status: 200 });
    }

    // O Webhook é apenas um gatilho. Nenhum status do payload é confiado.
    // A verdade financeira é lida novamente na API do Mercado Pago usando o
    // OAuth do motorista e as validações canônicas já existentes.
    await sincronizarPagamentoPixComMercadoPago({
      rideId: corrida.id,
      expectedMotoristaId: corrida.motorista_id,
    });

    await markWebhookEventOutcome(supabaseAdmin as any, eventKey, { status: "processed" });
    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error("[PixWebhook] Falha ao reconciliar notificação Mercado Pago.", {
      kind: error instanceof Error ? error.name : "unknown",
    });
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await markWebhookEventOutcome(supabaseAdmin as any, eventKey, {
        status: "failed",
        errorCode: (error instanceof Error ? error.message : "unknown").slice(0, 120),
      });
    } catch {
      // Mantém a resposta de retry mesmo se o registro de falha não puder ser persistido.
    }
    return new Response("retry", { status: 503 });
  }
}
