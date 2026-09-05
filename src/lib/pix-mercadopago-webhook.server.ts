import { createHash } from "node:crypto";
import { sincronizarPagamentoPixComMercadoPago } from "./pix-payment-sync.server";
import { verifyMercadoPagoWebhookSignature } from "./pix-mercadopago-webhook-signature.server";
import type { supabaseAdmin as SupabaseAdminInstance } from "@/integrations/supabase/client.server";

const WEBHOOK_PATH = "/api/mercadopago/webhook";
const NUMERIC_ID_PATTERN = /^\d{1,32}$/u;

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null ? (value as JsonRecord) : null;
}

function asNumericId(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).trim();
  return NUMERIC_ID_PATTERN.test(normalized) ? normalized : null;
}

function extractPaymentId(url: URL, payload: unknown): string | null {
  const queryId = asNumericId(url.searchParams.get("data.id") ?? url.searchParams.get("id"));
  if (queryId) return queryId;

  const root = asRecord(payload);
  const data = asRecord(root?.["data"]);
  return asNumericId(data?.["id"] ?? root?.["id"]);
}

function extractTopic(url: URL, payload: unknown): string | null {
  const root = asRecord(payload);
  const raw = root?.["type"] ?? root?.["topic"] ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  return typeof raw === "string" ? raw.trim().toLowerCase() : null;
}

function extractAction(payload: unknown): string | null {
  const root = asRecord(payload);
  const raw = root?.["action"];
  return typeof raw === "string" ? raw.trim().toLowerCase() : null;
}

// Notificação Mercado Pago traz um "id" de topo próprio, distinto de data.id
// (que é o id do pagamento). Esse id identifica a entrega do webhook em si e
// é a chave de deduplicação correta contra reentregas do mesmo evento.
function extractNotificationId(payload: unknown): string | null {
  const root = asRecord(payload);
  return asNumericId(root?.["id"]);
}

function buildEventKey(input: {
  notificationId: string | null;
  topic: string;
  paymentId: string;
  requestId: string | null;
  payloadHash: string;
}): string {
  if (input.notificationId) return `mp-notification:${input.notificationId}`;
  // Fallback só para formatos legados sem "id" de notificação. Não garante
  // deduplicação perfeita entre reentregas, mas evita colapsar eventos distintos.
  return `mp-fallback:${input.topic}:${input.paymentId}:${input.requestId ?? "none"}:${input.payloadHash}`;
}

export function isMercadoPagoWebhookRequest(request: Request): boolean {
  try {
    return new URL(request.url).pathname === WEBHOOK_PATH;
  } catch {
    return false;
  }
}

type SupabaseAdminClient = typeof SupabaseAdminInstance;

async function finalizeEvent(
  supabaseAdmin: SupabaseAdminClient,
  eventKey: string,
  status: "processed" | "failed",
  errorCode?: string,
): Promise<void> {
  try {
    // O cast fica restrito a esta chamada enquanto os tipos gerados não
    // refletem a função pix_mercadopago_webhook_finalizar_evento (migration nova).
    await (supabaseAdmin as any).rpc("pix_mercadopago_webhook_finalizar_evento", {
      p_event_key: eventKey,
      p_status: status,
      p_error_code: errorCode ?? null,
    });
  } catch (error) {
    console.error("[PixWebhook] Falha ao finalizar registro de evento.", {
      kind: error instanceof Error ? error.name : "unknown",
    });
  }
}

export async function handleMercadoPagoWebhook(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
  }

  const url = new URL(request.url);
  const rawBody = await request.text().catch(() => "");
  let payload: unknown = null;
  if (rawBody) {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      // Algumas notificações trazem o ID apenas na query string, sem corpo JSON.
    }
  }

  const topic = extractTopic(url, payload);
  if (topic && topic !== "payment") return new Response("ok", { status: 200 });

  const paymentId = extractPaymentId(url, payload);
  if (!paymentId) return new Response("ok", { status: 200 });

  const webhookSecret = process.env["MERCADOPAGO_WEBHOOK_SECRET"];
  if (!webhookSecret) {
    console.error("[PixWebhook] MERCADOPAGO_WEBHOOK_SECRET não configurado; notificação rejeitada.");
    return new Response("retry", { status: 503 });
  }

  const requestId = request.headers.get("x-request-id");
  const signatureValid = verifyMercadoPagoWebhookSignature({
    signatureHeader: request.headers.get("x-signature"),
    requestId,
    dataId: paymentId,
    secret: webhookSecret,
  });
  if (!signatureValid) {
    console.error("[PixWebhook] Assinatura x-signature inválida ou ausente.");
    return new Response("invalid signature", { status: 401 });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const notificationId = extractNotificationId(payload);
  const action = extractAction(payload);
  const payloadHash = createHash("sha256").update(rawBody || paymentId).digest("hex");
  const normalizedTopic = topic ?? "payment";
  const eventKey = buildEventKey({ notificationId, topic: normalizedTopic, paymentId, requestId, payloadHash });

  let alreadyProcessed = false;
  try {
    // Mesma justificativa do cast em finalizeEvent: RPC nova, tipos ainda não regenerados.
    const { data, error } = await (supabaseAdmin as any).rpc("pix_mercadopago_webhook_register_event", {
      p_event_key: eventKey,
      p_request_id: requestId,
      p_topic: normalizedTopic,
      p_action: action,
      p_resource_id: paymentId,
      p_payload_hash: payloadHash,
    });
    if (error) throw error;
    const dedupResult = Array.isArray(data) ? data[0] : data;
    alreadyProcessed = Boolean(dedupResult) && !dedupResult.is_new && dedupResult.processing_status === "processed";
  } catch (error) {
    console.error("[PixWebhook] Falha ao registrar evento para deduplicação.", {
      kind: error instanceof Error ? error.name : "unknown",
    });
    return new Response("retry", { status: 503 });
  }

  if (alreadyProcessed) return new Response("ok", { status: 200 });

  try {
    const { data: pagamento, error: pagamentoError } = await supabaseAdmin
      .from("pagamentos")
      .select("corrida_id, meio")
      .eq("id_transacao_mercadopago", paymentId)
      .maybeSingle();

    if (pagamentoError) throw pagamentoError;
    if (!pagamento || pagamento.meio !== "pix") {
      await finalizeEvent(supabaseAdmin, eventKey, "processed");
      return new Response("ok", { status: 200 });
    }

    const { data: corrida, error: corridaError } = await supabaseAdmin
      .from("corridas")
      .select("id, motorista_id, forma_pagamento")
      .eq("id", pagamento.corrida_id)
      .maybeSingle();

    if (corridaError) throw corridaError;
    if (!corrida || corrida.forma_pagamento !== "pix" || !corrida.motorista_id) {
      await finalizeEvent(supabaseAdmin, eventKey, "processed");
      return new Response("ok", { status: 200 });
    }

    // O Webhook é apenas um gatilho. Nenhum status do payload é confiado.
    // A verdade financeira é lida novamente na API do Mercado Pago usando o
    // OAuth do motorista e as validações canônicas já existentes.
    await sincronizarPagamentoPixComMercadoPago({
      rideId: corrida.id,
      expectedMotoristaId: corrida.motorista_id,
    });

    await finalizeEvent(supabaseAdmin, eventKey, "processed");
    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error("[PixWebhook] Falha ao reconciliar notificação Mercado Pago.", {
      kind: error instanceof Error ? error.name : "unknown",
    });
    await finalizeEvent(supabaseAdmin, eventKey, "failed", error instanceof Error ? error.name : "unknown");
    return new Response("retry", { status: 503 });
  }
}
