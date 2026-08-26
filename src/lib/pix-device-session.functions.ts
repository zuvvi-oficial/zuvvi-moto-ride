import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PIX_DEVICE_SESSION_TTL_MS = 10 * 60 * 1_000;

const deviceSessionSchema = z.object({
  deviceId: z
    .string()
    .trim()
    .min(8)
    .max(512)
    .refine((value) => !/\p{Cc}/u.test(value), "Device ID inválido."),
});

export const registrarPixDeviceSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => deviceSessionSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: usuario, error: usuarioError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    if (usuarioError || !usuario) {
      throw new Error("Não foi possível preparar a segurança do Pix.");
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + PIX_DEVICE_SESSION_TTL_MS).toISOString();

    const { error } = await (supabaseAdmin as any)
      .from("pagamentos_pix_device_sessions")
      .upsert(
        {
          passageiro_id: usuario.id,
          device_id: data.deviceId,
          expires_at: expiresAt,
          updated_at: now.toISOString(),
        },
        { onConflict: "passageiro_id" },
      );

    if (error) {
      throw new Error("Não foi possível preparar a segurança do Pix.");
    }

    return Object.freeze({ success: true });
  });
