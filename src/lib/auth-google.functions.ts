import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const handleGoogleAuthRedirect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    console.log("[GoogleAuth] handler_started");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    if (userId) {
      console.log("[GoogleAuth] authenticated_user_context=true");
    } else {
      console.log("[GoogleAuth] authenticated_user_context=false");
    }

    console.log("[GoogleAuth] user_record_lookup_started");
    const { data: userRecord, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id, is_passageiro, is_motorista, cpf, celular")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (userError) {
      console.error("[GoogleAuth] Database error checking for existing user:", userError);
      return { redirectTo: "/auth/login", error: "Erro ao verificar sua conta no banco de dados." };
    }

    if (!userRecord) {
      console.log("[GoogleAuth] user_record_found=false");
      console.log("[GoogleAuth] email_lookup_started");
      
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (authError || !authUser?.user) {
        console.error("[GoogleAuth] Error fetching auth user metadata:", authError);
        return { redirectTo: "/auth/login", error: "Não foi possível obter dados do Google." };
      }

      const metadata = (authUser.user.user_metadata ?? {}) as Record<string, string | undefined>;
      const nome = metadata['full_name'] || metadata['name'] || "Usuário Google";
      const email = authUser.user.email;

      if (!email) {
        return { redirectTo: "/auth/login", error: "O Google não forneceu um e-mail válido." };
      }

      // Check if email already exists in public.usuarios
      const { data: emailRecord, error: emailError } = await supabaseAdmin
        .from("usuarios")
        .select("id, auth_user_id, is_passageiro, is_motorista, cpf, celular")
        .eq("email", email)
        .maybeSingle();

      if (emailError) {
        console.error("[GoogleAuth] Error checking email existence:", emailError);
        return { redirectTo: "/auth/login", error: "Erro ao verificar e-mail no banco de dados." };
      }

      if (emailRecord) {
        // Case: Email exists linked to ANOTHER auth_user_id
        if (emailRecord.auth_user_id && emailRecord.auth_user_id !== userId) {
          console.error("[GoogleAuth] Email already linked to another account:", email);
          return { redirectTo: "/auth/login", error: "Este e-mail já está vinculado a outra conta." };
        }

        // Case: Email exists with NULL auth_user_id - Link it
        console.log("[GoogleAuth] Linking existing email record to new auth_user_id...");
        const { error: updateError } = await supabaseAdmin
          .from("usuarios")
          .update({ auth_user_id: userId })
          .eq("id", emailRecord.id);

        if (updateError) {
          console.error("[GoogleAuth] Error linking auth_user_id:", updateError);
          return { redirectTo: "/auth/login", error: "Erro ao vincular conta Google ao perfil existente." };
        }
      } else {
        // Case: No record exists for this email - Create new one
        console.log("[GoogleAuth] Creating new user record...");
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
          console.error("[GoogleAuth] Error creating user record:", insertError);
          return { redirectTo: "/auth/login", error: "Erro ao criar perfil no banco de dados." };
        }
      }
    }

    console.log("[GoogleAuth] final_record_lookup_started");
    const { data: finalRecord, error: finalError } = await supabaseAdmin
      .from("usuarios")
      .select("id, is_passageiro, is_motorista, cpf, celular, data_nascimento, cidade_id")
      .eq("auth_user_id", userId)
      .single();

    if (finalError || !finalRecord) {
      console.error("[GoogleAuth] final_record_lookup_failed:", finalError);
      return { redirectTo: "/auth/login", error: "Erro ao recuperar perfil atualizado." };
    }

    console.log("[GoogleAuth] final_record_found=true");
    console.log("[GoogleAuth] deciding_navigation");

    // Rule 1: Verify if mandatory registration is complete
    const isRegistrationComplete = !!(
      finalRecord.cpf && 
      finalRecord.celular && 
      finalRecord.data_nascimento && 
      finalRecord.cidade_id
    );

    if (!isRegistrationComplete) {
      console.log("[GoogleAuth] navigation_decision=completar-cadastro");
      return { redirectTo: "/auth/completar-cadastro" };
    }

    // Rule 2: Apply profile check after registration is complete
    if (!finalRecord.is_passageiro && !finalRecord.is_motorista) {
      console.log("[GoogleAuth] navigation_decision=perfil");
      return { redirectTo: "/auth/perfil" };
    }

    console.log("[GoogleAuth] navigation_decision=home");
    return { redirectTo: "/" };
  });

export const updateUserInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    cpf: z.string().length(11, "CPF deve ter 11 dígitos"),
    celular: z.string().min(10).max(11, "Celular deve ter 10 ou 11 dígitos"),
    data_nascimento: z.string().min(10, "Data de nascimento inválida"),
    cidade_id: z.string().uuid("Cidade inválida"),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { error } = await supabaseAdmin
      .from("usuarios")
      .update({
        cpf: data.cpf,
        celular: data.celular,
        data_nascimento: data.data_nascimento,
        cidade_id: data.cidade_id
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