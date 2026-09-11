import { MercadoPagoConfig, Payment } from "mercadopago";
import { obterAccessTokenValido, montarCorpoCobrancaPix, normalizeMercadoPagoTicketUrl, type PixChargeResult } from "./pagamento.server";

/**
 * Gorjeta digital — Etapa 2: motor de cobrança Pix de verdade. Reaproveita
 * as peças já existentes do pagamento de corrida (token OAuth do motorista,
 * corpo da cobrança, verificação canônica direto na API do Mercado Pago —
 * nunca confia no payload do webhook), mas como um fluxo independente e
 * proporcionalmente mais simples: gorjeta é opcional, valor baixo (até
 * R$200), sem comissão da Zuvvi (application_fee=0, 100% pro motorista) e
 * sem repasse interno para errar. Por isso não replica a arquitetura de
 * "tentativas" dedicada (tabela própria + RPC de reivindicação atômica) que
 * o pagamento de corrida usa — decisão consciente de proporcionalidade,
 * não descuido.
 */

const GENERIC_ERROR = "Não foi possível gerar a cobrança Pix da gorjeta. Tente novamente.";
const CONFIRM_ERROR = "Não foi possível confirmar o pagamento da gorjeta.";

function externalReferenceDaGorjeta(gorjetaId: string): string {
  return `gorjeta-${gorjetaId}`;
}

function sameCurrencyAmount(actual: unknown, expected: number): boolean {
  const parsed = Number(actual);
  return Number.isFinite(parsed) && Math.round(parsed * 100) === Math.round(Number(expected) * 100);
}

export async function criarCobrancaPixGorjeta(
  gorjetaId: string,
  passageiroId: string,
): Promise<PixChargeResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: gorjeta, error: gorjetaError } = await supabaseAdmin
    .from("gorjetas")
    .select("id, passageiro_id, motorista_id, valor, status, id_transacao_mercadopago")
    .eq("id", gorjetaId)
    .maybeSingle();

  if (gorjetaError || !gorjeta || gorjeta.passageiro_id !== passageiroId) {
    throw new Error(GENERIC_ERROR);
  }
  if (gorjeta.status !== "pendente") {
    throw new Error("Esta gorjeta já foi processada.");
  }
  if (gorjeta.id_transacao_mercadopago) {
    // Já existe uma cobrança criada pra esta gorjeta (o QR pode ter
    // expirado sem pagamento) — nesta etapa não regeramos uma segunda
    // cobrança pro mesmo registro, pra nunca correr o risco de dois
    // pagamentos válidos pra uma linha só. Quem quiser tentar de novo
    // precisa criar uma nova gorjeta.
    throw new Error("Já existe uma cobrança gerada para esta gorjeta.");
  }

  const { data: motorista, error: motoristaError } = await supabaseAdmin
    .from("motoristas")
    .select("conta_mercado_pago_id")
    .eq("id", gorjeta.motorista_id)
    .maybeSingle();
  if (motoristaError || !motorista?.conta_mercado_pago_id) {
    throw new Error("A conta Mercado Pago do motorista não está conectada ou válida.");
  }

  const { data: passageiro, error: passageiroError } = await supabaseAdmin
    .from("usuarios")
    .select("id, nome, email, celular, cpf, created_at")
    .eq("id", passageiroId)
    .maybeSingle();
  if (passageiroError || !passageiro) throw new Error(GENERIC_ERROR);

  const accessToken = await obterAccessTokenValido(
    supabaseAdmin as any,
    gorjeta.motorista_id,
    motorista.conta_mercado_pago_id,
  );

  const externalReference = externalReferenceDaGorjeta(gorjeta.id);

  let response: Awaited<ReturnType<Payment["create"]>>;
  try {
    const client = new MercadoPagoConfig({ accessToken });
    const payment = new Payment(client);
    response = await payment.create({
      body: montarCorpoCobrancaPix({
        valorTotal: Number(gorjeta.valor),
        valorComissao: 0,
        corridaId: gorjeta.id,
        passageiroId,
        passageiroNome: passageiro.nome,
        passageiroEmail: passageiro.email,
        passageiroCelular: passageiro.celular,
        passageiroCpf: passageiro.cpf,
        passageiroCreatedAt: passageiro.created_at,
        externalReference,
        descricao: "Gorjeta Zuvvi",
        itemTitulo: "Gorjeta para o motorista",
        itemDescricao: "Gorjeta digital de uma corrida Zuvvi",
      }),
      requestOptions: { idempotencyKey: externalReference },
    });
  } catch (error) {
    console.error("[GorjetaPagamento] Falha ao criar cobrança Pix.", {
      kind: error instanceof Error ? error.name : "unknown",
    });
    throw new Error(GENERIC_ERROR);
  }

  const paymentId = response.id != null ? String(response.id) : null;
  const qrCode = response.point_of_interaction?.transaction_data?.qr_code ?? null;
  const qrCodeBase64 = response.point_of_interaction?.transaction_data?.qr_code_base64 ?? null;
  const ticketUrl = normalizeMercadoPagoTicketUrl(
    response.point_of_interaction?.transaction_data?.ticket_url,
  );

  if (!paymentId || !qrCode || !qrCodeBase64) {
    console.error("[GorjetaPagamento] Resposta Pix incompleta na criação da cobrança de gorjeta.");
    throw new Error(GENERIC_ERROR);
  }

  const { error: updateError } = await supabaseAdmin
    .from("gorjetas")
    .update({ id_transacao_mercadopago: paymentId, updated_at: new Date().toISOString() } as any)
    .eq("id", gorjeta.id)
    .eq("status", "pendente");

  if (updateError) {
    console.error(
      "[GorjetaPagamento] Cobrança criada no Mercado Pago mas falha ao vincular id_transacao_mercadopago — requer reconciliação manual.",
      { gorjetaId: gorjeta.id, paymentId },
    );
    throw new Error(GENERIC_ERROR);
  }

  return { paymentId, qrCode, qrCodeBase64, ticketUrl };
}

export type GorjetaPixSyncResult = "pendente" | "paga" | "falhou";

export async function sincronizarGorjetaPixComMercadoPago(
  gorjetaId: string,
): Promise<GorjetaPixSyncResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: gorjeta, error: gorjetaError } = await supabaseAdmin
    .from("gorjetas")
    .select("id, motorista_id, valor, status, id_transacao_mercadopago")
    .eq("id", gorjetaId)
    .maybeSingle();

  if (gorjetaError || !gorjeta) throw new Error(CONFIRM_ERROR);
  if (gorjeta.status === "paga") return "paga";
  if (gorjeta.status === "falhou") return "falhou";
  if (!gorjeta.id_transacao_mercadopago) return "pendente";

  const { data: motorista, error: motoristaError } = await supabaseAdmin
    .from("motoristas")
    .select("conta_mercado_pago_id")
    .eq("id", gorjeta.motorista_id)
    .maybeSingle();
  if (motoristaError || !motorista?.conta_mercado_pago_id) throw new Error(CONFIRM_ERROR);

  const accessToken = await obterAccessTokenValido(
    supabaseAdmin as any,
    gorjeta.motorista_id,
    motorista.conta_mercado_pago_id,
  );

  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/${encodeURIComponent(gorjeta.id_transacao_mercadopago)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) return "pendente";

  const provider = (await response.json()) as Record<string, unknown>;
  const providerId = provider["id"] != null ? String(provider["id"]) : null;
  const providerCollectorId = provider["collector_id"] != null ? String(provider["collector_id"]) : null;
  const providerExternalReference =
    typeof provider["external_reference"] === "string" ? provider["external_reference"] : null;

  if (
    providerId !== gorjeta.id_transacao_mercadopago ||
    providerCollectorId !== motorista.conta_mercado_pago_id ||
    providerExternalReference !== externalReferenceDaGorjeta(gorjeta.id) ||
    provider["payment_method_id"] !== "pix" ||
    provider["currency_id"] !== "BRL" ||
    !sameCurrencyAmount(provider["transaction_amount"], Number(gorjeta.valor))
  ) {
    throw new Error(CONFIRM_ERROR);
  }

  const providerStatus =
    typeof provider["status"] === "string" ? provider["status"].trim().toLowerCase() : null;
  const providerStatusDetail =
    typeof provider["status_detail"] === "string" ? provider["status_detail"] : null;

  if (providerStatus === "approved") {
    const { data: atualizado, error: updateError } = await supabaseAdmin
      .from("gorjetas")
      .update({
        status: "paga",
        pago_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", gorjeta.id)
      .eq("status", "pendente")
      .select("id, motorista_id, valor")
      .maybeSingle();

    if (updateError) throw new Error(CONFIRM_ERROR);

    if (atualizado) {
      const { criarNotificacao } = await import("./notificacoes.server");
      await criarNotificacao(supabaseAdmin, {
        usuario_id: atualizado.motorista_id as string,
        tipo: "gorjeta_recebida",
        titulo: "🎉 Você recebeu uma gorjeta!",
        mensagem: `Um passageiro te deu R$ ${Number(atualizado.valor).toFixed(2)} de gorjeta.`,
      }).catch((err) => {
        console.error("[GorjetaPagamento] Falha ao notificar motorista sobre gorjeta paga.", err);
      });
    }

    return "paga";
  }

  if (providerStatus === "rejected" || providerStatus === "cancelled") {
    await supabaseAdmin
      .from("gorjetas")
      .update({
        status: "falhou",
        motivo_falha: providerStatusDetail ?? "Pagamento rejeitado pelo Mercado Pago.",
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", gorjeta.id)
      .eq("status", "pendente");
    return "falhou";
  }

  return "pendente";
}
