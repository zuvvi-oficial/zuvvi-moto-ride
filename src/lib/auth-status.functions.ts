import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const checkUserProfileStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: userRecord, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("is_passageiro, is_motorista")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (userError || !userRecord) {
      // If error or user not found, we can't determine profile, so assume incomplete
      return { hasProfile: false };
    }

    return { 
      hasProfile: !!(userRecord.is_passageiro || userRecord.is_motorista) 
    };
  });
