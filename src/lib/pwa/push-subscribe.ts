/**
 * Inscrição/cancelamento de Web Push no navegador. Segue o mesmo padrão
 * defensivo de register-sw.ts: nunca assume suporte, nunca lança para o
 * chamador em ambientes sem service worker/Push API.
 */

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function subscriptionKeys(subscription: PushSubscription): { p256dh: string; auth: string } | null {
  const json = subscription.toJSON();
  const p256dh = json.keys?.["p256dh"];
  const auth = json.keys?.["auth"];
  if (!p256dh || !auth) return null;
  return { p256dh, auth };
}

export type PushSubscribeOutcome = "subscribed" | "denied" | "unsupported" | "error";

// Pede permissão (se necessário) e registra a inscrição no servidor.
// Idempotente: chamar de novo com uma inscrição já ativa apenas reenvia
// as mesmas chaves (upsert por endpoint no servidor).
export async function subscribeToPushNotifications(
  vapidPublicKey: string,
): Promise<PushSubscribeOutcome> {
  if (!isPushSupported() || !vapidPublicKey) return "unsupported";

  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // TS 5.8's generic Uint8Array<ArrayBufferLike> doesn't structurally match
        // the DOM lib's BufferSource here even though it's valid at runtime.
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });
    }

    const keys = subscriptionKeys(subscription);
    if (!keys) return "error";

    const { registrarPushSubscription } = await import("@/lib/push-subscriptions.functions");
    await registrarPushSubscription({
      data: {
        endpoint: subscription.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: navigator.userAgent.slice(0, 300),
      },
    });

    return "subscribed";
  } catch (error) {
    console.error("[Push] Falha ao inscrever para notificações:", error);
    return "error";
  }
}

export async function unsubscribeFromPushNotifications(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    const { removerPushSubscription } = await import("@/lib/push-subscriptions.functions");
    await removerPushSubscription({ data: { endpoint: subscription.endpoint } });
    await subscription.unsubscribe();
  } catch (error) {
    console.error("[Push] Falha ao cancelar inscrição:", error);
  }
}
