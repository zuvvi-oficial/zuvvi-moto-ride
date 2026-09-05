import { encryptWebPushPayload, generateVapidAuthorizationHeader } from "./web-push-crypto.server";

export type WebPushSubscription = Readonly<{
  endpoint: string;
  p256dh: string;
  auth: string;
}>;

export type WebPushPayload = Readonly<{
  title: string;
  body: string;
  tipo: string;
  corridaId?: string | null;
}>;

export type WebPushSendResult =
  | { outcome: "sent" }
  | { outcome: "gone" } // 404/410: inscrição inválida, deve ser removida do banco
  | { outcome: "error"; status: number };

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}

// Envia uma única notificação Web Push para uma inscrição de navegador.
// Nunca lança para falhas esperadas do provedor (404/410/erro HTTP) — o
// chamador decide o que fazer (ex.: remover a inscrição expirada).
export async function sendWebPushNotification(
  subscription: WebPushSubscription,
  payload: WebPushPayload,
): Promise<WebPushSendResult> {
  const endpointUrl = new URL(subscription.endpoint);
  const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;

  const vapidPublicKey = requireEnv("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = requireEnv("VAPID_PRIVATE_KEY");
  const vapidSubject = process.env["VAPID_SUBJECT"] || "mailto:suporte@zuvvi.app";

  const authorization = generateVapidAuthorizationHeader({
    audience,
    subject: vapidSubject,
    vapidPublicKeyBase64Url: vapidPublicKey,
    vapidPrivateKeyBase64Url: vapidPrivateKey,
  });

  const encryptedBody = encryptWebPushPayload({
    payload: JSON.stringify(payload),
    p256dhBase64Url: subscription.p256dh,
    authBase64Url: subscription.auth,
  });

  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "high",
    },
    body: new Uint8Array(encryptedBody),
  });

  if (response.ok) return { outcome: "sent" };
  if (response.status === 404 || response.status === 410) return { outcome: "gone" };
  return { outcome: "error", status: response.status };
}
