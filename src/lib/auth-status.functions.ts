import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const checkUserProfileStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(userId);

    // Regra de segurança ADM: e-mail confirmado mokahz@gmail.com
    const isAdmin = authUser?.email === 'mokahz@gmail.com' && !!authUser?.email_confirmed_at;

    if (isAdmin) {
      // Garantir bootstrap idempotente
      await supabaseAdmin.from("admin_users").upsert(
        { auth_user_id: userId, role: 'admin', ativo: true },
        { onConflict: 'auth_user_id' }
      );
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

export const getAuthStatus = createServerFn({ method: "GET" })
  .handler(async () => {
    const SUPABASE_URL = process.env['SUPABASE_URL'];
    const SUPABASE_PUBLISHABLE_KEY = process.env['SUPABASE_PUBLISHABLE_KEY'];
    
    const request = getRequest();
    const authHeader = request?.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { authenticated: false };
    }

    const token = authHeader.replace('Bearer ', '');
    
    try {
      const supabase = createClient(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          persistSession: false,
        }
      });

      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        return { authenticated: false };
      }

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: userRecord } = await supabaseAdmin
        .from("usuarios")
        .select("nome, is_passageiro, is_motorista, cpf, celular, data_nascimento, city:cidade_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      const isRegistrationComplete = !!(
        userRecord?.cpf && 
        userRecord?.celular && 
        userRecord?.data_nascimento && 
        userRecord?.city
      );

      return { 
        authenticated: true,
        nome: userRecord?.nome || user.email,
        isPassageiro: userRecord?.is_passageiro || false,
        isMotorista: userRecord?.is_motorista || false,
        isRegistrationComplete
      };
    } catch (e) {
      console.error("Auth status error:", e);
      return { authenticated: false };
    }
  });

