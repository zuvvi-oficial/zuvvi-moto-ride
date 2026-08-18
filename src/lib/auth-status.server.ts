import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import type { Database } from "@/integrations/supabase/types";

export interface AuthContext {
  userId: string;
  email: string;
  isAdmin: boolean;
}

export async function getAuthContextFromRequest(): Promise<AuthContext | null> {
  const request = getRequest();
  if (!request) return null;

  const SUPABASE_URL = process.env['SUPABASE_URL'] as string;
  const SUPABASE_PUBLISHABLE_KEY = process.env['SUPABASE_PUBLISHABLE_KEY'] as string;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;

  const supabase = createServerClient<Database>(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => parseCookieHeader(request.headers.get('Cookie') ?? ''),
        setAll: () => {}, // Read-only for this check
      },
    }
  );

  try {
    // Priority 1: Authorization Header (from server functions)
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const { data: authData, error } = await supabase.auth.getUser(token);
      if (!error && authData?.user) {
        const user = authData.user;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: adminData } = await supabaseAdmin.auth.admin.getUserById(user.id);
        const adminUser = adminData?.user;
        
        return {
          userId: user.id,
          email: adminUser?.email || user.email || '',
          isAdmin: adminUser?.email === 'mokahz@gmail.com' && !!adminUser?.email_confirmed_at
        };
      }
    }

    // Priority 2: Session from Cookies (from SSR loaders)
    const cookies = parseCookieHeader(request.headers.get('Cookie') ?? '');
    const accessToken = cookies.find(c => c.name === 'sb-access-token')?.value;

    if (accessToken) {
      const { data: authData, error: userError } = await supabase.auth.getUser(accessToken);
      if (!userError && authData?.user) {
        const user = authData.user;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: adminData } = await supabaseAdmin.auth.admin.getUserById(user.id);
        const adminUser = adminData?.user;

        return {
          userId: user.id,
          email: adminUser?.email || user.email || '',
          isAdmin: adminUser?.email === 'mokahz@gmail.com' && !!adminUser?.email_confirmed_at
        };
      }
    }
    
    return null;
  } catch (e) {
    return null;
  }
}
