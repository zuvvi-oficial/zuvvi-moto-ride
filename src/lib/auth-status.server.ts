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
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        return {
          userId: user.id,
          email: user.email || '',
          isAdmin: user.email === 'mokahz@gmail.com' && !!user.email_confirmed_at
        };
      }
    }

    // Priority 2: Session from Cookies (from SSR loaders)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) return null;

    const isAdmin = user.email === 'mokahz@gmail.com' && !!user.email_confirmed_at;

    return {
      userId: user.id,
      email: user.email || '',
      isAdmin
    };
  } catch (e) {
    return null;
  }
}
