import { SupabaseClient } from "@supabase/supabase-js";

// Dispara Web Push pra quem ativou notificações na tela pública de viagem
// compartilhada (contato de confiança, sem conta na Zuvvi) — a mesma
// entrega usada pro passageiro logado (sendWebPushNotification), só que
// buscando inscrições em viagem_compartilhada_push_subscriptions em vez de
// push_subscriptions. Nunca lança: é sempre best-effort, chamado a partir
// dos pontos que já notificam o passageiro a cada mudança de status,
// exatamente como o próprio push do passageiro logado já se comporta lá.
export async function notificarInscritosViagemCompartilhada(
  supabase: SupabaseClient<any>,
  params: { corridaId: string; tipo: string; titulo: string; mensagem: string },
): Promise<void> {
  try {
    if (!process.env["VAPID_PUBLIC_KEY"] || !process.env["VAPID_PRIVATE_KEY"]) return;

    const { data: viagens } = await supabase
      .from("viagens_compartilhadas")
      .select("id, link_publico")
      .eq("corrida_id", params.corridaId)
      .gt("expira_em", new Date().toISOString());

    if (!viagens?.length) return;

    const { sendWebPushNotification } = await import("./web-push.server");

    for (const viagem of viagens as { id: string; link_publico: string }[]) {
      const { data: subscriptions } = await supabase
        .from("viagem_compartilhada_push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("viagem_compartilhada_id", viagem.id);

      if (!subscriptions?.length) continue;

      await Promise.allSettled(
        (subscriptions as { id: string; endpoint: string; p256dh: string; auth: string }[]).map(
          async (sub) => {
            try {
              const result = await sendWebPushNotification(
                { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
                {
                  title: params.titulo,
                  body: params.mensagem,
                  tipo: params.tipo,
                  url: `/viagem-compartilhada?token=${encodeURIComponent(viagem.link_publico)}`,
                },
              );
              if (result.outcome === "gone") {
                await supabase
                  .from("viagem_compartilhada_push_subscriptions")
                  .delete()
                  .eq("id", sub.id);
              }
            } catch (err) {
              console.error("Erro ao enviar push de viagem compartilhada para uma inscrição:", err);
            }
          },
        ),
      );
    }
  } catch (err) {
    console.error("Erro inesperado ao notificar inscritos de viagem compartilhada:", err);
  }
}
