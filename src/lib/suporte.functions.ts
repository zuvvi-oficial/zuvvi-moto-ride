import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function checkAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: admin, error } = await supabaseAdmin
    .from("admin_users")
    .select("role, ativo")
    .eq("auth_user_id", userId)
    .single();

  if (error || !admin || !admin.ativo || admin.role !== "admin") {
    throw new Error("Acesso negado: Administrador não autorizado.");
  }

  return admin;
}

function throwSafeSupportActionError(message?: string): never {
  const normalized = message?.toLowerCase() ?? "";

  if (normalized.includes("não autorizado") || normalized.includes("inativo")) {
    throw new Error("Sua sessão não possui autorização para realizar esta ação.");
  }
  if (normalized.includes("não encontrado")) {
    throw new Error("O chamado não foi encontrado. Atualize a Central de Suporte.");
  }
  if (normalized.includes("somente chamados abertos")) {
    throw new Error("Este chamado não está mais aberto.");
  }
  if (normalized.includes("deve estar em atendimento")) {
    throw new Error("Inicie o atendimento antes de enviar uma resposta.");
  }
  if (normalized.includes("somente chamados em atendimento")) {
    throw new Error("Somente chamados em atendimento podem ser resolvidos.");
  }
  if (normalized.includes("somente chamados resolvidos")) {
    throw new Error("Esta ação só está disponível para chamados resolvidos.");
  }
  if (normalized.includes("entre 1 e 2000")) {
    throw new Error("A mensagem deve ter entre 1 e 2.000 caracteres.");
  }

  throw new Error("Não foi possível concluir a ação. Atualize a tela e tente novamente.");
}

const chamadoIdSchema = z.object({
  chamadoId: z.string().uuid("Chamado inválido."),
});

const mensagemAdminSchema = chamadoIdSchema.extend({
  mensagem: z
    .string()
    .trim()
    .min(1, "Escreva uma mensagem antes de continuar.")
    .max(2000, "A mensagem deve ter no máximo 2.000 caracteres."),
});

export const getChamadosSuporte = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        busca: z.string().optional(),
        tipo: z.enum(["todos", "duvida", "sos", "reclamacao"]).optional(),
        status: z.enum(["aberto", "em_atendimento", "resolvido", "fechado"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await checkAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("chamados_suporte")
      .select(
        `
        id,
        usuario_id,
        corrida_id,
        tipo,
        status,
        descricao,
        atendente_id,
        data_resolucao,
        created_at,
        updated_at,
        usuarios!chamados_suporte_usuario_id_fkey(nome, email, celular),
        corridas!chamados_suporte_corrida_id_fkey(codigo_embarque)
      `,
      )
      .order("created_at", { ascending: false });

    if (data.tipo && data.tipo !== "todos") {
      query = query.eq("tipo", data.tipo);
    }
    if (data.status) {
      query = query.eq("status", data.status);
    }
    if (data.busca) {
      query = query.or(
        `usuarios.nome.ilike.%${data.busca}%,usuarios.email.ilike.%${data.busca}%,descricao.ilike.%${data.busca}%`,
      );
    }

    const { data: chamados, error } = await query;
    if (error) throw new Error(error.message);

    return chamados;
  });

export const getChamadoSuporteDetalhe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => chamadoIdSchema.parse(data))
  .handler(async ({ context, data }) => {
    await checkAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [chamadoResult, mensagensResult] = await Promise.all([
      supabaseAdmin
        .from("chamados_suporte")
        .select(
          `
          id,
          usuario_id,
          corrida_id,
          tipo,
          status,
          descricao,
          atendente_id,
          data_resolucao,
          created_at,
          updated_at,
          usuarios!chamados_suporte_usuario_id_fkey(nome, email, celular),
          corridas!chamados_suporte_corrida_id_fkey(codigo_embarque)
        `,
        )
        .eq("id", data.chamadoId)
        .single(),
      supabaseAdmin
        .from("mensagens_suporte")
        .select("id, chamado_id, autor_usuario_id, autor_admin_id, corpo, created_at")
        .eq("chamado_id", data.chamadoId)
        .order("created_at", { ascending: true }),
    ]);

    if (chamadoResult.error || !chamadoResult.data) {
      throw new Error("Chamado não encontrado.");
    }
    if (mensagensResult.error) {
      throw new Error("Não foi possível carregar o histórico do atendimento.");
    }

    return {
      chamado: chamadoResult.data,
      mensagens: mensagensResult.data ?? [],
    };
  });

export const iniciarAtendimentoSuporte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => chamadoIdSchema.parse(data))
  .handler(async ({ context, data }) => {
    await checkAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.rpc("suporte_iniciar_atendimento", {
      _chamado_id: data.chamadoId,
      _admin_auth_id: context.userId,
    });

    if (error) throwSafeSupportActionError(error.message);
    return { success: true as const, status: "em_atendimento" as const };
  });

export const responderChamadoSuporte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => mensagemAdminSchema.parse(data))
  .handler(async ({ context, data }) => {
    await checkAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.rpc("suporte_responder_chamado", {
      _chamado_id: data.chamadoId,
      _admin_auth_id: context.userId,
      _corpo: data.mensagem,
    });

    if (error) throwSafeSupportActionError(error.message);
    return { success: true as const };
  });

export const resolverChamadoSuporte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => mensagemAdminSchema.parse(data))
  .handler(async ({ context, data }) => {
    await checkAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.rpc("suporte_resolver_chamado", {
      _chamado_id: data.chamadoId,
      _admin_auth_id: context.userId,
      _mensagem_final: data.mensagem,
    });

    if (error) throwSafeSupportActionError(error.message);
    return { success: true as const, status: "resolvido" as const };
  });

export const reabrirChamadoSuporte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => chamadoIdSchema.parse(data))
  .handler(async ({ context, data }) => {
    await checkAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.rpc("suporte_reabrir_chamado", {
      _chamado_id: data.chamadoId,
      _admin_auth_id: context.userId,
    });

    if (error) throwSafeSupportActionError(error.message);
    return { success: true as const, status: "em_atendimento" as const };
  });

export const fecharChamadoSuporte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => chamadoIdSchema.parse(data))
  .handler(async ({ context, data }) => {
    await checkAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.rpc("suporte_fechar_chamado", {
      _chamado_id: data.chamadoId,
      _admin_auth_id: context.userId,
    });

    if (error) throwSafeSupportActionError(error.message);
    return { success: true as const, status: "fechado" as const };
  });

export const criarChamadoSuporte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        tipo: z.enum(["duvida", "sos", "reclamacao"]),
        descricao: z
          .string()
          .transform((value) => value.trim())
          .refine((value) => value.length >= 10, {
            message: "A descrição deve ter pelo menos 10 caracteres.",
          })
          .refine((value) => value.length <= 2000, {
            message: "A descrição deve ter no máximo 2.000 caracteres.",
          }),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { data: usuario, error: userError } = await context.supabase
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", context.userId)
      .single();

    if (userError || !usuario) {
      throw new Error("Usuário não encontrado.");
    }

    const { data: chamado, error } = await context.supabase
      .from("chamados_suporte")
      .insert({
        usuario_id: usuario.id,
        tipo: data.tipo,
        descricao: data.descricao,
      })
      .select("id, status, created_at")
      .single();

    if (error) {
      console.error("Erro ao criar chamado:", error);
      throw new Error("Não foi possível registrar seu chamado. Tente novamente.");
    }

    return chamado;
  });
