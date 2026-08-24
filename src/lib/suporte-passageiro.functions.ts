import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const chamadoIdSchema = z.object({
  chamadoId: z.string().uuid("Chamado inválido."),
});

async function getUsuarioId(supabase: any, authUserId: string) {
  const { data: usuario, error } = await supabase
    .from("usuarios")
    .select("id")
    .eq("auth_user_id", authUserId)
    .single();

  if (error || !usuario) {
    throw new Error("Usuário não encontrado.");
  }

  return usuario.id as string;
}

/** Lista somente os chamados do passageiro autenticado. */
export const getMeusChamados = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const usuarioId = await getUsuarioId(context.supabase, context.userId);

    const { data, error } = await context.supabase
      .from("chamados_suporte")
      .select("id, tipo, status, descricao, created_at, updated_at, data_resolucao")
      .eq("usuario_id", usuarioId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao listar chamados do passageiro:", error);
      throw new Error("Não foi possível carregar seus chamados.");
    }

    return data ?? [];
  });

/** Detalhe + histórico de mensagens de um chamado do próprio passageiro. */
export const getMeuChamadoDetalhe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => chamadoIdSchema.parse(data))
  .handler(async ({ context, data }) => {
    const usuarioId = await getUsuarioId(context.supabase, context.userId);

    const { data: chamado, error } = await context.supabase
      .from("chamados_suporte")
      .select("id, tipo, status, descricao, created_at, updated_at, data_resolucao")
      .eq("id", data.chamadoId)
      .eq("usuario_id", usuarioId)
      .maybeSingle();

    if (error || !chamado) {
      throw new Error("Chamado não encontrado.");
    }

    const { data: mensagens, error: msgError } = await context.supabase
      .from("mensagens_suporte")
      .select("id, autor_usuario_id, autor_admin_id, corpo, created_at")
      .eq("chamado_id", chamado.id)
      .order("created_at", { ascending: true });

    if (msgError) {
      console.error("Erro ao carregar mensagens do chamado:", msgError);
      throw new Error("Não foi possível carregar o histórico do atendimento.");
    }

    return { chamado, mensagens: mensagens ?? [] };
  });

/** Envia uma nova mensagem do passageiro (somente chamado próprio em atendimento). */
export const enviarMensagemPassageiro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    chamadoIdSchema
      .extend({
        mensagem: z
          .string()
          .transform((value) => value.trim())
          .refine((value) => value.length >= 1, {
            message: "Escreva uma mensagem antes de enviar.",
          })
          .refine((value) => value.length <= 2000, {
            message: "A mensagem deve ter no máximo 2.000 caracteres.",
          }),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const usuarioId = await getUsuarioId(context.supabase, context.userId);

    const { data: chamado, error: chamadoError } = await context.supabase
      .from("chamados_suporte")
      .select("id, status")
      .eq("id", data.chamadoId)
      .eq("usuario_id", usuarioId)
      .maybeSingle();

    if (chamadoError || !chamado) {
      throw new Error("Chamado não encontrado.");
    }

    if (chamado.status !== "em_atendimento") {
      throw new Error("Este chamado não está em atendimento no momento.");
    }

    const { data: mensagem, error } = await context.supabase
      .from("mensagens_suporte")
      .insert({
        chamado_id: chamado.id,
        autor_usuario_id: usuarioId,
        corpo: data.mensagem,
      })
      .select("id, autor_usuario_id, autor_admin_id, corpo, created_at")
      .single();

    if (error) {
      console.error("Erro ao enviar mensagem do passageiro:", error);
      throw new Error("Não foi possível enviar sua mensagem. Tente novamente.");
    }

    return mensagem;
  });
