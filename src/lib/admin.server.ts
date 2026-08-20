import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Middleware para exigir que o usuário seja um administrador ativo.
 */
export const requireAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // 1. Verificar se o usuário está na tabela admin_users e está ativo
    const { data: admin, error: dbError } = await supabaseAdmin
      .from("admin_users")
      .select("role, ativo")
      .eq("auth_user_id", userId)
      .single();

    if (dbError || !admin || !admin.ativo || admin.role !== "admin") {
      throw new Error("Acesso negado: Administrador não autorizado.");
    }

    return { userId, role: admin.role };
  });

/**
 * Helper para registrar logs de auditoria (uso interno server-side).
 */
export async function createAuditLog({
  adminId,
  acao,
  entidade,
  entidadeId,
  estadoAnterior,
  estadoNovo,
  justificativa,
}: {
  adminId: string;
  acao: string;
  entidade: string;
  entidadeId: string;
  estadoAnterior?: any;
  estadoNovo?: any;
  justificativa?: string | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  
  const { error } = await supabaseAdmin.from("admin_audit_logs").insert({
    admin_auth_id: adminId,
    acao,
    entidade,
    entidade_id: entidadeId,
    estado_anterior: estadoAnterior,
    estado_novo: estadoNovo,
    justificativa: justificativa ?? null,
  });

  if (error) {
    console.error(`[AuditLog] Erro ao gravar auditoria para ${entidade}:${entidadeId}:`, error);
    throw new Error(`Falha crítica: Ação realizada mas o registro de auditoria falhou. (${error.message})`);
  }
}
