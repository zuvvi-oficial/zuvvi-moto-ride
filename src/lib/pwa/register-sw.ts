/**
 * Single, guarded service-worker registrar for Zuvvi.
 *
 * Never registers in dev, inside an iframe, in Lovable preview hosts, or when
 * `?sw=off` is present — in those contexts any matching registration is removed.
 */

type UpdateListener = (updateApp: () => Promise<void>) => void;

let updateListener: UpdateListener | null = null;
let pendingUpdate: (() => Promise<void>) | null = null;

export function onServiceWorkerUpdate(listener: UpdateListener) {
  updateListener = listener;
  if (pendingUpdate) listener(pendingUpdate);
  return () => {
    if (updateListener === listener) updateListener = null;
  };
}

function isRefusedContext(): boolean {
  if (!import.meta.env.PROD) return true;
  if (typeof window === "undefined") return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  if (new URLSearchParams(window.location.search).has("sw")) {
    if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  }
  return false;
}

async function unregisterAppServiceWorkers() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    registrations
      .filter((registration) => {
        const scriptURL =
          registration.active?.scriptURL ??
          registration.waiting?.scriptURL ??
          registration.installing?.scriptURL ??
          "";
        return scriptURL.endsWith("/sw.js");
      })
      .map((registration) => registration.unregister()),
  );
}

export async function registerZuvviServiceWorker() {
  if (isRefusedContext()) {
    await unregisterAppServiceWorkers();
    return;
  }
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  const { registerSW } = await import("virtual:pwa-register");

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      const apply = async () => {
        await updateSW(true);
      };
      pendingUpdate = apply;
      updateListener?.(apply);
    },
  });
}
