// Endpoint interno chamado pela GitHub Action agendada (ver
// .github/workflows/pix-reconciliacao-pix-pendentes.yml). Protegido por
// segredo compartilhado, nunca exposto sem autenticação.
import { reconciliarTentativasPixPendentes } from "./pix-reconciliacao-pendentes.server";

const ENDPOINT_PATH = "/api/internal/pix-reconciliar-pendentes";

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

export function isPixReconciliacaoPendentesRequest(request: Request): boolean {
  try {
    return new URL(request.url).pathname === ENDPOINT_PATH;
  } catch {
    return false;
  }
}

export async function handlePixReconciliacaoPendentesRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
  }

  const secret = process.env["PIX_RECONCILIACAO_CRON_SECRET"];
  const providedSecret = request.headers.get("x-cron-secret");
  if (!secret || !providedSecret || providedSecret.length !== secret.length || !timingSafeEqualString(providedSecret, secret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const resumo = await reconciliarTentativasPixPendentes();
    return new Response(JSON.stringify(resumo), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("[PixReconciliacaoPendentesEndpoint] Falha ao executar rotina.", {
      kind: error instanceof Error ? error.name : "unknown",
    });
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
