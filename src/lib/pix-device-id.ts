const MERCADOPAGO_SECURITY_SCRIPT_ID = "mercadopago-security-device-id";
const MERCADOPAGO_SECURITY_SCRIPT_SRC = "https://www.mercadopago.com/v2/security.js";
const DEFAULT_TIMEOUT_MS = 5_000;
const POLL_INTERVAL_MS = 100;

function normalizeDeviceId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 512) return null;
  if (/\p{Cc}/u.test(normalized)) return null;
  return normalized;
}

function readMercadoPagoDeviceId(): string | null {
  if (typeof window === "undefined") return null;
  return normalizeDeviceId((window as Window & { MP_DEVICE_SESSION_ID?: unknown }).MP_DEVICE_SESSION_ID);
}

function ensureSecurityScript(): HTMLScriptElement {
  const existing = document.getElementById(MERCADOPAGO_SECURITY_SCRIPT_ID);
  if (existing instanceof HTMLScriptElement) return existing;

  const script = document.createElement("script");
  script.id = MERCADOPAGO_SECURITY_SCRIPT_ID;
  script.src = MERCADOPAGO_SECURITY_SCRIPT_SRC;
  script.async = true;
  script.setAttribute("view", "checkout");
  document.head.appendChild(script);
  return script;
}

export async function ensureMercadoPagoDeviceId(
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<string> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Não foi possível preparar a segurança do Pix.");
  }

  const alreadyAvailable = readMercadoPagoDeviceId();
  if (alreadyAvailable) return alreadyAvailable;

  const script = ensureSecurityScript();
  let scriptFailed = false;
  const markFailed = () => {
    scriptFailed = true;
  };
  script.addEventListener("error", markFailed, { once: true });

  const deadline = Date.now() + Math.max(500, timeoutMs);
  try {
    while (Date.now() < deadline && !scriptFailed) {
      const deviceId = readMercadoPagoDeviceId();
      if (deviceId) return deviceId;
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  } finally {
    script.removeEventListener("error", markFailed);
  }

  throw new Error(
    "Não foi possível preparar a segurança do Pix. Verifique sua conexão e tente novamente.",
  );
}
