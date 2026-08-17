import { createServerFn } from "@tanstack/react-start";

export const handleGoogleAuthRedirect = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { supabase: supabaseClient } = await import("@/integrations/supabase/client");

    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session?.user) {
      return { redirectTo: "/auth/login" };
    }

    const { data: userRecord, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("is_passageiro, is_motorista")
      .eq("auth_user_id", session.user.id)
      .single();

    if (userError || !userRecord) {
      // Se não existe na tabela usuarios, cria o registro básico
      const { error: insertError } = await supabaseAdmin
        .from("usuarios")
        .insert({
          auth_user_id: session.user.id,
          nome: session.user.user_metadata.full_name || session.user.user_metadata.name || "Usuário Google",
          email: session.user.email,
          cpf: `GOOGLE_${session.user.id.slice(0, 5)}`, // Placeholder temporário se CPF for obrigatório e não vier do Google
          is_passageiro: false,
          is_motorista: false,
          perfil_ativo: null as any,
        });

      if (insertError) {
        console.error("Erro ao criar usuário via Google:", insertError);
        return { redirectTo: "/auth/login", error: "Erro ao criar perfil" };
      }

      return { redirectTo: "/auth/perfil" };
    }

    // Se já tem perfil definido, vai para a Home
    if (userRecord.is_passageiro || userRecord.is_motorista) {
      return { redirectTo: "/" };
    }

    // Se existe mas não escolheu perfil
    return { redirectTo: "/auth/perfil" };
  });
