import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAuthContextFromRequest } from "./auth-status.server";

/**
 * Versão interna server-only para evitar recursão e problemas de header no SSR.
 */
async function resolveDestinationInternal(userId: string, email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1. Regra de segurança ADM: e-mail confirmado mokahz@gmail.com
  const isAdmin = email === 'mokahz@gmail.com';

  if (isAdmin) {
    // Bootstrap idempotente em admin_users
    await supabaseAdmin.from("admin_users").upsert(
      { auth_user_id: userId, role: 'admin', ativo: true },
      { onConflict: 'auth_user_id' }
    );
    
    return { 
      isAdmin: true,
      redirectTo: "/admin"
    };
  }

  // 2. Verificar status para usuários comuns
  const { data: userRecord } = await supabaseAdmin
    .from("usuarios")
    .select("is_passageiro, is_motorista, cpf, celular, data_nascimento, cidade_id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (!userRecord) {
    return { isAdmin: false, redirectTo: "/auth/completar-cadastro" };
  }

  const isRegistrationComplete = !!(
    userRecord.cpf && 
    userRecord.celular && 
    userRecord.data_nascimento && 
    userRecord.cidade_id
  );

  if (!isRegistrationComplete) {
    return { isAdmin: false, redirectTo: "/auth/completar-cadastro" };
  }

  const hasProfile = !!(userRecord.is_passageiro || userRecord.is_motorista);
  if (!hasProfile) {
    return { isAdmin: false, redirectTo: "/auth/perfil" };
  }

  return { 
    isAdmin: false,
    isPassageiro: userRecord.is_passageiro,
    isMotorista: userRecord.is_motorista,
    redirectTo: userRecord.is_motorista ? "/onboarding-motorista" : "/"
  };
}

export const resolvePostLoginDestination = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return resolveDestinationInternal(context.userId, context.claims.email || '');
  });

/**
 * Função segura para ser chamada por loaders (SSR) sem causar loop 500.
 */
export const resolveDestinationForLoader = createServerFn({ method: "GET" })
  .handler(async () => {
    const auth = await getAuthContextFromRequest();
    if (!auth) {
      return { redirectTo: "/auth/login" };
    }
    return resolveDestinationInternal(auth.userId, auth.email);
  });

export const checkUserProfileStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const email = context.claims.email;

    const isAdmin = email === 'mokahz@gmail.com';

    if (isAdmin) {
      return { 
        hasProfile: true, 
        isAdmin: true,
        isRegistrationComplete: true,
        redirectTo: "/admin"
      };
    }

    const { data: userRecord, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("is_passageiro, is_motorista, nome, cpf, celular, data_nascimento, city:cidade_id")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (userError || !userRecord) {
      return { hasProfile: false, isAdmin: false };
    }

    const isRegistrationComplete = !!(
      userRecord.cpf && 
      userRecord.celular && 
      userRecord.data_nascimento && 
      userRecord.city
    );

    return { 
      hasProfile: !!(userRecord.is_passageiro || userRecord.is_motorista),
      isAdmin: false,
      isPassageiro: userRecord.is_passageiro,
      isMotorista: userRecord.is_motorista,
      nome: userRecord.nome,
      isRegistrationComplete
    };
  });
