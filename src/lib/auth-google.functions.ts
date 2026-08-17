import { createServerFn } from "@tanstack/react-start";

export const handleGoogleAuthRedirect = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { supabase: supabaseClient } = await import("@/integrations/supabase/client");

    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session?.user) {
      console.warn("No active session found during Google redirect processing");
      return { redirectTo: "/auth/login" };
    }

    // Check if user record already exists
    const { data: userRecord, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("is_passageiro, is_motorista")
      .eq("auth_user_id", session.user.id)
      .maybeSingle();

    if (userError) {
      console.error("Database error checking for existing user:", userError);
      return { redirectTo: "/auth/login", error: "Erro ao verificar sua conta. Por favor, tente novamente." };
    }

    if (!userRecord) {
      // Create new user record from Google metadata
      const metadata = session.user.user_metadata || {};
      const nome = metadata['full_name'] || metadata['name'] || "Usuário Google";
      
      const { error: insertError } = await supabaseAdmin
        .from("usuarios")
        .insert({
          auth_user_id: session.user.id,
          nome: nome,
          email: session.user.email ?? null,
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
