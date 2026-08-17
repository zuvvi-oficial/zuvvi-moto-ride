import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const signInSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

export const signIn = createServerFn({ method: "POST" })
  .inputValidator((data) => signInSchema.parse(data))
  .handler(async ({ data }) => {
    // Import inside handler to avoid client bundle issues
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // In a real flow, we'd use supabase.auth.signInWithPassword on the client
    // but here we validate credentials via server function for consistency with the existing signUp pattern
    // and to handle custom logic if needed. 
    // Note: This does NOT establish the browser session by itself, 
    // the client-side code will use supabase client for session management.
    
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (authError) {
      // Return a generic error for security as requested
      throw new Error("E-mail ou senha incorretos.");
    }

    return { 
      success: true, 
      session: authData.session,
      user: authData.user 
    };
  });
