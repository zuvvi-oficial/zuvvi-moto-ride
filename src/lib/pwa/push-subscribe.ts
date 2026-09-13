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

// "unsupported": o navegador não tem a API (nada a fazer, fica em silêncio).
// "unavailable": a API existe, mas não deu pra buscar a chave VAPID agora
// (rede instável, servidor fora do ar) — diferente de "unsupported", essa
// é recuperável e precisa aparecer pro motorista (achado do Codex na PR
// #151: antes essa falha virava "unsupported" e ficava tão calada quanto
// um navegador de fato incapaz, escondendo justamente o caso mais comum).
export type PushSubscribeOutcome =
  "subscribed" | "denied" | "unsupported" | "unavailable" | "error";

// A chave não muda durante a sessão, então guardar a primeira resposta boa
// evita ida e volta desnecessária. Falha de rede ou de sessão NÃO é guardada:
// o motorista tenta de novo a cada vez que fica online, e cachear o erro
// deixaria o push morto até recarregar a página.
let chavePublicaCache: string | undefined;

function descreverErro(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

// Resultado de subscribeToPushNotifications(): o motivo técnico exato de uma
// falha em "error"/"unavailable" viaja junto do retorno de cada chamada, e
// não por uma variável de módulo — a tela do sino já reinscreve em silêncio
// a cada abertura do app, então duas chamadas concorrentes (essa e a do
// motorista ficando online) compartilhando um único slot global fariam uma
// apagar ou trocar o motivo da outra antes do respectivo toast ler.
interface ChavePublicaResultado {
  publicKey: string | null;
  erro: string | null;
}

async function obterChavePublica(): Promise<ChavePublicaResultado> {
  if (chavePublicaCache) return { publicKey: chavePublicaCache, erro: null };

  try {
    const { getVapidPublicKey } = await import("@/lib/push-subscriptions.functions");
    const { publicKey } = await getVapidPublicKey();
    if (publicKey) {
      chavePublicaCache = publicKey;
      return { publicKey, erro: null };
    }
    return {
      publicKey: null,
      erro: "Servidor respondeu sem chave VAPID pública (VAPID_PUBLIC_KEY ausente no ambiente).",
    };
  } catch (error) {
    console.error("[Push] Falha ao obter a chave pública VAPID:", error);
    return { publicKey: null, erro: `Falha ao buscar chave VAPID: ${descreverErro(error)}` };
  }
}

export interface PushSubscribeResult {
  outcome: PushSubscribeOutcome;
  // Motivo técnico exato da falha (nome/mensagem da exceção real), presente
  // só quando outcome é "error" ou "unavailable" — é o que permite ver na
  // tela qual falha específica está ocorrendo, em vez de um "não deu certo"
  // genérico que esconde causas bem diferentes entre si.
  detalhe: string | null;
}

// Pede permissão (se necessário) e registra a inscrição no servidor.
// Idempotente: chamar de novo com uma inscrição já ativa apenas reenvia
// as mesmas chaves (upsert por endpoint no servidor).
export async function subscribeToPushNotifications(): Promise<PushSubscribeResult> {
  if (!isPushSupported()) return { outcome: "unsupported", detalhe: null };

  // A permissão vem primeiro, antes de qualquer espera de rede: em Safari/iOS
  // o pedido precisa sair ainda "colado" no toque que originou a ação, e
  // buscar a chave antes gastaria esse gesto — o usuário nunca veria o aviso.
  if (Notification.permission === "denied") return { outcome: "denied", detalhe: null };
  if (Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { outcome: "denied", detalhe: null };
  }

  const { publicKey: vapidPublicKey, erro: erroChave } = await obterChavePublica();
  if (!vapidPublicKey) {
    // Sem VAPID_PUBLIC_KEY no ambiente, o push é impossível — e sem este aviso
    // a ativação falharia calada, que foi o que escondeu isso por tanto tempo.
    console.warn(
      "[Push] Não foi possível obter a chave pública VAPID (ausente no servidor, ou falha de rede). Notificações não puderam ser ativadas.",
    );
    return { outcome: "unavailable", detalhe: erroChave };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    let endpointRenovado: string | null = null;
    if (subscription && !inscricaoUsaChaveAtual(subscription, vapidPublicKey)) {
      endpointRenovado = subscription.endpoint;
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
    if (!keys) {
      return {
        outcome: "error",
        detalhe: "Inscrição criada sem as chaves p256dh/auth (subscription.toJSON() incompleto).",
      };
    }

    const { registrarPushSubscription, removerPushSubscription } =
      await import("@/lib/push-subscriptions.functions");
    await registrarPushSubscription({
      data: {
        endpoint: subscription.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: navigator.userAgent.slice(0, 300),
      },
    });

    // A renovação por chave desatualizada pode trocar de endpoint (o serviço
    // de push decide); sem remover o registro velho, ele fica órfão no banco
    // até uma tentativa de envio futura esbarrar nele e receber 404/410.
    if (endpointRenovado && endpointRenovado !== subscription.endpoint) {
      await removerPushSubscription({ data: { endpoint: endpointRenovado } }).catch(() => {});
    }

    return { outcome: "subscribed", detalhe: null };
  } catch (error) {
    console.error("[Push] Falha ao inscrever para notificações:", error);
    return { outcome: "error", detalhe: descreverErro(error) };
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
