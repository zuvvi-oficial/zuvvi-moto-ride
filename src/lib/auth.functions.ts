import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const signUpSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  nome: z.string().min(3, "Nome muito curto"),
  cpf: z.string().length(11, "CPF deve ter 11 dígitos"),
  celular: z.string().min(10, "Telefone inválido"),
  data_nascimento: z.string().optional(),
  
});

export const signUp = createServerFn({ method: "POST" })
  .inputValidator((data) => signUpSchema.parse(data))
  .handler(async ({ data }) => {
    // Import inside handler to avoid client bundle issues
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // 1. Criar usuário no Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true, // Auto-confirmar para facilidade técnica inicial
      user_metadata: {
        nome: data.nome,
        role: data.perfil_inicial
      }
    });

    if (authError) {
      throw new Error(authError.message);
    }

    if (!authData.user) {
      throw new Error("Erro ao criar usuário");
    }

    // 2. Criar registro na tabela public.usuarios
    const { error: dbError } = await supabaseAdmin
      .from("usuarios")
      .insert({
        auth_user_id: authData.user.id,
        nome: data.nome,
        email: data.email,
        cpf: data.cpf,
        celular: data.celular,
        data_nascimento: data.data_nascimento ?? null,
        is_passageiro: data.perfil_inicial === "passageiro",
        is_motorista: data.perfil_inicial === "motorista",
        perfil_ativo: data.perfil_inicial as any,
      });

    if (dbError) {
      // Cleanup: se falhar no DB, remover do Auth (opcional, mas recomendado)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error(dbError.message);
    }

    return { success: true, userId: authData.user.id };
  });
