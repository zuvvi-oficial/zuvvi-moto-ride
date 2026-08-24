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
        *,
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
      assunto: z.string().min(3).max(100),
      descricao: z.string().min(10).max(1000),
      corrida_id: z.string().uuid().optional(),
    }).parse(data)
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Gerar protocolo: ZUV-YYYYMMDD-XXXX (4 últimos dígitos do timestamp)
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    const protocolo = `ZUV-${datePart}-${randomPart}`;

    const { data: chamado, error } = await supabaseAdmin
      .from("chamados_suporte")
      .insert({
        usuario_id: context.userId,
        protocolo,
        tipo: data.tipo,
        assunto: data.assunto,
        descricao: data.descricao,
        corrida_id: data.corrida_id,
        status: "aberto"
      })
      .select()
      .single();

    if (error) {
      console.error("Erro ao criar chamado:", error);
      throw new Error("Não foi possível registrar seu chamado. Tente novamente.");
    }

    return chamado;
  });
