import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { obterUrlAssinadaFotoPerfil } from "@/lib/passenger-profile-photo.functions";

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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const linha = await buscarViagemCompartilhadaPublica(data.linkPublico);

    return {
      status: linha.status as string,
      origemNome: linha.origem_nome as string | null,
      destinoNome: linha.destino_nome as string | null,
      origemLat: linha.origem_lat as number | null,
      origemLng: linha.origem_lng as number | null,
      destinoLat: linha.destino_lat as number | null,
      destinoLng: linha.destino_lng as number | null,
      motoristaNome: linha.motorista_nome as string | null,
      veiculoPlaca: linha.veiculo_placa as string | null,
      veiculoModelo: linha.veiculo_modelo as string | null,
      motoristaLat: linha.motorista_lat as number | null,
      motoristaLng: linha.motorista_lng as number | null,
      motoristaUltimaLocalizacaoAt: linha.motorista_ultima_localizacao_at as string | null,
      expiraEm: linha.expira_em as string,
      motoristaNota: linha.motorista_nota as number | null,
      veiculoCor: linha.veiculo_cor as string | null,
      motoristaFotoPerfilUrl: linha.motorista_foto_perfil_path
        ? await obterUrlAssinadaFotoPerfil(
            supabaseAdmin,
            linha.motorista_foto_perfil_path as string,
          )
        : null,
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

// Etapa 3 (segurança ativa): botão de SOS na tela pública. Sem
// requireSupabaseAuth pelo mesmo motivo das duas funções acima — quem aciona
// é o contato de confiança, sem conta na Zuvvi. O chamado é registrado em
// nome do próprio passageiro da corrida (dono legítimo do chamado, já que é
// a viagem dele) usando o tipo "sos" que o módulo de Suporte já suporta —
// nenhuma tabela nova, nenhuma alteração no fluxo/telas de suporte
// existentes, só uma nova forma de criar o mesmo tipo de chamado que já
// existe.
export const criarSosViagemCompartilhada = createServerFn({ method: "POST" })
  .validator((data: unknown) => publicoSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Mesma validação de token/expiração da leitura pública (link_publico
    // exato, nunca listado), feita direto contra a tabela porque aqui
    // também precisamos do corrida_id, que a RPC de leitura não devolve.
    const { data: viagem, error: viagemError } = await supabaseAdmin
      .from("viagens_compartilhadas")
      .select("corrida_id")
      .eq("link_publico", data.linkPublico)
      .gt("expira_em", new Date().toISOString())
      .maybeSingle();

    if (viagemError || !viagem) throw new Error("Este link expirou ou não existe mais.");

    const { data: corrida, error: corridaError } = await supabaseAdmin
      .from("corridas")
      .select("id, passageiro_id")
      .eq("id", viagem.corrida_id)
      .maybeSingle();

    if (corridaError || !corrida) throw new Error("Corrida não encontrada.");

    // Evita duplicar se o contato tocar mais de uma vez: reaproveita um SOS
    // já aberto/em atendimento recente para esta mesma corrida.
    const { data: existente } = await supabaseAdmin
      .from("chamados_suporte")
      .select("id, status")
      .eq("corrida_id", corrida.id)
      .eq("tipo", "sos")
      .in("status", ["aberto", "em_atendimento"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existente) {
      return { id: existente.id, status: existente.status as string, jaExistia: true as const };
    }

    const { data: chamado, error: chamadoError } = await supabaseAdmin
      .from("chamados_suporte")
      .insert({
        usuario_id: corrida.passageiro_id,
        corrida_id: corrida.id,
        tipo: "sos",
        descricao:
          "Acionado por um contato de confiança pela tela pública de acompanhamento (link de viagem compartilhada).",
      })
      .select("id, status")
      .single();

    if (chamadoError || !chamado) {
      throw new Error("Não foi possível registrar o alerta. Tente novamente.");
    }

    return { id: chamado.id, status: chamado.status as string, jaExistia: false as const };
  });
