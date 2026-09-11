// Endpoint interno chamado pela GitHub Action agendada (ver
// .github/workflows/corridas-agendadas-converter.yml). Protegido por
// segredo compartilhado, nunca exposto sem autenticação.
import { converterCorridasAgendadasVencidas, enviarLembretesCorridasAgendadas } from "./corridas-agendadas-engine.server";

const ENDPOINT_PATH = "/api/internal/corridas-agendadas-converter";

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

export function isCorridasAgendadasConverterRequest(request: Request): boolean {
  try {
    return new URL(request.url).pathname === ENDPOINT_PATH;
  } catch {
    return false;
  }
}

export async function handleCorridasAgendadasConverterRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
  }

  const secret = process.env["CORRIDAS_AGENDADAS_CRON_SECRET"];
  const providedSecret = request.headers.get("x-cron-secret");
  if (!secret || !providedSecret || providedSecret.length !== secret.length || !timingSafeEqualString(providedSecret, secret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const conversao = await converterCorridasAgendadasVencidas();
    // Lembrete roda no mesmo golpe do cron (a cada 5 min): não precisa de
    // segredo/workflow separado. Best-effort — uma falha aqui não deve virar
    // 500 pra rotina de conversão, que é a que realmente importa.
    const lembretes = await enviarLembretesCorridasAgendadas().catch((err) => {
      console.error("[CorridasAgendadasConverterEndpoint] Falha ao enviar lembretes.", {
        kind: err instanceof Error ? err.name : "unknown",
      });
      return { verificados: 0, enviados: 0 };
    });

    return new Response(JSON.stringify({ ...conversao, lembretes }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("[CorridasAgendadasConverterEndpoint] Falha ao executar rotina.", {
      kind: error instanceof Error ? error.name : "unknown",
    });
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
