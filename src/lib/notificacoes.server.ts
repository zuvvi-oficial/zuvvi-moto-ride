import { SupabaseClient } from "@supabase/supabase-js";

type TipoNotificacao = 
  | "motorista_aceitou"
  | "motorista_a_caminho"
  | "motorista_chegou"
  | "corrida_iniciada"
  | "corrida_concluida"
  | "corrida_cancelada"
  | "nova_oferta_corrida"
  | "documento_aprovado"
  | "documento_recusado"
  | "motorista_aprovado"
  | "corrida_agendada_convertida"
  | "corrida_agendada_falhou"
  | "corrida_agendada_lembrete"
  | "gorjeta_recebida";

export async function criarNotificacao(
  supabase: SupabaseClient<any>,
  params: {
    usuario_id: string;
    tipo: TipoNotificacao;
    titulo: string;
    mensagem: string;
    corrida_id?: string | null;
  }
): Promise<{ inserted: boolean }> {
  let inserted = false;

  try {
    const { error } = await supabase
      .from("notificacoes")
      .insert({
        usuario_id: params.usuario_id,
        tipo: params.tipo,
        titulo: params.titulo,
        mensagem: params.mensagem,
        corrida_id: params.corrida_id || null,
        lida: false
      });

    if (error) {
      console.error("Erro ao criar notificação:", error);
    } else {
      inserted = true;
    }
  } catch (err) {
    console.error("Erro inesperado ao criar notificação:", err);
  }

  // Push é sempre best-effort: nunca deve derrubar o fluxo que criou a
  // notificação in-app, mesmo se todas as inscrições do usuário falharem.
  await enviarPushParaUsuario(supabase, params).catch((err) => {
    console.error("Erro inesperado ao enviar push:", err);
  });

  // Chamadores existentes ignoram este retorno (fire-and-forget) — só quem
  // precisa decidir se pode marcar algo como "enviado" (ex.: o lembrete de
  // corrida agendada, achado do Codex no PR #73) precisa checar `inserted`.
  return { inserted };
}

async function enviarPushParaUsuario(
  supabase: SupabaseClient<any>,
  params: { usuario_id: string; tipo: TipoNotificacao; titulo: string; mensagem: string; corrida_id?: string | null },
) {
  if (!process.env["VAPID_PUBLIC_KEY"] || !process.env["VAPID_PRIVATE_KEY"]) return;

  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("usuario_id", params.usuario_id);

  if (error || !subscriptions?.length) return;

  const { sendWebPushNotification } = await import("./web-push.server");

  await Promise.allSettled(
    subscriptions.map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
      try {
        const result = await sendWebPushNotification(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          { title: params.titulo, body: params.mensagem, tipo: params.tipo, corridaId: params.corrida_id ?? null },
        );
        if (result.outcome === "gone") {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      } catch (err) {
        console.error("Erro ao enviar push para uma inscrição:", err);
      }
    }),
  );
}
