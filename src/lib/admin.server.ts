import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Middleware para exigir que o usuário seja um administrador ativo.
 * Implementa bootstrap automático idempotente para a conta mokahz@gmail.com.
 */
export const requireAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // 1. Obter e-mail e status da conta no Auth (Server-side trust)
    const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (authError || !user) {
      throw new Error("Sessão inválida ou usuário não encontrado.");
    }

    const email = user.email;
    const isEmailConfirmed = !!user.email_confirmed_at;

    // 2. Bootstrap Idempotente para o Administrador Principal
    if (email === 'mokahz@gmail.com' && isEmailConfirmed) {
      // Tenta inserir ou garantir que esteja ativo
      const { error: upsertError } = await supabaseAdmin
        .from("admin_users")
        .upsert(
          { 
            auth_user_id: userId, 
            role: 'admin', 
            ativo: true 
          }, 
          { onConflict: 'auth_user_id' }
        );
      
      if (upsertError) {
        console.error("[AdminBootstrap] Falha ao garantir admin_users:", upsertError);
      }
    }

    // 3. Verificar se o usuário está na tabela admin_users e está ativo
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
