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

    if (!userId) {
      throw new Error("Não encontramos seu cadastro autenticado. Saia e entre novamente.");
    }

    // 1. Verificar se o registro em public.usuarios existe
    const { data: userRecord, error: fetchError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (fetchError || !userRecord) {
      console.error("[updateUserInfo] User record not found for auth_user_id:", userId);
      throw new Error("Não encontramos seu cadastro autenticado. Saia e entre novamente.");
    }

    // 2. Executar o UPDATE
    const { data: updatedData, error: updateError } = await supabaseAdmin
      .from("usuarios")
      .update({
        cpf: data.cpf,
        celular: data.celular,
        data_nascimento: data.data_nascimento,
        cidade_id: data.cidade_id
      })
      .eq("auth_user_id", userId)
      .select("id");

    if (updateError) {
      console.error("[updateUserInfo] Error updating user info:", updateError);
      
      if (updateError.code === '23505') {
        if (updateError.message?.includes('usuarios_cpf_key')) {
          throw new Error("Este CPF já está cadastrado em outra conta.");
        }
        if (updateError.message?.includes('usuarios_celular_key')) {
          throw new Error("Este número de celular já está cadastrado em outra conta.");
        }
      }
      
      throw new Error("Erro ao salvar informações. Tente novamente.");
    }

    if (!updatedData || updatedData.length === 0) {
      throw new Error("Não foi possível atualizar seu cadastro. Tente sair e entrar novamente.");
    }

    return { success: true, updated: true };
  });