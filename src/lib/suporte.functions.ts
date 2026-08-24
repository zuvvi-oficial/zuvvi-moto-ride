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
