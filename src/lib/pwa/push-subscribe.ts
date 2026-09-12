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

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  let binario = "";
  for (const byte of new Uint8Array(buffer)) binario += String.fromCharCode(byte);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Uma inscrição existente fica presa para sempre na chave VAPID pública usada
// no momento do subscribe() original — trocar a chave no servidor não afeta
// quem já tinha se inscrito antes. Sem essa checagem, uma rotação de chave
// deixaria o push quebrado (silenciosamente) para todo mundo que já havia
// ativado notificações, mesmo que a pessoa "reative" o sino de novo.
function inscricaoUsaChaveAtual(subscription: PushSubscription, vapidPublicKey: string): boolean {
  const chaveAtual = subscription.options.applicationServerKey;
  if (!chaveAtual) return false;
  return arrayBufferToBase64Url(chaveAtual) === vapidPublicKey;
}

export type PushSubscribeOutcome = "subscribed" | "denied" | "unsupported" | "error";

// A chave não muda durante a sessão, então guardar a primeira resposta boa
// evita ida e volta desnecessária. Falha de rede ou de sessão NÃO é guardada:
// o motorista tenta de novo a cada vez que fica online, e cachear o erro
// deixaria o push morto até recarregar a página.
let chavePublicaCache: string | undefined;

async function obterChavePublica(): Promise<string | null> {
  if (chavePublicaCache) return chavePublicaCache;

  try {
    const { getVapidPublicKey } = await import("@/lib/push-subscriptions.functions");
    const { publicKey } = await getVapidPublicKey();
    if (publicKey) chavePublicaCache = publicKey;
    return publicKey || null;
  } catch (error) {
    console.error("[Push] Falha ao obter a chave pública VAPID:", error);
    return null;
  }
}

// Pede permissão (se necessário) e registra a inscrição no servidor.
// Idempotente: chamar de novo com uma inscrição já ativa apenas reenvia
// as mesmas chaves (upsert por endpoint no servidor).
export async function subscribeToPushNotifications(): Promise<PushSubscribeOutcome> {
  if (!isPushSupported()) return "unsupported";

  // A permissão vem primeiro, antes de qualquer espera de rede: em Safari/iOS
  // o pedido precisa sair ainda "colado" no toque que originou a ação, e
  // buscar a chave antes gastaria esse gesto — o usuário nunca veria o aviso.
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";
  }

  const vapidPublicKey = await obterChavePublica();
  if (!vapidPublicKey) {
    // Sem VAPID_PUBLIC_KEY no ambiente, o push é impossível — e sem este aviso
    // a ativação falharia calada, que foi o que escondeu isso por tanto tempo.
    console.warn(
      "[Push] VAPID_PUBLIC_KEY ausente no servidor: notificações não podem ser ativadas. Ver .env.example.",
    );
    return "unsupported";
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (subscription && !inscricaoUsaChaveAtual(subscription, vapidPublicKey)) {
      await subscription.unsubscribe();
      subscription = null;
    }
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
