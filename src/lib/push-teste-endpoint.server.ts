// Endpoint interno para disparar uma notificação push de teste para um
// usuário específico, sem precisar passar por um pedido de corrida real.
// Protegido por segredo compartilhado (mesmo padrão de
// pix-reconciliacao-pendentes-endpoint.server.ts), nunca exposto sem
// autenticação — existe só para diagnóstico manual durante o fechamento do
// bug de notificações push, análogo ao endpoint de reconciliação do Pix.
import { criarNotificacao } from "./notificacoes.server";

const ENDPOINT_PATH = "/api/internal/push-teste";

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

export function isPushTesteRequest(request: Request): boolean {
  try {
    return new URL(request.url).pathname === ENDPOINT_PATH;
  } catch {
    return false;
  }
}

export async function handlePushTesteRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
  }

  const secret = process.env["PUSH_TESTE_SECRET"];
  const providedSecret = request.headers.get("x-push-teste-secret");
  if (
    !secret ||
    !providedSecret ||
    providedSecret.length !== secret.length ||
    !timingSafeEqualString(providedSecret, secret)
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  let usuarioId: string | null = null;
  try {
    const body = (await request.json()) as { usuario_id?: unknown };
    usuarioId = typeof body.usuario_id === "string" && body.usuario_id ? body.usuario_id : null;
  } catch {
    return new Response(JSON.stringify({ error: "corpo_invalido" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  if (!usuarioId) {
    return new Response(JSON.stringify({ error: "usuario_id_obrigatorio" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Reaproveita o mesmo tipo "nova_oferta_corrida" do fluxo real (mesmo
    // padrão de vibração/renotify no service worker) em vez de inventar um
    // tipo novo só para teste — assim o teste reflete exatamente o
    // comportamento real que estamos diagnosticando.
    const resultado = await criarNotificacao(supabaseAdmin, {
      usuario_id: usuarioId,
      tipo: "nova_oferta_corrida",
      titulo: "🔔 Teste de notificação Zuvvi",
      mensagem: "Se isso chegou com o app fechado, o push está funcionando.",
    });
    return new Response(JSON.stringify({ inserted: resultado.inserted }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("[PushTesteEndpoint] Falha ao disparar notificação de teste.", {
      kind: error instanceof Error ? error.name : "unknown",
    });
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
