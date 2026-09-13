import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Exportado para quem precisa assinar a mesma foto por outro motivo (ex.: o
// ícone da notificação push de chat) sem duplicar o nome do bucket.
export const PROFILE_BUCKET = "fotos-perfil";
const PROFILE_PATH_PATTERN = /^[0-9a-f-]{36}\/avatar\.jpg$/i;

// 24h cobre o pior caso de qualquer um dos usos: o push de chat só é aberto
// quando o destinatário vir a notificação (pode demorar), e o mesmo prazo do
// TTL do próprio envio em web-push.server.ts. O card de pedido de corrida
// (polling a cada 5s) não precisa de tanto, mas uma URL que vive mais do que
// o necessário não tem custo — só evita reassinar toda hora.
const SIGNED_URL_TTL_SECONDS = 24 * 60 * 60;
// Gera de novo só perto do fim da validade (não a cada chamada): o motorista
// online sem corrida repete getOfertasDisponiveis a cada 5s (Codex, PR #113),
// e uma URL assinada nova a cada vez troca o "src" da imagem sem necessidade,
// forçando o navegador a rebaixar a mesma foto e gastando uma assinatura no
// Storage por nada.
const REFRESH_MARGIN_MS = 30 * 60 * 1000;
const cacheUrlsAssinadas = new Map<string, { url: string; expiraEm: number }>();

// Compartilhado por quem precisa da foto de perfil de um passageiro por
// qualquer motivo (notificação de chat, card de pedido de corrida) — cacheia
// a URL assinada em memória do processo até perto de expirar.
export async function obterUrlAssinadaFotoPerfil(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mesmo padrão de admin solto usado no resto do arquivo
  supabaseAdmin: any,
  path: string,
): Promise<string | null> {
  const cache = cacheUrlsAssinadas.get(path);
  if (cache && cache.expiraEm - Date.now() > REFRESH_MARGIN_MS) {
    return cache.url;
  }

  // Nunca pode derrubar quem chama: uma falha aqui (ex.: instabilidade
  // pontual do Storage) significa só "sem foto desta vez", nunca a lista
  // inteira de pedidos de corrida sumindo para o motorista (achado do Codex
  // no PR #114 — o bloco antigo de assinatura tinha esse try/catch, que se
  // perdeu quando virou este helper compartilhado).
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(PROFILE_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

    if (error || !data?.signedUrl) return null;

    cacheUrlsAssinadas.set(path, {
      url: data.signedUrl,
      expiraEm: Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
    });
    return data.signedUrl;
  } catch {
    return null;
  }
}

// Chamado quando a foto de um caminho muda de verdade (savePassengerProfilePhoto
// abaixo). O caminho no Storage é sempre o mesmo (.../avatar.jpg), então sem
// isso o cache continuaria servindo a URL antiga por até 24h — e como a URL
// não muda, o <img> no card do motorista nem tenta buscar de novo, mostrando
// a foto velha mesmo depois do passageiro trocar (achado do Codex no PR #114).
export function invalidarCacheFotoPerfil(path: string): void {
  cacheUrlsAssinadas.delete(path);
}

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
  .inputValidator((data: unknown) => z.object({ path: z.string().min(1).max(200) }).parse(data))
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

    invalidarCacheFotoPerfil(expectedPath);

    return { success: true, path: expectedPath };
  });
