import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LIMITE_CONTATOS = 5;
const TELEFONE_PATTERN = /^\d{10,11}$/u;

function normalizarTelefone(valor: string): string {
  const digitos = valor.replace(/\D/gu, "");
  if (!TELEFONE_PATTERN.test(digitos)) {
    throw new Error("Telefone inválido. Use DDD + número (ex: 11999998888).");
  }
  return digitos;
}

const contatoSchema = z.object({
  nome: z.string().trim().min(1).max(60),
  telefone: z.string().trim().min(1).max(20),
});

export const listarContatosConfianca = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: usuario, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    if (userError || !usuario) throw new Error("Usuário não encontrado.");

    const { data, error } = await supabaseAdmin
      .from("contatos_confianca")
      .select("id, nome, telefone")
      .eq("passageiro_id", usuario.id)
      .order("nome", { ascending: true });

    if (error) throw error;
    return data || [];
  });

export const criarContatoConfianca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => contatoSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: usuario, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    if (userError || !usuario) throw new Error("Usuário não encontrado.");

    const telefoneNormalizado = normalizarTelefone(data.telefone);

    const { count, error: countError } = await supabaseAdmin
      .from("contatos_confianca")
      .select("id", { count: "exact", head: true })
      .eq("passageiro_id", usuario.id);

    if (countError) throw countError;
    if (count !== null && count >= LIMITE_CONTATOS) {
      throw new Error(
        `Você atingiu o limite de ${LIMITE_CONTATOS} contatos de confiança. Exclua um para adicionar outro.`,
      );
    }

    const { error } = await supabaseAdmin.from("contatos_confianca").insert({
      passageiro_id: usuario.id,
      nome: data.nome,
      telefone: telefoneNormalizado,
    });

    if (error) throw new Error("Não foi possível salvar o contato.");
    return { success: true };
  });

export const excluirContatoConfianca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: usuario, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    if (userError || !usuario) throw new Error("Usuário não encontrado.");

    const { error } = await supabaseAdmin
      .from("contatos_confianca")
      .delete()
      .eq("id", data.id)
      .eq("passageiro_id", usuario.id);

    if (error) throw new Error("Não foi possível excluir o contato.");
    return { success: true };
  });
