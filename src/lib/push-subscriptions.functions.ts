import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().max(300).optional(),
});

export const registrarPushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => subscribeSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: usuario, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    if (userError || !usuario) throw new Error("Usuário não encontrado.");

    // A tabela push_subscriptions ainda não está nos tipos gerados do projeto.
    const { error } = await (supabaseAdmin as any)
      .from("push_subscriptions")
      .upsert(
        {
          usuario_id: usuario.id,
          endpoint: data.endpoint,
          p256dh: data.p256dh,
          auth: data.auth,
          user_agent: data.userAgent || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" },
      );

    if (error) throw new Error("Não foi possível ativar as notificações neste dispositivo.");
    return { success: true };
  });

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

export const removerPushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => unsubscribeSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: usuario, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    if (userError || !usuario) throw new Error("Usuário não encontrado.");

    await (supabaseAdmin as any)
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", data.endpoint)
      .eq("usuario_id", usuario.id);

    return { success: true };
  });
