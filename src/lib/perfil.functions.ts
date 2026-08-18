import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const selectPassageiroPerfil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (authUser?.email === 'mokahz@gmail.com' && !!authUser?.email_confirmed_at) {
      throw new Error("Administradores não devem selecionar perfil de passageiro.");
    }

    const { error } = await supabaseAdmin
      .from("usuarios")
      .update({
        is_passageiro: true,
        perfil_ativo: 'passageiro'
      })
      .eq("auth_user_id", userId);

    if (error) throw new Error(error.message);
    return { success: true };
  });

export const selectMotoristaPerfil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (authUser?.email === 'mokahz@gmail.com' && !!authUser?.email_confirmed_at) {
      throw new Error("Administradores não devem selecionar perfil de motorista.");
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", userId)
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
      .upsert({
        id: user.id,
        status_aprovacao: 'em_preenchimento',
        nota_media: 0
      }, { onConflict: 'id' });

    if (motoristaError) throw new Error(motoristaError.message);

    return { success: true };
  });
