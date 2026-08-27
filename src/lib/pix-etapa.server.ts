// Etapa Pix do passageiro (server-only): gate de liberação, regeneração de QR após o
// SLA Zuvvi de 5 minutos e cancelamento seguro da cobrança pendente.
// Reutiliza exclusivamente as estruturas Pix já existentes (pagamentos,
// pagamentos_pix_tentativas, RPCs Pix e credenciais OAuth do motorista).
import { MercadoPagoConfig, Payment } from "mercadopago";
import { montarCorpoCobrancaPix, obterAccessTokenValido } from "./pagamento.server";
import { obterPixDeviceIdValido } from "./pix-device-session.server";
import {
  calcularDeadlinePix,
  getPixPaymentTimeoutSeconds,
} from "./pagamento-pix-status.functions";

const GENERIC_ERROR = "Não foi possível atualizar o pagamento Pix. Tente novamente.";
const NOT_FOUND_ERROR = "Pagamento Pix não encontrado.";
const AINDA_VALIDO_ERROR = "O código Pix atual ainda está válido. Aguarde o tempo terminar.";

export type PixEtapaGate = Readonly<{
  isPix: boolean;
  liberado: boolean;
}>;

export type PixRegeneracaoResultado = Readonly<{
  resultado: "pago" | "novo_qr" | "falhou" | "estornado";
}>;

export type PixCancelamentoResultado = Readonly<{
  resultado: "pago" | "cancelada";
}>;

type AdminClient = any;

async function resolverPassageiro(supabaseAdmin: AdminClient, authUserId: string) {
  const { data, error } = await supabaseAdmin
    .from("usuarios")
    .select("id, nome, email, celular, cpf, created_at")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error || !data) throw new Error(NOT_FOUND_ERROR);
  return data as Record<string, any>;
}

async function carregarCorridaPix(
  supabaseAdmin: AdminClient,
  rideId: string,
  passageiroId: string,
) {
  const { data, error } = await supabaseAdmin
    .from("corridas")
    .select("id, passageiro_id, motorista_id, status, forma_pagamento")
    .eq("id", rideId)
    .maybeSingle();
  if (error || !data || data.passageiro_id !== passageiroId) throw new Error(NOT_FOUND_ERROR);
  return data as Record<string, any>;
}

// Gate de entrada do acompanhamento: descobre no servidor se a corrida é Pix e se já
// pode ser liberada. Dinheiro e cartão respondem sempre isPix=false.
export async function getPixEtapaGateServer(
  rideId: string,
  authUserId: string,
): Promise<PixEtapaGate> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const passageiro = await resolverPassageiro(supabaseAdmin, authUserId);
  const corrida = await carregarCorridaPix(supabaseAdmin, rideId, passageiro["id"]);

  if (corrida["forma_pagamento"] !== "pix") {
    return Object.freeze({ isPix: true === false, liberado: true });
  }

  const { data: pagamento } = await supabaseAdmin
    .from("pagamentos")
    .select("status")
    .eq("corrida_id", corrida["id"])
    .eq("meio", "pix")
    .maybeSingle();

  const status = pagamento?.status ?? null;
  // Corridas Pix já encerradas/canceladas seguem para o acompanhamento existente.
  const encerrada =
    corrida["status"] === "cancelada" ||
    corrida["status"] === "concluida" ||
    corrida["status"] === "sem_motorista";

  return Object.freeze({ isPix: true, liberado: status === "pago" || encerrada });
}

async function carregarContexto(supabaseAdmin: AdminClient, rideId: string, authUserId: string) {
  const passageiro = await resolverPassageiro(supabaseAdmin, authUserId);
  const corrida = await carregarCorridaPix(supabaseAdmin, rideId, passageiro["id"]);

  if (
    corrida["forma_pagamento"] !== "pix" ||
    !corrida["motorista_id"] ||
    (corrida["status"] !== "aguardando_pagamento" && corrida["status"] !== "aceita")
  ) {
    throw new Error(NOT_FOUND_ERROR);
  }

  const { data: pagamento, error: pagamentoError } = await supabaseAdmin
    .from("pagamentos")
    .select("id, status, valor_total, valor_comissao, id_transacao_mercadopago")
    .eq("corrida_id", corrida["id"])
    .eq("meio", "pix")
    .maybeSingle();
  if (pagamentoError || !pagamento) throw new Error(NOT_FOUND_ERROR);

  return { passageiro, corrida, pagamento: pagamento as Record<string, any> };
}

async function sincronizarSeguro(
  rideId: string,
  passageiroId: string,
): Promise<"pendente" | "pago" | "falhou" | "estornado" | null> {
  try {
    const { sincronizarPagamentoPixComMercadoPago } = await import("./pix-payment-sync.server");
    return await sincronizarPagamentoPixComMercadoPago({
      rideId,
      expectedPassageiroId: passageiroId,
    });
  } catch {
    return null;
  }
}

async function carregarUltimaTentativa(supabaseAdmin: AdminClient, pagamentoId: string) {
  const { data, error } = await supabaseAdmin
    .from("pagamentos_pix_tentativas")
    .select("id, motorista_id, mercadopago_payment_id, estado_interno, idempotency_key, created_at")
    .eq("pagamento_id", pagamentoId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(GENERIC_ERROR);
  return Array.isArray(data) && data.length > 0 ? (data[0] as Record<string, any>) : null;
}

async function consultarPagamentoMercadoPago(accessToken: string, paymentId: string) {
  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) return null;
  return (await response.json()) as Record<string, unknown>;
}

async function projetarStatus(
  supabaseAdmin: AdminClient,
  tentativaId: string,
  paymentId: string,
  providerStatus: string,
  providerStatusDetail: string | null,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin.rpc("pix_payment_status_project", {
    _tentativa_id: tentativaId,
    _mercadopago_payment_id: paymentId,
    _provider_status: providerStatus,
    _provider_status_detail: providerStatusDetail,
  });
  if (error) throw new Error(GENERIC_ERROR);
  return typeof data === "string" ? data : null;
}

// Invalida no Mercado Pago a cobrança pendente. Se o provedor informar que o pagamento
// já foi aprovado, o pagamento aprovado prevalece e é projetado pela estrutura existente.
async function invalidarCobrancaPendente(
  supabaseAdmin: AdminClient,
  input: Readonly<{
    accessToken: string;
    tentativaId: string;
    paymentId: string;
  }>,
): Promise<"aprovado" | "cancelado"> {
  const atual = await consultarPagamentoMercadoPago(input.accessToken, input.paymentId);
  const statusAtual =
    atual && typeof atual["status"] === "string" ? atual["status"].trim().toLowerCase() : null;

  if (statusAtual === "approved") {
    await projetarStatus(
      supabaseAdmin,
      input.tentativaId,
      input.paymentId,
      "approved",
      typeof atual?.["status_detail"] === "string" ? (atual["status_detail"] as string) : null,
    );
    return "aprovado";
  }

  if (statusAtual === "cancelled" || statusAtual === "rejected") return "cancelado";

  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/${encodeURIComponent(input.paymentId)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "cancelled" }),
    },
  );

  if (!response.ok) {
    // Reconsulta para tratar corrida de condição (aprovação durante o cancelamento).
    const depois = await consultarPagamentoMercadoPago(input.accessToken, input.paymentId);
    const statusDepois =
      depois && typeof depois["status"] === "string"
        ? depois["status"].trim().toLowerCase()
        : null;

    if (statusDepois === "approved") {
      await projetarStatus(
        supabaseAdmin,
        input.tentativaId,
        input.paymentId,
        "approved",
        typeof depois?.["status_detail"] === "string" ? (depois["status_detail"] as string) : null,
      );
      return "aprovado";
    }
    if (statusDepois === "cancelled" || statusDepois === "rejected") return "cancelado";
    throw new Error(GENERIC_ERROR);
  }

  const cancelado = (await response.json()) as Record<string, unknown>;
  const statusFinal =
    typeof cancelado["status"] === "string" ? cancelado["status"].trim().toLowerCase() : null;
  if (statusFinal === "approved") {
    await projetarStatus(
      supabaseAdmin,
      input.tentativaId,
      input.paymentId,
      "approved",
      typeof cancelado["status_detail"] === "string"
        ? (cancelado["status_detail"] as string)
        : null,
    );
    return "aprovado";
  }
  return "cancelado";
}

// Marca a tentativa anterior como falha técnica reutilizável (Pix-only) e libera o
// agregado para uma nova tentativa, mantendo o pagamento da corrida pendente.
// Não usa pix_payment_status_project com 'cancelled' para não cancelar a corrida.
async function liberarTentativaExpirada(
  supabaseAdmin: AdminClient,
  tentativaId: string,
  pagamentoId: string,
): Promise<void> {
  const agora = new Date().toISOString();

  const { error: tentativaError } = await supabaseAdmin
    .from("pagamentos_pix_tentativas")
    .update({
      estado_interno: "falhou",
      provider_status_detail: "zuvvi_sla_expirado_regeneravel",
      failed_at: agora,
      updated_at: agora,
    })
    .eq("id", tentativaId)
    .eq("estado_interno", "pendente");
  if (tentativaError) throw new Error(GENERIC_ERROR);

  const { error: pagamentoError } = await supabaseAdmin
    .from("pagamentos")
    .update({ id_transacao_mercadopago: null, updated_at: agora })
    .eq("id", pagamentoId)
    .eq("status", "pendente");
  if (pagamentoError) throw new Error(GENERIC_ERROR);
}

async function criarNovaTentativaPix(
  supabaseAdmin: AdminClient,
  input: Readonly<{
    rideId: string;
    pagamentoId: string;
    motoristaId: string;
    valorTotal: number;
    valorComissao: number;
    passageiro: Record<string, any>;
    accessToken: string;
  }>,
): Promise<void> {
  const idempotencyKey = `zuvvi-pix-${input.pagamentoId}-r${Date.now().toString(36)}`;

  const { data: nova, error: insertError } = await supabaseAdmin
    .from("pagamentos_pix_tentativas")
    .insert({
      pagamento_id: input.pagamentoId,
      motorista_id: input.motoristaId,
      idempotency_key: idempotencyKey,
      estado_interno: "criando",
      valor_total: input.valorTotal,
      valor_comissao: input.valorComissao,
    })
    .select("id")
    .maybeSingle();

  if (insertError || !nova?.id) throw new Error(GENERIC_ERROR);
  const tentativaId = nova.id as string;

  const deviceId = await obterPixDeviceIdValido(supabaseAdmin, input.passageiro["id"]);

  try {
    const client = new MercadoPagoConfig({ accessToken: input.accessToken });
    const payment = new Payment(client);
    const response = await payment.create({
      body: montarCorpoCobrancaPix({
        valorTotal: input.valorTotal,
        valorComissao: input.valorComissao,
        corridaId: input.rideId,
        passageiroId: input.passageiro["id"],
        passageiroNome: input.passageiro["nome"] ?? null,
        passageiroEmail: input.passageiro["email"] ?? null,
        passageiroCelular: input.passageiro["celular"] ?? null,
        passageiroCpf: input.passageiro["cpf"] ?? null,
        passageiroCreatedAt: input.passageiro["created_at"] ?? null,
        externalReference: idempotencyKey,
      }),
      requestOptions: { idempotencyKey, meliSessionId: deviceId },
    });

    const mpPaymentId = response.id != null ? String(response.id) : null;
    const qrCode = response.point_of_interaction?.transaction_data?.qr_code ?? null;
    if (!mpPaymentId || !qrCode) throw new Error(GENERIC_ERROR);

    const { error: completeError } = await supabaseAdmin.rpc("pix_charge_attempt_complete", {
      _tentativa_id: tentativaId,
      _mercadopago_payment_id: mpPaymentId,
      _provider_status: response.status ?? null,
      _provider_status_detail: response.status_detail ?? null,
      _pix_copia_cola: qrCode,
      _expires_at: response.date_of_expiration ?? null,
    });
    if (completeError) throw new Error(GENERIC_ERROR);
  } catch (error) {
    console.error("[PixEtapa] Falha ao regenerar cobrança Pix.", {
      status: typeof (error as any)?.status === "number" ? (error as any).status : 0,
    });
    // A tentativa recém-criada nunca chegou a ter cobrança externa conhecida.
    await supabaseAdmin.rpc("pix_charge_attempt_fail", {
      _tentativa_id: tentativaId,
      _provider_status_detail: "zuvvi_regeneracao_falhou",
    });
    throw new Error(GENERIC_ERROR);
  }
}

export async function regenerarCobrancaPixServer(
  rideId: string,
  authUserId: string,
): Promise<PixRegeneracaoResultado> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { passageiro, corrida, pagamento } = await carregarContexto(
    supabaseAdmin,
    rideId,
    authUserId,
  );

  // O pagamento aprovado sempre prevalece sobre a expiração voluntária.
  const sincronizado = await sincronizarSeguro(rideId, passageiro["id"]);
  if (sincronizado === "pago") return Object.freeze({ resultado: "pago" as const });
  if (sincronizado === "falhou") return Object.freeze({ resultado: "falhou" as const });
  if (sincronizado === "estornado") return Object.freeze({ resultado: "estornado" as const });
  if (pagamento["status"] === "pago") return Object.freeze({ resultado: "pago" as const });
  if (pagamento["status"] !== "pendente") throw new Error(NOT_FOUND_ERROR);

  const tentativa = await carregarUltimaTentativa(supabaseAdmin, pagamento["id"]);
  if (!tentativa) throw new Error(GENERIC_ERROR);

  const { data: motorista } = await supabaseAdmin
    .from("motoristas")
    .select("conta_mercado_pago_id")
    .eq("id", corrida["motorista_id"])
    .maybeSingle();
  if (!motorista?.conta_mercado_pago_id) throw new Error(GENERIC_ERROR);

  const accessToken = await obterAccessTokenValido(
    supabaseAdmin,
    corrida["motorista_id"],
    motorista.conta_mercado_pago_id,
  );

  if (tentativa["estado_interno"] === "pendente" && tentativa["mercadopago_payment_id"]) {
    const timeoutSeconds = getPixPaymentTimeoutSeconds(
      process.env["PIX_PAYMENT_TIMEOUT_SECONDS"],
    );
    const deadline = calcularDeadlinePix(tentativa["created_at"], null, timeoutSeconds);
    const deadlineMs = deadline ? Date.parse(deadline) : null;
    if (deadlineMs !== null && Date.now() < deadlineMs) throw new Error(AINDA_VALIDO_ERROR);

    const invalidacao = await invalidarCobrancaPendente(supabaseAdmin, {
      accessToken,
      tentativaId: tentativa["id"],
      paymentId: tentativa["mercadopago_payment_id"],
    });
    if (invalidacao === "aprovado") return Object.freeze({ resultado: "pago" as const });

    await liberarTentativaExpirada(supabaseAdmin, tentativa["id"], pagamento["id"]);
  } else if (tentativa["estado_interno"] === "criando") {
    throw new Error(GENERIC_ERROR);
  }

  await criarNovaTentativaPix(supabaseAdmin, {
    rideId,
    pagamentoId: pagamento["id"],
    motoristaId: corrida["motorista_id"],
    valorTotal: Number(pagamento["valor_total"]),
    valorComissao: Number(pagamento["valor_comissao"]),
    passageiro,
    accessToken,
  });

  return Object.freeze({ resultado: "novo_qr" as const });
}

export async function cancelarCorridaPixServer(
  rideId: string,
  authUserId: string,
): Promise<PixCancelamentoResultado> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { criarNotificacao } = await import("./notificacoes.server");
  const { passageiro, corrida, pagamento } = await carregarContexto(
    supabaseAdmin,
    rideId,
    authUserId,
  );

  const sincronizado = await sincronizarSeguro(rideId, passageiro["id"]);
  if (sincronizado === "pago" || pagamento["status"] === "pago") {
    return Object.freeze({ resultado: "pago" as const });
  }

  const tentativa = await carregarUltimaTentativa(supabaseAdmin, pagamento["id"]);

  if (tentativa?.["estado_interno"] === "pendente" && tentativa["mercadopago_payment_id"]) {
    const { data: motorista } = await supabaseAdmin
      .from("motoristas")
      .select("conta_mercado_pago_id")
      .eq("id", corrida["motorista_id"])
      .maybeSingle();
    if (!motorista?.conta_mercado_pago_id) throw new Error(GENERIC_ERROR);

    const accessToken = await obterAccessTokenValido(
      supabaseAdmin,
      corrida["motorista_id"],
      motorista.conta_mercado_pago_id,
    );

    const invalidacao = await invalidarCobrancaPendente(supabaseAdmin, {
      accessToken,
      tentativaId: tentativa["id"],
      paymentId: tentativa["mercadopago_payment_id"],
    });
    if (invalidacao === "aprovado") return Object.freeze({ resultado: "pago" as const });
  }

  const agora = new Date().toISOString();

  if (tentativa && tentativa["estado_interno"] === "pendente") {
    await supabaseAdmin
      .from("pagamentos_pix_tentativas")
      .update({
        estado_interno: "falhou",
        provider_status_detail: "zuvvi_cancelado_pelo_passageiro",
        failed_at: agora,
        updated_at: agora,
      })
      .eq("id", tentativa["id"])
      .eq("estado_interno", "pendente");
  }

  await supabaseAdmin
    .from("pagamentos")
    .update({ status: "falhou", updated_at: agora })
    .eq("id", pagamento["id"])
    .eq("status", "pendente");

  const { data: cancelada, error: cancelError } = await supabaseAdmin
    .from("corridas")
    .update({
      status: "cancelada",
      cancelado_por: "passageiro",
      motivo_cancelamento: "pagamento_pix_cancelado_passageiro",
      data_cancelamento: agora,
      updated_at: agora,
    })
    .eq("id", corrida["id"])
    .eq("passageiro_id", passageiro["id"])
    .in("status", ["aguardando_pagamento", "aceita"])
    .select("id, motorista_id")
    .maybeSingle();

  if (cancelError || !cancelada) throw new Error(GENERIC_ERROR);

  // Libera o motorista, espelhando o comportamento já usado pela estrutura Pix.
  await supabaseAdmin
    .from("motoristas")
    .update({ is_disponivel: true, updated_at: agora })
    .eq("id", corrida["motorista_id"])
    .eq("status_aprovacao", "aprovado");

  if (cancelada.motorista_id) {
    await criarNotificacao(supabaseAdmin, {
      usuario_id: cancelada.motorista_id,
      tipo: "corrida_cancelada",
      titulo: "❌ Corrida cancelada",
      mensagem: "O passageiro cancelou a corrida sem concluir o pagamento Pix.",
      corrida_id: corrida["id"],
    });
  }

  return Object.freeze({ resultado: "cancelada" as const });
}
