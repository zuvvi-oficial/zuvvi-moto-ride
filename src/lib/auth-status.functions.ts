import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const checkUserProfileStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: userRecord, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("is_passageiro, is_motorista, nome")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (userError || !userRecord) {
      return { hasProfile: false };
    }

    return { 
      hasProfile: !!(userRecord.is_passageiro || userRecord.is_motorista),
      isPassageiro: userRecord.is_passageiro,
      isMotorista: userRecord.is_motorista,
      nome: userRecord.nome
    };
  });

