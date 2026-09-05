import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Janela generosa: cobre corridas longas/atrasadas sem precisar regenerar o
// link no meio do trajeto. O passageiro sempre pode encerrar antes (excluirCompartilhamento).
const DURACAO_COMPARTILHAMENTO_MS = 4 * 60 * 60 * 1000;

const ESTADOS_COMPARTILHAVEIS = [
  "aceita",
  "motorista_a_caminho",
  "motorista_chegou",
  "em_andamento",
] as const;

const compartilharSchema = z.object({ rideId: z.string().uuid() });

export const compartilharCorrida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => compartilharSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: usuario, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    if (userError || !usuario) throw new Error("Usuário não encontrado.");

    const { data: corrida, error: corridaError } = await supabaseAdmin
      .from("corridas")
      .select("id, passageiro_id, status")
      .eq("id", data.rideId)
      .maybeSingle();

    if (
      corridaError ||
      !corrida ||
      corrida.passageiro_id !== usuario.id ||
      !ESTADOS_COMPARTILHAVEIS.includes(corrida.status as (typeof ESTADOS_COMPARTILHAVEIS)[number])
    ) {
      throw new Error("Esta corrida não pode ser compartilhada agora.");
    }

    const { data: existente } = await supabaseAdmin
      .from("viagens_compartilhadas")
      .select("link_publico, expira_em")
      .eq("corrida_id", corrida.id)
      .gt("expira_em", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existente) {
      return { linkPublico: existente.link_publico, expiraEm: existente.expira_em };
    }

    const expiraEm = new Date(Date.now() + DURACAO_COMPARTILHAMENTO_MS).toISOString();
    const { data: nova, error } = await supabaseAdmin
      .from("viagens_compartilhadas")
      .insert({ corrida_id: corrida.id, expira_em: expiraEm })
      .select("link_publico, expira_em")
      .single();

    if (error || !nova) throw new Error("Não foi possível gerar o link de compartilhamento.");
    return { linkPublico: nova.link_publico, expiraEm: nova.expira_em };
  });

export const encerrarCompartilhamentoCorrida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => compartilharSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: usuario, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    if (userError || !usuario) throw new Error("Usuário não encontrado.");

    const { data: corrida } = await supabaseAdmin
      .from("corridas")
      .select("id")
      .eq("id", data.rideId)
      .eq("passageiro_id", usuario.id)
      .maybeSingle();

    if (!corrida) throw new Error("Corrida não encontrada.");

    await supabaseAdmin.from("viagens_compartilhadas").delete().eq("corrida_id", corrida.id);
    return { success: true };
  });

const publicoSchema = z.object({ linkPublico: z.string().trim().min(1).max(200) });

// Sem requireSupabaseAuth de propósito: é a tela que um contato de
// confiança (sem conta na Zuvvi) abre a partir do link compartilhado por
// WhatsApp. A segurança vem do token em si (32 hex aleatórios,
// imprevisível), validado inteiramente dentro da RPC — nunca lista, só
// busca pelo valor exato, e retorna somente o mínimo necessário.
async function buscarViagemCompartilhadaPublica(linkPublico: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // A RPC ainda não está nos tipos gerados do projeto.
  const { data: resultado, error } = await (supabaseAdmin as any).rpc(
    "get_viagem_compartilhada_publica",
    { p_link_publico: linkPublico },
  );

  if (error) throw new Error("Não foi possível carregar esta viagem.");

  const linha = Array.isArray(resultado) ? resultado[0] : null;
  if (!linha) throw new Error("Este link expirou ou não existe mais.");
  return linha;
}

export const getViagemCompartilhadaPublica = createServerFn({ method: "GET" })
  .validator((data: unknown) => publicoSchema.parse(data))
  .handler(async ({ data }) => {
    const linha = await buscarViagemCompartilhadaPublica(data.linkPublico);

    return {
      status: linha.status as string,
      origemNome: linha.origem_nome as string | null,
      destinoNome: linha.destino_nome as string | null,
      motoristaNome: linha.motorista_nome as string | null,
      veiculoPlaca: linha.veiculo_placa as string | null,
      veiculoModelo: linha.veiculo_modelo as string | null,
      motoristaLat: linha.motorista_lat as number | null,
      motoristaLng: linha.motorista_lng as number | null,
      expiraEm: linha.expira_em as string,
    };
  });

// Exceção controlada à regra geral de getMapboxToken exigir sessão: aqui a
// credencial é o próprio link secreto (validado pela mesma RPC acima, nunca
// listável), não uma sessão Zuvvi — mesmo nível de confiança de quem já
// consegue ver a posição do motorista por este link.
export const getMapboxTokenParaViagemCompartilhada = createServerFn({ method: "GET" })
  .validator((data: unknown) => publicoSchema.parse(data))
  .handler(async ({ data }) => {
    await buscarViagemCompartilhadaPublica(data.linkPublico);
    return process.env["MAPBOX_TOKEN"] || null;
  });
