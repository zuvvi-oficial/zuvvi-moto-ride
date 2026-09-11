import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Motoristas favoritos — Etapa 1 do recurso "motorista fixo/preferido".
 * Só a camada de dados (listar/adicionar/remover). Nenhuma mudança na
 * criação ou no matching de corridas ainda — isso é a Etapa 3.
 */
const LIMITE_FAVORITOS = 5;

const motoristaIdSchema = z.object({
  motoristaId: z.string().uuid("Motorista inválido."),
});

async function resolverUsuarioId(supabaseAdmin: any, authUserId: string) {
  const { data: usuario, error } = await supabaseAdmin
    .from("usuarios")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error || !usuario) throw new Error("Usuário não encontrado.");
  return usuario.id as string;
}

export const listarMotoristasFavoritos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const passageiroId = await resolverUsuarioId(supabaseAdmin, context.userId);

    const { data, error } = await supabaseAdmin
      .from("motoristas_favoritos")
      .select("motorista_id, created_at, motoristas!inner(usuarios!inner(nome))")
      .eq("passageiro_id", passageiroId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao listar motoristas favoritos:", error);
      throw new Error("Não foi possível carregar seus motoristas favoritos.");
    }

    return (data || []).map((linha: any) => ({
      motoristaId: linha.motorista_id as string,
      nome: (linha.motoristas?.usuarios?.nome as string | null) ?? "Motorista",
      favoritadoEm: linha.created_at as string,
    }));
  });

// Só pode favoritar quem já foi de fato seu motorista — evita que um
// passageiro marque como favorito alguém que nunca o levou.
async function passageiroTemCorridaConcluidaCom(
  supabaseAdmin: any,
  passageiroId: string,
  motoristaId: string,
) {
  const { count, error } = await supabaseAdmin
    .from("corridas")
    .select("id", { count: "exact", head: true })
    .eq("passageiro_id", passageiroId)
    .eq("motorista_id", motoristaId)
    .eq("status", "concluida");

  if (error) {
    console.error("Erro ao checar histórico de corridas com o motorista:", error);
    throw new Error("Não foi possível confirmar seu histórico com este motorista.");
  }

  return (count ?? 0) > 0;
}

export const adicionarMotoristaFavorito = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => motoristaIdSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const passageiroId = await resolverUsuarioId(supabaseAdmin, context.userId);

    const jaAndouComEle = await passageiroTemCorridaConcluidaCom(supabaseAdmin, passageiroId, data.motoristaId);
    if (!jaAndouComEle) {
      throw new Error("Você só pode favoritar um motorista com quem já concluiu uma corrida.");
    }

    // Checagem rápida só para dar feedback sem round-trip de erro no caso
    // comum; a garantia real contra corrida concorrente (duas inserções ao
    // mesmo tempo) é o trigger enforce_motoristas_favoritos_limit_trigger
    // no banco (código 23514 abaixo) — mesmo padrão de contatos_confianca.
    const { count, error: countError } = await supabaseAdmin
      .from("motoristas_favoritos")
      .select("id", { count: "exact", head: true })
      .eq("passageiro_id", passageiroId);

    if (countError) throw countError;
    if (count !== null && count >= LIMITE_FAVORITOS) {
      throw new Error(
        `Você atingiu o limite de ${LIMITE_FAVORITOS} motoristas favoritos. Remova um para adicionar outro.`,
      );
    }

    const { error } = await supabaseAdmin.from("motoristas_favoritos").insert({
      passageiro_id: passageiroId,
      motorista_id: data.motoristaId,
    });

    if (error) {
      const code = (error as { code?: string }).code;
      if (code === "23514") {
        throw new Error(
          `Você atingiu o limite de ${LIMITE_FAVORITOS} motoristas favoritos. Remova um para adicionar outro.`,
        );
      }
      if (code === "23505") {
        throw new Error("Este motorista já está nos seus favoritos.");
      }
      console.error("Erro ao adicionar motorista favorito:", error);
      throw new Error("Não foi possível favoritar este motorista.");
    }

    return { success: true as const };
  });

export const removerMotoristaFavorito = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => motoristaIdSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const passageiroId = await resolverUsuarioId(supabaseAdmin, context.userId);

    const { error } = await supabaseAdmin
      .from("motoristas_favoritos")
      .delete()
      .eq("passageiro_id", passageiroId)
      .eq("motorista_id", data.motoristaId);

    if (error) {
      console.error("Erro ao remover motorista favorito:", error);
      throw new Error("Não foi possível remover este favorito.");
    }

    return { success: true as const };
  });

// Etapa 4 (opcional) do motorista favorito: o motorista vê quantos
// passageiros o têm como favorito — só um número, sem expor quem são.
export const contarFavoritadoPor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: usuario, error: usuarioError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    if (usuarioError || !usuario) throw new Error("Usuário não encontrado.");

    const { count, error } = await supabaseAdmin
      .from("motoristas_favoritos")
      .select("id", { count: "exact", head: true })
      .eq("motorista_id", usuario.id);

    if (error) {
      console.error("Erro ao contar quantos passageiros favoritaram o motorista:", error);
      throw new Error("Não foi possível carregar seus favoritos.");
    }

    return { total: count ?? 0 };
  });
