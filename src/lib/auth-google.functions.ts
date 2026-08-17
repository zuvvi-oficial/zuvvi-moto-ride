import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const handleGoogleAuthRedirect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // Check if user record already exists
    const { data: userRecord, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("is_passageiro, is_motorista")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (userError) {
      console.error("Database error checking for existing user:", userError);
      return { redirectTo: "/auth/login", error: "Erro ao verificar sua conta. Por favor, tente novamente." };
    }

    if (!userRecord) {
      // Create new user record from Google metadata (fetched server-side)
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
      const metadata = (authUser?.user?.user_metadata ?? {}) as Record<string, string | undefined>;
      const nome = metadata['full_name'] || metadata['name'] || "Usuário Google";
      const email = authUser?.user?.email ?? null;
      
      const { error: insertError } = await supabaseAdmin
        .from("usuarios")
        .insert({
          auth_user_id: userId,
          nome: nome,
          email: email,
          is_passageiro: false,
          is_motorista: false,
        });

      if (insertError) {
        console.error("Error creating user record from Google auth:", insertError);
        return { redirectTo: "/auth/login", error: "Não foi possível criar seu perfil. Por favor, tente novamente." };
      }

      return { redirectTo: "/auth/perfil" };
    }

    // Existing user: check if profile choice is completed
    if (userRecord.is_passageiro || userRecord.is_motorista) {
      return { redirectTo: "/" };
    }

    // Record exists but profile hasn't been chosen yet
    return { redirectTo: "/auth/perfil" };
  });
