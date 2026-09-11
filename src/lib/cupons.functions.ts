import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createAuditLog } from "./admin.server";

/**
 * Cupons de desconto — Etapa 1 do diferencial pedido pelo usuário. Só a
 * camada de dados: CRUD de admin + validação de elegibilidade pro
 * passageiro. Aplicar o desconto de verdade no preço (cotarCorridaCore/
 * criarCorridaCore) é a Etapa 2 — ainda não existe, então validarCupom só
 * calcula uma prévia do desconto, sem gravar nenhum uso.
 */

async function checkAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: admin, error } = await supabaseAdmin
    .from("admin_users")
    .select("role, ativo")
    .eq("auth_user_id", userId)
    .single();

  if (error || !admin || !admin.ativo || admin.role !== "admin") {
    throw new Error("Acesso negado: Administrador não autorizado.");
  }
}

function normalizarCodigo(codigo: string): string {
  return codigo.trim().toUpperCase();
}

const codigoSchema = z
  .string()
  .trim()
  .min(3, "O código precisa ter pelo menos 3 caracteres.")
  .max(40, "O código pode ter no máximo 40 caracteres.")
  .regex(/^[A-Za-z0-9_-]+$/u, "Use apenas letras, números, hífen ou underline.");

const criarCupomSchema = z
  .object({
    codigo: codigoSchema,
    tipoDesconto: z.enum(["percentual", "fixo"]),
    valor: z.number().positive(),
    valorMaximoDesconto: z.number().positive().optional(),
    valorMinimoCorrida: z.number().min(0).optional(),
    limiteUsoTotal: z.number().int().positive().optional(),
    limiteUsoPorUsuario: z.number().int().positive().default(1),
    cidadeId: z.string().uuid().optional(),
    descricao: z.string().max(200).optional(),
    validoDe: z.string().datetime().optional(),
    validoAte: z.string().datetime().optional(),
  })
  .refine((v) => v.tipoDesconto !== "percentual" || v.valor <= 100, {
    message: "Desconto percentual não pode passar de 100%.",
    path: ["valor"],
  })
  .refine((v) => !v.validoDe || !v.validoAte || v.validoAte > v.validoDe, {
    message: "A validade final precisa ser depois do início.",
    path: ["validoAte"],
  });

export const criarCupomAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => criarCupomSchema.parse(data))
  .handler(async ({ context, data }) => {
    await checkAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const codigo = normalizarCodigo(data.codigo);

    const { data: cupom, error } = await supabaseAdmin
      .from("cupons")
      .insert({
        codigo,
        tipo_desconto: data.tipoDesconto,
        valor: data.valor,
        valor_maximo_desconto: data.valorMaximoDesconto ?? null,
        valor_minimo_corrida: data.valorMinimoCorrida ?? null,
        limite_uso_total: data.limiteUsoTotal ?? null,
        limite_uso_por_usuario: data.limiteUsoPorUsuario,
        cidade_id: data.cidadeId ?? null,
        descricao: data.descricao ?? null,
        ...(data.validoDe ? { valido_de: data.validoDe } : {}),
        valido_ate: data.validoAte ?? null,
      })
      .select("id")
      .single();

    if (error) {
      const code = (error as { code?: string }).code;
      if (code === "23505") throw new Error("Já existe um cupom com este código.");
      console.error("Erro ao criar cupom:", error);
      throw new Error("Não foi possível criar o cupom.");
    }

    await createAuditLog({
      adminId: context.userId,
      acao: "criar_cupom",
      entidade: "cupons",
      entidadeId: cupom.id,
      estadoNovo: { ...data, codigo },
    });

    return { success: true as const, id: cupom.id as string };
  });

export const listarCuponsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await checkAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cupons, error } = await supabaseAdmin
      .from("cupons")
      .select(
        "id, codigo, tipo_desconto, valor, valor_maximo_desconto, valor_minimo_corrida, limite_uso_total, limite_uso_por_usuario, cidade_id, descricao, ativo, valido_de, valido_ate, created_at, cupom_usos(count)",
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao listar cupons:", error);
      throw new Error("Não foi possível carregar os cupons.");
    }

    return (cupons || []).map((c: any) => ({
      id: c.id as string,
      codigo: c.codigo as string,
      tipoDesconto: c.tipo_desconto as "percentual" | "fixo",
      valor: Number(c.valor),
      valorMaximoDesconto: c.valor_maximo_desconto != null ? Number(c.valor_maximo_desconto) : null,
      valorMinimoCorrida: c.valor_minimo_corrida != null ? Number(c.valor_minimo_corrida) : null,
      limiteUsoTotal: c.limite_uso_total as number | null,
      limiteUsoPorUsuario: c.limite_uso_por_usuario as number,
      cidadeId: c.cidade_id as string | null,
      descricao: c.descricao as string | null,
      ativo: c.ativo as boolean,
      validoDe: c.valido_de as string,
      validoAte: c.valido_ate as string | null,
      createdAt: c.created_at as string,
      totalUsos: (c.cupom_usos?.[0]?.count as number | undefined) ?? 0,
    }));
  });

export const atualizarStatusCupomAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ cupomId: z.string().uuid(), ativo: z.boolean() }).parse(data))
  .handler(async ({ context, data }) => {
    await checkAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: atual, error: atualError } = await supabaseAdmin
      .from("cupons")
      .select("ativo")
      .eq("id", data.cupomId)
      .maybeSingle();
    if (atualError || !atual) throw new Error("Cupom não encontrado.");

    const { error } = await supabaseAdmin
      .from("cupons")
      .update({ ativo: data.ativo, updated_at: new Date().toISOString() } as any)
      .eq("id", data.cupomId);

    if (error) {
      console.error("Erro ao atualizar cupom:", error);
      throw new Error("Não foi possível atualizar o cupom.");
    }

    await createAuditLog({
      adminId: context.userId,
      acao: data.ativo ? "ativar_cupom" : "desativar_cupom",
      entidade: "cupons",
      entidadeId: data.cupomId,
      estadoAnterior: { ativo: atual.ativo },
      estadoNovo: { ativo: data.ativo },
    });

    return { success: true as const };
  });

type CupomElegibilidade = Readonly<{
  id: string;
  codigo: string;
  tipo_desconto: "percentual" | "fixo";
  valor: number;
  valor_maximo_desconto: number | null;
  valor_minimo_corrida: number | null;
  limite_uso_total: number | null;
  limite_uso_por_usuario: number;
  cidade_id: string | null;
  ativo: boolean;
  valido_de: string;
  valido_ate: string | null;
}>;

function calcularValorDesconto(cupom: CupomElegibilidade, valorCorrida: number): number {
  const base = cupom.tipo_desconto === "percentual" ? valorCorrida * (cupom.valor / 100) : cupom.valor;
  const comTeto = cupom.valor_maximo_desconto != null ? Math.min(base, cupom.valor_maximo_desconto) : base;
  const semUltrapassarCorrida = Math.min(comTeto, valorCorrida);
  return Math.round(semUltrapassarCorrida * 100) / 100;
}

export type AvaliacaoCupom = Readonly<{
  cupomId: string;
  codigo: string;
  valorDesconto: number;
}>;

// Núcleo de elegibilidade de cupom, sem o server function em volta —
// reaproveitado por validarCupom (Etapa 1, só prévia) e por
// criarCorridaCore (Etapa 2, aplicação de verdade). Nunca confia num
// desconto calculado antes: revalida tudo contra o valor real da corrida
// no momento em que é chamado.
export async function avaliarCupomParaCorrida(
  supabaseAdmin: any,
  params: { codigo: string; usuarioId: string; cidadeId: string | null; valorCorrida: number },
): Promise<AvaliacaoCupom> {
  const codigo = normalizarCodigo(params.codigo);

  const { data: cupom, error: cupomError } = await supabaseAdmin
    .from("cupons")
    .select(
      "id, codigo, tipo_desconto, valor, valor_maximo_desconto, valor_minimo_corrida, limite_uso_total, limite_uso_por_usuario, cidade_id, ativo, valido_de, valido_ate",
    )
    .eq("codigo", codigo)
    .maybeSingle();

  if (cupomError || !cupom) throw new Error("Cupom inválido.");
  const c = cupom as unknown as CupomElegibilidade;

  if (!c.ativo) throw new Error("Este cupom não está mais ativo.");

  const agora = Date.now();
  if (Date.parse(c.valido_de) > agora) throw new Error("Este cupom ainda não está disponível.");
  if (c.valido_ate && Date.parse(c.valido_ate) < agora) throw new Error("Este cupom expirou.");

  if (c.cidade_id && c.cidade_id !== params.cidadeId) {
    throw new Error("Este cupom não é válido na sua cidade.");
  }

  if (c.valor_minimo_corrida != null && params.valorCorrida < c.valor_minimo_corrida) {
    throw new Error(
      `Este cupom exige uma corrida de pelo menos R$ ${c.valor_minimo_corrida.toFixed(2)}.`,
    );
  }

  if (c.limite_uso_total != null) {
    const { count, error: countError } = await supabaseAdmin
      .from("cupom_usos")
      .select("id", { count: "exact", head: true })
      .eq("cupom_id", c.id);
    // Falha ao contar não pode virar "0 usos" — um cupom já esgotado
    // seria reportado como válido. Falha fechado.
    if (countError) throw new Error("Não foi possível verificar o cupom. Tente novamente.");
    if ((count ?? 0) >= c.limite_uso_total) throw new Error("Este cupom atingiu o limite de usos.");
  }

  const { count: usosDoUsuario, error: usosDoUsuarioError } = await supabaseAdmin
    .from("cupom_usos")
    .select("id", { count: "exact", head: true })
    .eq("cupom_id", c.id)
    .eq("usuario_id", params.usuarioId);
  if (usosDoUsuarioError) throw new Error("Não foi possível verificar o cupom. Tente novamente.");
  if ((usosDoUsuario ?? 0) >= c.limite_uso_por_usuario) {
    throw new Error("Você já usou este cupom o máximo de vezes permitido.");
  }

  // O desconto sai inteiro da comissão da Zuvvi, nunca do repasse do
  // motorista (mesma filosofia da gorjeta digital) — por isso é limitado ao
  // tamanho da comissão desta cidade sobre esta corrida. Calculado aqui, no
  // mesmo lugar pra validarCupom (prévia) e criarCorridaCore (aplicação
  // real) sempre concordarem no valor — antes a prévia anunciava um
  // desconto que a aplicação de verdade cortava por trás (achado do Codex
  // no PR #79).
  if (!params.cidadeId) throw new Error("Cidade não configurada.");

  const { data: cidade, error: cidadeError } = await supabaseAdmin
    .from("cidades")
    .select("comissao_pct")
    .eq("id", params.cidadeId)
    .maybeSingle();
  if (cidadeError || !cidade) throw new Error("Não foi possível verificar o cupom. Tente novamente.");

  const comissaoPct = Number(cidade.comissao_pct || 0);
  const comissaoDaCorrida = Math.round(params.valorCorrida * (comissaoPct / 100) * 100) / 100;
  const valorDescontoBruto = calcularValorDesconto(c, params.valorCorrida);
  const valorDesconto = Math.min(valorDescontoBruto, comissaoDaCorrida);

  if (valorDesconto <= 0) {
    throw new Error("Este cupom não pôde ser aplicado a esta corrida.");
  }

  return { cupomId: c.id, codigo: c.codigo, valorDesconto };
}

const validarCupomSchema = z.object({
  codigo: z.string().trim().min(1).max(40),
  valorCorrida: z.number().positive(),
});

export const validarCupom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => validarCupomSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: usuario, error: usuarioError } = await supabaseAdmin
      .from("usuarios")
      .select("id, cidade_id")
      .eq("auth_user_id", context.userId)
      .maybeSingle();
    if (usuarioError || !usuario) throw new Error("Usuário não encontrado.");

    const avaliacao = await avaliarCupomParaCorrida(supabaseAdmin, {
      codigo: data.codigo,
      usuarioId: usuario.id,
      cidadeId: usuario.cidade_id,
      valorCorrida: data.valorCorrida,
    });

    return {
      valido: true as const,
      codigo: avaliacao.codigo,
      valorDesconto: avaliacao.valorDesconto,
    };
  });
