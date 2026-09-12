import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  obterUrlAssinadaFotoPerfil,
  invalidarCacheFotoPerfil,
} from "@/lib/passenger-profile-photo.functions";

const PROFILE_PATH_PATTERN = /^[0-9a-f-]{36}\/avatar\.jpg$/i;

// Chave de query própria do motorista — mesmo padrão do passageiro, mas
// separada porque cada papel lê seu próprio server function (o cache do
// React Query é por chave, não por usuário).
export const MOTORISTA_PROFILE_PHOTO_QUERY_KEY = ["motorista-profile-photo"] as const;

export const getMotoristaProfilePhoto = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mesmo padrão de admin solto usado no resto do arquivo
    const admin = supabaseAdmin as any;

    const { data: usuario, error } = await admin
      .from("usuarios")
      .select("is_motorista, foto_perfil_path")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    if (error || !usuario || usuario.is_motorista !== true) {
      throw new Error("Perfil de motorista não encontrado.");
    }

    const path = typeof usuario.foto_perfil_path === "string" ? usuario.foto_perfil_path : null;
    if (!path) {
      return { path: null, signedUrl: null };
    }

    const signedUrl = await obterUrlAssinadaFotoPerfil(admin, path);
    return { path, signedUrl };
  });

export const saveMotoristaProfilePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ path: z.string().min(1).max(200) }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mesmo padrão de admin solto usado no resto do arquivo
    const admin = supabaseAdmin as any;

    const expectedPath = `${context.userId}/avatar.jpg`;
    if (!PROFILE_PATH_PATTERN.test(data.path) || data.path !== expectedPath) {
      throw new Error("Caminho da foto inválido.");
    }

    const { data: usuario, error: userError } = await admin
      .from("usuarios")
      .select("id, is_motorista")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    if (userError || !usuario || usuario.is_motorista !== true) {
      throw new Error("Perfil de motorista não encontrado.");
    }

    const { error: updateError } = await admin
      .from("usuarios")
      .update({ foto_perfil_path: expectedPath })
      .eq("id", usuario.id);

    if (updateError) {
      throw new Error("Não foi possível salvar a foto de perfil.");
    }

    invalidarCacheFotoPerfil(expectedPath);

    return { success: true, path: expectedPath };
  });
