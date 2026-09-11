import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Gamificação do motorista — diferencial puramente de leitura: deriva nível
 * e conquistas a partir de dados que já existem (corridas concluídas, nota
 * média). Nenhuma tabela nova, nenhum estado gravado — só agregação sob
 * demanda.
 *
 * A conquista de gorjetas ("Querido dos passageiros") foi removida daqui:
 * hoje nenhuma gorjeta chega a 'paga' (só a Etapa 1 existe, sem motor de
 * cobrança), então seria uma conquista que ninguém jamais desbloqueia.
 * Volta a fazer sentido quando a Etapa 2/3 de gorjeta digital existir
 * (achado do Codex no PR #75).
 */

export type NivelMotorista = "bronze" | "prata" | "ouro" | "platina";

const NIVEIS: ReadonlyArray<{ nivel: NivelMotorista; minimo: number }> = [
  { nivel: "platina", minimo: 500 },
  { nivel: "ouro", minimo: 200 },
  { nivel: "prata", minimo: 50 },
  { nivel: "bronze", minimo: 0 },
];

function calcularNivel(corridasConcluidas: number): {
  nivel: NivelMotorista;
  proximoNivel: NivelMotorista | null;
  corridasParaProximoNivel: number | null;
} {
  const atual = NIVEIS.find((n) => corridasConcluidas >= n.minimo)!;
  const indiceAtual = NIVEIS.indexOf(atual);
  const proximo = indiceAtual > 0 ? NIVEIS[indiceAtual - 1] : null;

  return {
    nivel: atual.nivel,
    proximoNivel: proximo?.nivel ?? null,
    corridasParaProximoNivel: proximo ? proximo.minimo - corridasConcluidas : null,
  };
}

// Nota alta só vira conquista com uma amostra mínima de avaliações reais —
// nem toda corrida concluída é avaliada, então o tamanho da amostra tem que
// contar avaliacoes de fato recebidas, não corridas concluídas (achado do
// Codex no PR #75: motorista_media já é a média dessas mesmas linhas).
const AMOSTRA_MINIMA_NOTA = 20;
const NOTA_MINIMA_EXCELENCIA = 4.8;

export type Conquista = Readonly<{
  id: string;
  titulo: string;
  descricao: string;
  conquistada: boolean;
}>;

export const getGamificacaoMotorista = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: usuario, error: usuarioError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    if (usuarioError || !usuario) throw new Error("Usuário não encontrado.");

    const motoristaId = usuario.id;

    const [motoristaResult, corridasResult, avaliacoesResult] = await Promise.all([
      supabaseAdmin.from("motoristas").select("nota_media").eq("id", motoristaId).maybeSingle(),
      supabaseAdmin
        .from("corridas")
        .select("id", { count: "exact", head: true })
        .eq("motorista_id", motoristaId)
        .eq("status", "concluida"),
      supabaseAdmin
        .from("avaliacoes")
        .select("id", { count: "exact", head: true })
        .eq("avaliado_id", motoristaId),
    ]);

    if (motoristaResult.error || corridasResult.error || avaliacoesResult.error) {
      console.error("Erro ao carregar dados de gamificação:", {
        motorista: motoristaResult.error,
        corridas: corridasResult.error,
        avaliacoes: avaliacoesResult.error,
      });
      throw new Error("Não foi possível carregar seu progresso.");
    }

    const totalCorridas = corridasResult.count ?? 0;
    const totalAvaliacoesRecebidas = avaliacoesResult.count ?? 0;
    const notaMedia = motoristaResult.data?.nota_media != null ? Number(motoristaResult.data.nota_media) : null;

    const { nivel, proximoNivel, corridasParaProximoNivel } = calcularNivel(totalCorridas);

    const conquistas: Conquista[] = [
      {
        id: "novato",
        titulo: "Primeira corrida",
        descricao: "Concluiu sua primeira corrida na Zuvvi.",
        conquistada: totalCorridas >= 1,
      },
      {
        id: "100_corridas",
        titulo: "Estrada conhecida",
        descricao: "Concluiu 100 corridas.",
        conquistada: totalCorridas >= 100,
      },
      {
        id: "500_corridas",
        titulo: "Veterano Zuvvi",
        descricao: "Concluiu 500 corridas.",
        conquistada: totalCorridas >= 500,
      },
      {
        id: "nota_excelencia",
        titulo: "Excelência",
        descricao: `Nota média acima de ${NOTA_MINIMA_EXCELENCIA.toFixed(1)} (mínimo ${AMOSTRA_MINIMA_NOTA} avaliações recebidas).`,
        conquistada: totalAvaliacoesRecebidas >= AMOSTRA_MINIMA_NOTA && (notaMedia ?? 0) > NOTA_MINIMA_EXCELENCIA,
      },
    ];

    return {
      nivel,
      proximoNivel,
      corridasParaProximoNivel,
      totalCorridas,
      notaMedia,
      conquistas,
    };
  });
