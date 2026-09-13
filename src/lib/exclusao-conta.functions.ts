import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const excluirContaUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const authUserId = context.userId;

    if (!authUserId) {
      throw new Error("Não encontramos seu cadastro autenticado. Saia e entre novamente.");
    }

    const { data: usuario, error: fetchError } = await supabaseAdmin
      .from("usuarios")
      .select("id, foto_perfil_path")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (fetchError || !usuario) {
      throw new Error("Não encontramos seu cadastro. Saia e entre novamente.");
    }

    const { data: documentos, error: rpcError } = await supabaseAdmin.rpc("excluir_conta_usuario", {
      p_usuario_id: usuario.id,
    });

    if (rpcError) {
      throw new Error(rpcError.message || "Não foi possível excluir a conta. Tente novamente.");
    }

    // Melhor esforço: o Storage não faz parte da transação da RPC, e um
    // arquivo órfão não é motivo pra reportar falha na exclusão, que do
    // lado do banco (o que importa pra LGPD) já foi concluída. Mas o
    // `.remove()` do Storage RESOLVE com `{ error }` num 4xx/5xx normal —
    // não lança — então cada resultado precisa ser conferido explicitamente
    // pra essa falha não ficar invisível (documentos sensíveis órfãos, sem
    // nenhum registro pra limpar depois).
    try {
      const storagePaths = (documentos ?? [])
        .map((linha) => linha.documento_storage_path)
        .filter((path): path is string => !!path);

      if (storagePaths.length > 0) {
        const { error } = await supabaseAdmin.storage
          .from("documentos-motorista")
          .remove(storagePaths);
        if (error) {
          console.error(
            "[excluirContaUsuario] Falha ao remover documentos do Storage:",
            storagePaths,
            error,
          );
        }
      }

      if (usuario.foto_perfil_path) {
        const { error } = await supabaseAdmin.storage
          .from("fotos-perfil")
          .remove([usuario.foto_perfil_path]);
        if (error) {
          console.error(
            "[excluirContaUsuario] Falha ao remover foto de perfil do Storage:",
            usuario.foto_perfil_path,
            error,
          );
        }
      }
    } catch (storageError) {
      console.error("[excluirContaUsuario] Falha ao limpar arquivos do Storage:", storageError);
    }

    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
    if (deleteAuthError) {
      console.error("[excluirContaUsuario] Falha ao remover usuário do Auth:", deleteAuthError);
      throw new Error(
        "Seus dados foram apagados, mas houve um problema ao encerrar o login. Contate o suporte.",
      );
    }

    return { success: true };
  });
