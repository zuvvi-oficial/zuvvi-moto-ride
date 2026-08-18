import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const handleGoogleAuthRedirect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;

    if (!userId) {
      return { redirectTo: "/auth/login", error: "Usuário não identificado pelo servidor." };
    }
    
    // Obter e importar a lógica interna diretamente para evitar chamada de createServerFn encadeada
    const { resolveDestinationInternal } = await import("./auth-status.functions");
    return await resolveDestinationInternal(userId);
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