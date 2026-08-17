import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const selectPassageiroPerfil = createServerFn({ method: "POST" })
  .handler(async ({ request }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { supabase: supabaseClient } = await import("@/integrations/supabase/client");
    
    // In a real app, we'd get the user from the session
    // For this technical phase, we expect the user to be authenticated in the client
    // and we'll verify the session here.
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session?.user) throw new Error("Não autorizado");

    const { error } = await supabaseAdmin
      .from("usuarios")
      .update({
        is_passageiro: true,
        perfil_ativo: 'passageiro'
      })
      .eq("auth_user_id", session.user.id);

    if (error) throw new Error(error.message);
    return { success: true };
  });

export const selectMotoristaPerfil = createServerFn({ method: "POST" })
  .handler(async ({ request }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { supabase: supabaseClient } = await import("@/integrations/supabase/client");
    
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session?.user) throw new Error("Não autorizado");

    // 1. Get user ID
    const { data: user, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", session.user.id)
      .single();

    if (userError || !user) throw new Error("Usuário não encontrado");

    // 2. Update user profile
    const { error: updateError } = await supabaseAdmin
      .from("usuarios")
      .update({
        is_motorista: true,
        perfil_ativo: 'motorista'
      })
      .eq("id", user.id);

    if (updateError) throw new Error(updateError.message);

    // 3. Create motorista record
    const { error: motoristaError } = await supabaseAdmin
      .from("motoristas")
      .insert({
        id: user.id,
        status_aprovacao: 'em_preenchimento',
        nota_media: 0
      });

    if (motoristaError) throw new Error(motoristaError.message);

    return { success: true };
  });
