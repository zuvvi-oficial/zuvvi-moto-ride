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

export const getChamadosSuporte = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => 
    z.object({
      busca: z.string().optional(),
      tipo: z.enum(["todos", "duvida", "sos", "reclamacao"]).optional(),
      status: z.enum(["aberto", "em_atendimento", "resolvido", "fechado"]).optional(),
    }).parse(data)
  )
  .handler(async ({ context, data }) => {
    await checkAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("chamados_suporte")
      .select(`
        id,
        usuario_id,
        corrida_id,
        tipo,
        status,
        descricao,
        created_at,
        updated_at,
        usuarios!chamados_suporte_usuario_id_fkey(nome, email, celular),
        corridas!chamados_suporte_corrida_id_fkey(codigo_embarque)
      `)
      .order("created_at", { ascending: false });

    if (data.tipo && data.tipo !== "todos") {
      query = query.eq("tipo", data.tipo);
    }
    if (data.status) {
      query = query.eq("status", data.status);
    }
    if (data.busca) {
      query = query.or(`usuarios.nome.ilike.%${data.busca}%,usuarios.email.ilike.%${data.busca}%,descricao.ilike.%${data.busca}%`);
    }

    const { data: chamados, error } = await query;
    if (error) throw new Error(error.message);
    return chamados;
  });

export const criarChamadoSuporte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => 
    z.object({
      tipo: z.enum(["duvida", "sos", "reclamacao"]),
      descricao: z.string().transform(s => s.trim()).refine(s => s.length >= 10, {
        message: "A descrição deve ter pelo menos 10 caracteres."
      }).refine(s => s.length <= 2000, {
        message: "A descrição deve ter no máximo 2.000 caracteres."
      }),
    }).parse(data)
  )
  .handler(async ({ context, data }) => {
    // Localizar usuarios.id por auth_user_id usando context.supabase (respeita RLS)
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
