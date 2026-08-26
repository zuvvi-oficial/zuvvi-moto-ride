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

export function isMercadoPagoWebhookRequest(request: Request): boolean {
  try {
    return new URL(request.url).pathname === WEBHOOK_PATH;
  } catch {
    return false;
  }
}

export async function handleMercadoPagoWebhook(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
  }

  const url = new URL(request.url);
  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    // Algumas notificações podem trazer o ID apenas na query string.
  }

  const topic = extractTopic(url, payload);
  if (topic && topic !== "payment") return new Response("ok", { status: 200 });

  const paymentId = extractPaymentId(url, payload);
  if (!paymentId) return new Response("ok", { status: 200 });

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pagamento, error: pagamentoError } = await supabaseAdmin
      .from("pagamentos")
      .select("corrida_id, meio")
      .eq("id_transacao_mercadopago", paymentId)
      .maybeSingle();

    if (pagamentoError) return new Response("retry", { status: 503 });
    if (!pagamento || pagamento.meio !== "pix") return new Response("ok", { status: 200 });

    const { data: corrida, error: corridaError } = await supabaseAdmin
      .from("corridas")
      .select("id, motorista_id, forma_pagamento")
      .eq("id", pagamento.corrida_id)
      .maybeSingle();

    if (corridaError) return new Response("retry", { status: 503 });
    if (!corrida || corrida.forma_pagamento !== "pix" || !corrida.motorista_id) {
      return new Response("ok", { status: 200 });
    }

    // O Webhook é apenas um gatilho. Nenhum status do payload é confiado.
    // A verdade financeira é lida novamente na API do Mercado Pago usando o
    // OAuth do motorista e as validações canônicas já existentes.
    await sincronizarPagamentoPixComMercadoPago({
      rideId: corrida.id,
      expectedMotoristaId: corrida.motorista_id,
    });

    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error("[PixWebhook] Falha ao reconciliar notificação Mercado Pago.", {
      kind: error instanceof Error ? error.name : "unknown",
    });
    return new Response("retry", { status: 503 });
  }
}
