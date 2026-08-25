const MERCADO_PAGO_API_BASE = "https://api.mercadopago.com";
const EXTERNAL_REFERENCE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/u;

export type PixCanonicalPayment = Readonly<{
  paymentId: string;
  externalReference: string;
  transactionAmount: number;
  collectorId: string;
  status: string | null;
  statusDetail: string | null;
  qrCode: string;
  qrCodeBase64: string;
  expiresAt: string | null;
}>;

export type PixCanonicalLookupInput = Readonly<{
  accessToken: string;
  externalReference: string;
  expectedAmount: number;
  expectedMercadoPagoUserId: string;
  paymentId?: string | null;
}>;

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function asNonBlankString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asIdentifier(value: unknown): string | null {
  if (typeof value === "number" && Number.isSafeInteger(value)) return String(value);
  return asNonBlankString(value);
}

function cents(value: number): number {
  return Math.round(value * 100);
}

async function requestJson(
  url: URL,
  accessToken: string,
  fetchImpl: FetchLike,
): Promise<unknown> {
  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("PIX_RECONCILIACAO_PROVIDER_INDISPONIVEL");
  }

  return response.json();
}

function extractSearchResults(payload: unknown): unknown[] {
  const root = Array.isArray(payload) && payload.length === 1 ? payload[0] : payload;
  const record = asRecord(root);
  return Array.isArray(record?.["results"]) ? (record["results"] as unknown[]) : [];
}

function paymentIdFromSearchResult(value: unknown, externalReference: string): string | null {
  const record = asRecord(value);
  if (!record || asNonBlankString(record["external_reference"]) !== externalReference) return null;
  return asIdentifier(record["id"]);
}

function parseCanonicalPayment(
  payload: unknown,
  input: PixCanonicalLookupInput,
  expectedPaymentId: string,
): PixCanonicalPayment {
  const record = asRecord(payload);
  const pointOfInteraction = asRecord(record?.["point_of_interaction"]);
  const transactionData = asRecord(pointOfInteraction?.["transaction_data"]);

  const paymentId = asIdentifier(record?.["id"]);
  const externalReference = asNonBlankString(record?.["external_reference"]);
  const paymentMethodId = asNonBlankString(record?.["payment_method_id"]);
  const currencyId = asNonBlankString(record?.["currency_id"]);
  const collectorId = asIdentifier(record?.["collector_id"]);
  const transactionAmount = Number(record?.["transaction_amount"]);
  const qrCode = asNonBlankString(transactionData?.["qr_code"]);
  const qrCodeBase64 = asNonBlankString(transactionData?.["qr_code_base64"]);
  const status = asNonBlankString(record?.["status"]);
  const statusDetail = asNonBlankString(record?.["status_detail"]);
  const expiresAt = asNonBlankString(record?.["date_of_expiration"]);

  if (
    paymentId !== expectedPaymentId ||
    externalReference !== input.externalReference ||
    paymentMethodId !== "pix" ||
    currencyId !== "BRL" ||
    collectorId !== input.expectedMercadoPagoUserId ||
    !Number.isFinite(transactionAmount) ||
    cents(transactionAmount) !== cents(input.expectedAmount) ||
    !qrCode ||
    !qrCodeBase64
  ) {
    throw new Error("PIX_RECONCILIACAO_CANONICA_INVALIDA");
  }

  return Object.freeze({
    paymentId,
    externalReference,
    transactionAmount,
    collectorId,
    status,
    statusDetail,
    qrCode,
    qrCodeBase64,
    expiresAt,
  });
}

export function falhaCriacaoMercadoPagoPermiteCompensacao(error: unknown): boolean {
  const record = asRecord(error);
  const status = typeof record?.["status"] === "number" ? record["status"] : 0;
  return status === 400 || status === 401 || status === 403 || status === 404 || status === 422;
}

export async function buscarPagamentoPixCanonico(
  input: PixCanonicalLookupInput,
  fetchImpl: FetchLike = fetch,
): Promise<PixCanonicalPayment | null> {
  if (
    !asNonBlankString(input.accessToken) ||
    !EXTERNAL_REFERENCE_PATTERN.test(input.externalReference) ||
    !Number.isFinite(input.expectedAmount) ||
    input.expectedAmount <= 0 ||
    !asNonBlankString(input.expectedMercadoPagoUserId)
  ) {
    throw new Error("PIX_RECONCILIACAO_ENTRADA_INVALIDA");
  }

  let paymentId = asIdentifier(input.paymentId ?? null);

  if (!paymentId) {
    const searchUrl = new URL(`${MERCADO_PAGO_API_BASE}/v1/payments/search`);
    searchUrl.searchParams.set("sort", "date_created");
    searchUrl.searchParams.set("criteria", "desc");
    searchUrl.searchParams.set("external_reference", input.externalReference);
    searchUrl.searchParams.set("range", "date_created");
    searchUrl.searchParams.set("begin_date", "NOW-30DAYS");
    searchUrl.searchParams.set("end_date", "NOW");
    searchUrl.searchParams.set("limit", "2");

    const searchPayload = await requestJson(searchUrl, input.accessToken, fetchImpl);
    const matches = extractSearchResults(searchPayload)
      .map((result) => paymentIdFromSearchResult(result, input.externalReference))
      .filter((id): id is string => id !== null);

    if (matches.length === 0) return null;
    const matchedPaymentId = matches[0];
    if (matches.length !== 1 || !matchedPaymentId) {
      throw new Error("PIX_RECONCILIACAO_REFERENCIA_AMBIGUA");
    }
    paymentId = matchedPaymentId;
  }

  const canonicalPaymentId = paymentId;
  if (!canonicalPaymentId) {
    throw new Error("PIX_RECONCILIACAO_ENTRADA_INVALIDA");
  }

  const paymentUrl = new URL(
    `${MERCADO_PAGO_API_BASE}/v1/payments/${encodeURIComponent(canonicalPaymentId)}`,
  );
  const paymentPayload = await requestJson(paymentUrl, input.accessToken, fetchImpl);
  return parseCanonicalPayment(paymentPayload, input, canonicalPaymentId);
}
