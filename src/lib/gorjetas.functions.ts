import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Gorjeta digital — Etapa 1 do diferencial pedido pelo usuário. Só a camada
 * de dados (criar/consultar). A cobrança Pix de verdade (reaproveitando a
 * conexão Mercado Pago do motorista, sem comissão da Zuvvi) é a Etapa 2 —
 * ainda não existe: por enquanto a gorjeta fica registrada como 'pendente'.
 */
const VALOR_MINIMO = 1;
const VALOR_MAXIMO = 200;

const criarGorjetaSchema = z.object({
  corridaId: z.string().uuid(),
  valor: z.number().min(VALOR_MINIMO).max(VALOR_MAXIMO),
});

async function resolverUsuario(supabaseAdmin: any, authUserId: string) {
  const { data: usuario, error } = await supabaseAdmin
    .from("usuarios")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error || !usuario) throw new Error("Usuário não encontrado.");
  return usuario as { id: string };
}

export const criarGorjeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => criarGorjetaSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getPixMercadoPagoSecureConnectionStatus } = await import("./pix-mercadopago-account.server");
    const usuario = await resolverUsuario(supabaseAdmin, context.userId);

    const { data: corrida, error: corridaError } = await supabaseAdmin
      .from("corridas")
      .select("id, passageiro_id, motorista_id, status")
      .eq("id", data.corridaId)
      .maybeSingle();

    if (corridaError || !corrida) {
      throw new Error("Corrida não encontrada.");
    }
    if (corrida.passageiro_id !== usuario.id) {
      throw new Error("Você não participou desta corrida.");
    }
    if (corrida.status !== "concluida" || !corrida.motorista_id) {
      throw new Error("Só é possível dar gorjeta em corridas já concluídas.");
    }

    // A cobrança de verdade (Etapa 2) só sabe pagar via Pix pra uma conta
    // Mercado Pago conectada — não faz sentido registrar a intenção de
    // gorjeta pra um motorista que ainda não tem como recebê-la.
    const { conectado } = await getPixMercadoPagoSecureConnectionStatus(supabaseAdmin as any, corrida.motorista_id);
    if (!conectado) {
      throw new Error("Este motorista ainda não está apto a receber gorjetas digitais.");
    }

    const { data: gorjeta, error } = await supabaseAdmin
      .from("gorjetas")
      .insert({
        corrida_id: corrida.id,
        passageiro_id: usuario.id,
        motorista_id: corrida.motorista_id,
        valor: data.valor,
      })
      .select("id")
      .single();

    if (error) {
      const code = (error as { code?: string }).code;
      if (code === "23505") {
        throw new Error("Você já enviou uma gorjeta para esta corrida.");
      }
      console.error("Erro ao registrar gorjeta:", error);
      throw new Error("Não foi possível registrar a gorjeta.");
    }

    return { success: true as const, id: gorjeta.id as string };
  });

export const getGorjetaDaCorrida = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ corridaId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const usuario = await resolverUsuario(supabaseAdmin, context.userId);

    const { data: gorjeta, error } = await supabaseAdmin
      .from("gorjetas")
      .select("id, valor, status")
      .eq("corrida_id", data.corridaId)
      .eq("passageiro_id", usuario.id)
      .maybeSingle();

    if (error) {
      console.error("Erro ao consultar gorjeta:", error);
      throw new Error("Não foi possível consultar a gorjeta.");
    }

    if (!gorjeta) return { existe: false as const };

    // Antes de responder, tenta atualizar o status com a verdade canônica
    // do Mercado Pago — igual ao pagamento da corrida, nunca confia no
    // payload do webhook sozinho. Fail-closed: se o provedor estiver fora
    // do ar, mantém o snapshot local em vez de quebrar a consulta.
    if (gorjeta.status === "pendente") {
      try {
        const { sincronizarGorjetaPixComMercadoPago } = await import("./gorjeta-pagamento.server");
        await sincronizarGorjetaPixComMercadoPago(gorjeta.id);
      } catch (err) {
        console.error("Falha ao sincronizar gorjeta com o Mercado Pago:", err);
      }
    }

    const { data: atual } = await supabaseAdmin
      .from("gorjetas")
      .select("id, valor, status")
      .eq("id", gorjeta.id)
      .maybeSingle();
    const final = atual ?? gorjeta;

    return {
      existe: true as const,
      id: final.id as string,
      valor: Number(final.valor),
      status: final.status as "pendente" | "paga" | "falhou",
    };
  });

export const criarCobrancaGorjeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ gorjetaId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const usuario = await resolverUsuario(supabaseAdmin, context.userId);

    const { criarCobrancaPixGorjeta } = await import("./gorjeta-pagamento.server");
    const resultado = await criarCobrancaPixGorjeta(data.gorjetaId, usuario.id);

    return {
      pixCopiaCola: resultado.qrCode,
      qrCodeBase64: resultado.qrCodeBase64,
      ticketUrl: resultado.ticketUrl,
    };
  });
