import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Exportado para quem precisa assinar a mesma foto por outro motivo (ex.: o
// ícone da notificação push de chat) sem duplicar o nome do bucket.
export const PROFILE_BUCKET = "fotos-perfil";
const PROFILE_PATH_PATTERN = /^[0-9a-f-]{36}\/avatar\.jpg$/i;

// Chave de query compartilhada entre quem lê a foto (tela de perfil e o
// cabeçalho da tela de início), pra invalidar um lugar só refletir nos dois.
export const PASSENGER_PROFILE_PHOTO_QUERY_KEY = ["passenger-profile-photo"] as const;

export const getPassengerProfilePhoto = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: usuario, error } = await admin
      .from("usuarios")
      .select("is_passageiro, foto_perfil_path")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    if (error || !usuario || usuario.is_passageiro !== true) {
      throw new Error("Perfil de passageiro não encontrado.");
    }

    const path = typeof usuario.foto_perfil_path === "string" ? usuario.foto_perfil_path : null;
    if (!path) {
      return { path: null, signedUrl: null };
    }

    const { data: signed, error: signedError } = await admin.storage
      .from(PROFILE_BUCKET)
      .createSignedUrl(path, 60 * 60);

    if (signedError || !signed?.signedUrl) {
      return { path, signedUrl: null };
    }

    return { path, signedUrl: signed.signedUrl };
  });

export const savePassengerProfilePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ path: z.string().min(1).max(200) })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const expectedPath = `${context.userId}/avatar.jpg`;
    if (!PROFILE_PATH_PATTERN.test(data.path) || data.path !== expectedPath) {
      throw new Error("Caminho da foto inválido.");
    }

    const { data: usuario, error: userError } = await admin
      .from("usuarios")
      .select("id, is_passageiro")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    if (userError || !usuario || usuario.is_passageiro !== true) {
      throw new Error("Perfil de passageiro não encontrado.");
    }

    const { error: updateError } = await admin
      .from("usuarios")
      .update({ foto_perfil_path: expectedPath })
      .eq("id", usuario.id);

    if (updateError) {
      throw new Error("Não foi possível salvar a foto de perfil.");
    }

    return { success: true, path: expectedPath };
  });
