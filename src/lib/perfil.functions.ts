import { createServerFn } from "@tanstack/react-start";

export const selectPassageiroPerfil = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { supabase: supabaseClient } = await import("@/integrations/supabase/client");
    
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
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { supabase: supabaseClient } = await import("@/integrations/supabase/client");
    
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session?.user) throw new Error("Não autorizado");

    const { data: user, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", session.user.id)
      .single();

    if (userError || !user) throw new Error("Usuário não encontrado");

    const { error: updateError } = await supabaseAdmin
      .from("usuarios")
      .update({
        is_motorista: true,
        perfil_ativo: 'motorista'
      })
      .eq("id", user.id);

    if (updateError) throw new Error(updateError.message);

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
