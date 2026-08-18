import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const handleGoogleAuthRedirect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    console.log("[handleGoogleAuthRedirect] Processing for userId:", userId);

    // Check if user record already exists
    const { data: userRecord, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id, is_passageiro, is_motorista, cpf, celular")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (userError) {
      console.error("[handleGoogleAuthRedirect] Database error checking for existing user:", userError);
      return { redirectTo: "/auth/login", error: "Erro ao verificar sua conta no banco de dados." };
    }

    if (!userRecord) {
      console.log("[handleGoogleAuthRedirect] No user record found, creating one...");
      // Create new user record from Google metadata (fetched server-side)
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
      
      if (authError || !authUser?.user) {
        console.error("[handleGoogleAuthRedirect] Error fetching auth user metadata:", authError);
        return { redirectTo: "/auth/login", error: "Não foi possível obter dados do Google." };
      }

      const metadata = (authUser.user.user_metadata ?? {}) as Record<string, string | undefined>;
      const nome = metadata['full_name'] || metadata['name'] || "Usuário Google";
      const email = authUser.user.email ?? null;
      
      console.log("[handleGoogleAuthRedirect] Metadata found:", { nome, email });

      const { data: newUser, error: insertError } = await supabaseAdmin
        .from("usuarios")
        .insert({
          auth_user_id: userId,
          nome: nome,
          email: email,
          is_passageiro: false,
          is_motorista: false,
        })
        .select()
        .single();

      if (insertError) {
        console.error("[handleGoogleAuthRedirect] Error creating user record:", insertError);
        return { redirectTo: "/auth/login", error: "Erro ao criar perfil no banco de dados." };
      }

      console.log("[handleGoogleAuthRedirect] New user record created, redirecting to complete info...");
      return { redirectTo: "/auth/completar-cadastro" };
    }

    console.log("[handleGoogleAuthRedirect] Existing user found:", userRecord.id);

    // If existing user has no profile choice, go to profile selection
    if (!userRecord.is_passageiro && !userRecord.is_motorista) {
      console.log("[handleGoogleAuthRedirect] Profile choice missing.");
      return { redirectTo: "/auth/perfil" };
    }

    // If CPF or Celular is missing (common in social auth), go to completion screen
    if (!userRecord.cpf || !userRecord.celular) {
      console.log("[handleGoogleAuthRedirect] CPF or Celular missing.");
      return { redirectTo: "/auth/completar-cadastro" };
    }

    console.log("[handleGoogleAuthRedirect] All good, redirecting to home.");
    return { redirectTo: "/" };
  });

export const updateUserInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    cpf: z.string().length(11, "CPF deve ter 11 dígitos"),
    celular: z.string().min(10).max(11, "Celular deve ter 10 ou 11 dígitos"),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { error } = await supabaseAdmin
      .from("usuarios")
      .update({
        cpf: data.cpf,
        celular: data.celular
      })
      .eq("auth_user_id", userId);

    if (error) {
      console.error("[updateUserInfo] Error updating user info:", error);
      
      // Capture PostgreSQL unique violation (code 23505)
      if (error.code === '23505') {
        if (error.message?.includes('usuarios_cpf_key')) {
          throw new Error("Este CPF já está cadastrado em outra conta.");
        }
        if (error.message?.includes('usuarios_celular_key')) {
          throw new Error("Este número de celular já está cadastrado em outra conta.");
        }
      }
      
      throw new Error("Erro ao salvar informações. Verifique os dados.");
    }

    return { success: true };
  });
