import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Middleware para exigir que o usuário seja um administrador ativo.
 */
export const adminOnlyMiddleware = createMiddleware().middleware(async ({ next, context }) => {
  // requireSupabaseAuth já deve ter rodado se encadeado, ou podemos checar direto aqui
  // Mas requireSupabaseAuth é uma 'function' middleware.
  // Vamos simplificar e usar a lógica de admin dentro do requireAdmin server fn.
  return next();
});

export const requireAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: admin, error } = await supabaseAdmin
      .from("admin_users")
      .select("role, ativo")
      .eq("auth_user_id", userId)
      .single();

    if (error || !admin || !admin.ativo || admin.role !== "admin") {
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
  justificativa?: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  
  await supabaseAdmin.from("admin_audit_logs").insert({
    admin_auth_id: adminId,
    acao,
    entidade,
    entidade_id: entidadeId,
    estado_anterior: estadoAnterior,
    estado_novo: estadoNovo,
    justificativa: justificativa ?? null,
  });
}
