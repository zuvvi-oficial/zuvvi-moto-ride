import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { validarCpfBrasileiro } from "./pix-cpf";

const signUpSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  nome: z.string().min(3, "Nome muito curto"),
  cpf: z.string().length(11, "CPF deve ter 11 dígitos").refine(validarCpfBrasileiro, "CPF inválido"),
  celular: z.string().min(10, "Telefone inválido"),
  data_nascimento: z.string().optional(),
  codigoIndicacao: z.string().trim().min(1).max(20).optional(),
});

// Sem caracteres ambíguos (0/O, 1/I) — código é digitado/compartilhado por
// gente de verdade.
const ALFABETO_CODIGO_INDICACAO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TAMANHO_CODIGO_INDICACAO = 6;
const TENTATIVAS_CODIGO_INDICACAO = 6;

// Programa de indicação — Etapa 1. Recompensa de boas-vindas pro indicado
// (quem acabou de se cadastrar com o código de um amigo). A recompensa do
// indicador só é concedida quando a corrida do indicado de fato se
// completa (Etapa 2) — evita incentivar cadastro falso sem nenhuma corrida
// real.
const BOAS_VINDAS_INDICACAO_VALOR = 10;
const BOAS_VINDAS_INDICACAO_VALIDADE_DIAS = 30;

function gerarCodigoIndicacao(crypto: typeof import("crypto")): string {
  let codigo = "";
  for (let i = 0; i < TAMANHO_CODIGO_INDICACAO; i += 1) {
    codigo += ALFABETO_CODIGO_INDICACAO[crypto.randomInt(0, ALFABETO_CODIGO_INDICACAO.length)];
  }
  return codigo;
}

export async function atribuirCodigoIndicacao(
  supabaseAdmin: any,
  crypto: typeof import("crypto"),
  usuarioId: string,
): Promise<string | null> {
  for (let tentativa = 0; tentativa < TENTATIVAS_CODIGO_INDICACAO; tentativa += 1) {
    const codigo = gerarCodigoIndicacao(crypto);
    const { error } = await supabaseAdmin
      .from("usuarios")
      .update({ codigo_indicacao: codigo } as any)
      .eq("id", usuarioId);
    if (!error) return codigo;
    if ((error as { code?: string }).code !== "23505") return null;
  }
  return null;
}

// Best-effort e isolado: um código de indicação inválido/já usado nunca
// deve bloquear o cadastro em si, só deixar de registrar a indicação.
async function processarCodigoIndicacaoUsado(
  supabaseAdmin: any,
  novoUsuarioId: string,
  codigoInformado: string,
): Promise<void> {
  try {
    const codigo = codigoInformado.trim().toUpperCase();
    const { data: indicador } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("codigo_indicacao", codigo)
      .maybeSingle();

    if (!indicador || indicador.id === novoUsuarioId) return;

    const { criarCupomAutomatico } = await import("./cupons.functions");
    const crypto = await import("crypto");
    const codigoCupom = `BEMVINDO-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const validoAte = new Date(
      Date.now() + BOAS_VINDAS_INDICACAO_VALIDADE_DIAS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const cupom = await criarCupomAutomatico(supabaseAdmin, {
      codigo: codigoCupom,
      tipoDesconto: "fixo",
      valor: BOAS_VINDAS_INDICACAO_VALOR,
      descricao: "Boas-vindas — programa de indicação",
      validoAte,
      usuarioRestritoId: novoUsuarioId,
    });

    const { data: indicacao, error: indicacaoError } = await supabaseAdmin
      .from("indicacoes")
      .insert({
        indicador_id: indicador.id,
        indicado_id: novoUsuarioId,
        codigo_usado: codigo,
        cupom_indicado_id: cupom.id,
      } as any)
      .select("id")
      .maybeSingle();

    if (indicacaoError || !indicacao) {
      console.error("[Indicacao] Falha ao registrar indicação no cadastro.", indicacaoError);
      return;
    }

    const { criarNotificacao } = await import("./notificacoes.server");
    await criarNotificacao(supabaseAdmin, {
      usuario_id: novoUsuarioId,
      tipo: "cupom_indicacao_recebido",
      titulo: "🎁 Ganhou um cupom de boas-vindas!",
      mensagem: `Use o cupom ${codigoCupom} e ganhe R$ ${BOAS_VINDAS_INDICACAO_VALOR.toFixed(2)} de desconto na sua primeira corrida.`,
    }).catch(() => {});
  } catch (err) {
    console.error("[Indicacao] Falha inesperada ao processar código de indicação.", err);
  }
}

export const signUp = createServerFn({ method: "POST" })
  .inputValidator((data) => signUpSchema.parse(data))
  .handler(async ({ data }) => {
    // Import inside handler to avoid client bundle issues
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Bloqueio de segurança: não permitir criar mokahz@gmail.com manualmente se ele já for o admin autorizado
    // O admin deve vir apenas via Google Auth ou bootstrap seguro.
    
    // 1. Criar usuário no Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true, // Auto-confirmar para facilidade técnica inicial
      user_metadata: {
        nome: data.nome,
      }
    });

    if (authError) {
      throw new Error(authError.message);
    }

    if (!authData.user) {
      throw new Error("Erro ao criar usuário");
    }

    // 2. Criar registro na tabela public.usuarios
    // Perfil será escolhido na tela seguinte
    const { data: novoUsuario, error: dbError } = await supabaseAdmin
      .from("usuarios")
      .insert({
        auth_user_id: authData.user.id,
        nome: data.nome,
        email: data.email,
        cpf: data.cpf,
        celular: data.celular,
        data_nascimento: data.data_nascimento ?? null,
        is_passageiro: false,
        is_motorista: false,
      })
      .select("id")
      .single();

    if (dbError || !novoUsuario) {
      // Cleanup: se falhar no DB, remover do Auth
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error(dbError?.message ?? "Erro ao criar usuário.");
    }

    // Best-effort, nunca bloqueia o cadastro: gera o código de indicação do
    // próprio usuário e, se ele veio com o código de um amigo, registra a
    // indicação e concede o cupom de boas-vindas.
    const crypto = await import("crypto");
    await atribuirCodigoIndicacao(supabaseAdmin, crypto, novoUsuario.id);
    if (data.codigoIndicacao) {
      await processarCodigoIndicacaoUsado(supabaseAdmin, novoUsuario.id, data.codigoIndicacao);
    }

    return { success: true, userId: authData.user.id };
  });
