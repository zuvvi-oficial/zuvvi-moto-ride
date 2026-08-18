import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const checkUserProfileStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: userRecord, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("is_passageiro, is_motorista, nome")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (userError || !userRecord) {
      return { hasProfile: false };
    }

    return { 
      hasProfile: !!(userRecord.is_passageiro || userRecord.is_motorista),
      isPassageiro: userRecord.is_passageiro,
      isMotorista: userRecord.is_motorista,
      nome: userRecord.nome
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
      .select("nome, is_passageiro, is_motorista")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    return { 
      authenticated: true,
      nome: userRecord?.nome || user.email,
      isPassageiro: userRecord?.is_passageiro || false,
      isMotorista: userRecord?.is_motorista || false
    };
  });

