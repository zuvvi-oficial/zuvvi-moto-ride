import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface AuthContext {
  userId: string;
  email: string;
  isAdmin: boolean;
}

export async function getAuthContextFromRequest(): Promise<AuthContext | null> {
  const request = getRequest();
  if (!request) return null;

  const authHeader = request.headers.get("authorization");

  const SUPABASE_URL = process.env['SUPABASE_URL'];
  const SUPABASE_PUBLISHABLE_KEY = process.env['SUPABASE_PUBLISHABLE_KEY'];

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;

  let token: string | null = null;
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  }

  if (!token) return null;

  try {
    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false }
    });
    
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) return null;

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
