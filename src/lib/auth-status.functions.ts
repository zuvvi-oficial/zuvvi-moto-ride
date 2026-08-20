import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAuthContextFromRequest } from "./auth-status.server";

/**
 * Unificação da lógica de decisão de destino pós-login e guardas de rota.
 * Esta função é central e deve ser a única fonte de verdade para o destino de um usuário.
 */
export async function resolveDestinationInternal(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1. Validar a identidade real via Supabase Admin (Server-side trust)
  const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
  
  if (authError || !user) {
    console.error("[AuthInternal] Erro ao obter usuário do Auth:", authError);
    return { redirectTo: "/auth/login" };
  }

  const email = user.email;
  
  // 2. Verificar se o usuário é um Administrador ativo no banco
  const { data: adminRecord } = await supabaseAdmin
    .from("admin_users")
    .select("role")
    .eq("auth_user_id", userId)
    .eq("role", "admin")
    .eq("ativo", true)
    .maybeSingle();

  if (adminRecord) {
    return { 
      isAdmin: true,
      redirectTo: "/admin"
    };
  }

  // 3. Verificar status para usuários comuns
  let { data: userRecord } = await supabaseAdmin
    .from("usuarios")
    .select("id, is_passageiro, is_motorista, cpf, celular, data_nascimento, cidade_id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  // 4. Se não existir, criar registro inicial idempotente
  if (!userRecord) {
    console.log("[AuthInternal] Criando registro inicial para usuário Google:", userId);
    
    const userMetadata = user.user_metadata || {};
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from("usuarios")
      .upsert({
        auth_user_id: userId,
        email: email || '',
        nome: String(userMetadata['full_name'] || userMetadata['name'] || email?.split('@')[0] || 'Usuário Zuvvi'),
        is_passageiro: false,
        is_motorista: false
      }, { onConflict: 'auth_user_id' })
      .select("id, is_passageiro, is_motorista, cpf, celular, data_nascimento, cidade_id")
      .single();

    if (insertError) {
      console.error("[AuthInternal] Erro ao criar registro inicial:", insertError);
      return { redirectTo: "/auth/login", error: "Erro na sincronização de perfil. Tente novamente." };
    }
    
    userRecord = newUser;
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

  let finalRedirect = "/";
  if (userRecord.is_motorista) {
    // Buscar status de aprovação do motorista
    const { data: motoristaRecord } = await supabaseAdmin
      .from("motoristas")
      .select("status_aprovacao")
      .eq("usuario_id", userRecord.id)
      .maybeSingle();

    if (motoristaRecord?.status_aprovacao === "aprovado") {
      finalRedirect = "/home-motorista";
    } else {
      finalRedirect = "/onboarding-motorista";
    }
  }

  return { 
    isAdmin: false,
    isPassageiro: userRecord.is_passageiro,
    isMotorista: userRecord.is_motorista,
    redirectTo: finalRedirect
  };
}

/**
 * Função chamada após login (Google ou E-mail) para decidir o destino.
 */
export const resolvePostLoginDestination = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return resolveDestinationInternal(context.userId);
  });

/**
 * Função segura para ser chamada por loaders (SSR) sem causar loop 500.
 * Obtém a sessão via cookies se disponível.
 */
export const resolveDestinationForLoader = createServerFn({ method: "GET" })
  .handler(async () => {
    const auth = await getAuthContextFromRequest();
    if (!auth) {
      return { redirectTo: "/auth/login" };
    }
    return resolveDestinationInternal(auth.userId);
  });

/**
 * Verifica o status completo do perfil para uso na interface.
 */
export const checkUserProfileStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // A decisão de destino já contém as verificações necessárias
    const destination = await resolveDestinationInternal(userId);
    
    if (destination.isAdmin) {
      return { 
        hasProfile: true, 
        isAdmin: true,
        isRegistrationComplete: true,
        redirectTo: "/admin"
      };
    }

    const { data: userRecord } = await supabaseAdmin
      .from("usuarios")
      .select("is_passageiro, is_motorista, nome, cpf, celular, data_nascimento, city:cidade_id")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (!userRecord) {
      return { hasProfile: false, isAdmin: false, redirectTo: "/auth/completar-cadastro" };
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
      isRegistrationComplete,
      redirectTo: destination.redirectTo
    };
  });

/**
 * Retorna o status de autenticação simplificado para a Home.
 */
export const getAuthStatus = createServerFn({ method: "GET" })
  .handler(async () => {
    const auth = await getAuthContextFromRequest();
    if (!auth) {
      return { authenticated: false };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [userResult, adminResult] = await Promise.all([
      supabaseAdmin
        .from("usuarios")
        .select("nome, is_passageiro, is_motorista, cpf, celular, data_nascimento, city:cidade_id")
        .eq("auth_user_id", auth.userId)
        .maybeSingle(),
      supabaseAdmin
        .from("admin_users")
        .select("role, ativo")
        .eq("auth_user_id", auth.userId)
        .eq("role", "admin")
        .eq("ativo", true)
        .maybeSingle()
    ]);

    const userRecord = userResult.data;
    const isAdmin = !!adminResult.data;

    const isRegistrationComplete = isAdmin || !!(
      userRecord?.cpf && 
      userRecord?.celular && 
      userRecord?.data_nascimento && 
      userRecord?.city
    );

    return { 
      authenticated: true,
      nome: userRecord?.nome || auth.email,
      isPassageiro: userRecord?.is_passageiro || false,
      isMotorista: userRecord?.is_motorista || false,
      isRegistrationComplete
    };
  });
