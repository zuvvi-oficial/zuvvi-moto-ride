// Lógica server-only da Etapa 1 de pagamentos (Pix via Mercado Pago).
// Não altera a criação do registro "pendente" em pagamentos (feita em criarCorrida).
import { MercadoPagoConfig, Payment } from 'mercadopago';

export type PixChargeResult = {
  paymentId: string;
  qrCode: string;
  qrCodeBase64: string;
};

const GENERIC_ERROR = 'Não foi possível gerar o pagamento Pix. Tente novamente.';

export async function criarCobrancaPixServer(rideId: string, authUserId: string): Promise<PixChargeResult> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

  // 1. Passageiro autenticado
  const { data: usuario, error: usuarioError } = await supabaseAdmin
    .from('usuarios')
    .select('id, nome, email')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (usuarioError || !usuario) {
    throw new Error('Usuário não encontrado');
  }

  // 2. Ownership + forma de pagamento da corrida
  const { data: corrida, error: corridaError } = await supabaseAdmin
    .from('corridas')
    .select('id, passageiro_id, forma_pagamento')
    .eq('id', rideId)
    .maybeSingle();

  if (corridaError || !corrida || corrida.passageiro_id !== usuario.id) {
    throw new Error('Corrida não encontrada');
  }

  if (corrida.forma_pagamento !== 'pix') {
    throw new Error('Esta corrida não foi definida para pagamento via Pix.');
  }

  // 3. Registro de pagamento pendente e sem cobrança gerada
  const { data: pagamento, error: pagamentoError } = await supabaseAdmin
    .from('pagamentos')
    .select('id, status, valor_total, id_transacao_mercadopago')
    .eq('corrida_id', corrida.id)
    .maybeSingle();

  if (pagamentoError || !pagamento) {
    throw new Error('Pagamento desta corrida não encontrado.');
  }

  if (pagamento.status !== 'pendente') {
    throw new Error('Este pagamento não está mais pendente.');
  }

  if (pagamento.id_transacao_mercadopago) {
    throw new Error('Já existe uma cobrança Pix gerada para esta corrida.');
  }

  const valorTotal = Number(pagamento.valor_total);
  if (!Number.isFinite(valorTotal) || valorTotal <= 0) {
    throw new Error(GENERIC_ERROR);
  }

  const accessToken = process.env['MERCADOPAGO_ACCESS_TOKEN'];
  if (!accessToken) {
    console.error('[Pagamento] MERCADOPAGO_ACCESS_TOKEN ausente.');
    throw new Error(GENERIC_ERROR);
  }

  // 4. Cria a cobrança Pix no Mercado Pago
  let mpPaymentId: string | null = null;
  let qrCode: string | null = null;
  let qrCodeBase64: string | null = null;

  try {
    const client = new MercadoPagoConfig({ accessToken });
    const payment = new Payment(client);

    const response = await payment.create({
      body: {
        transaction_amount: Math.round(valorTotal * 100) / 100,
        description: 'Corrida Zuvvi',
        payment_method_id: 'pix',
        payer: {
          email: usuario.email ?? `passageiro+${usuario.id}@zuvvi.app`,
          first_name: usuario.nome ?? 'Passageiro',
        },
      },
      requestOptions: { idempotencyKey: `zuvvi-pix-${pagamento.id}` },
    });

    mpPaymentId = response.id != null ? String(response.id) : null;
    qrCode = response.point_of_interaction?.transaction_data?.qr_code ?? null;
    qrCodeBase64 = response.point_of_interaction?.transaction_data?.qr_code_base64 ?? null;
  } catch (err) {
    console.error('[Pagamento] Falha ao criar cobrança Pix no Mercado Pago:', err);
    throw new Error(GENERIC_ERROR);
  }

  if (!mpPaymentId || !qrCode || !qrCodeBase64) {
    console.error('[Pagamento] Resposta do Mercado Pago sem QR Code utilizável.');
    throw new Error(GENERIC_ERROR);
  }

  // 5. Persiste o id da transação (status permanece "pendente")
  const { error: updateError } = await supabaseAdmin
    .from('pagamentos')
    .update({ id_transacao_mercadopago: mpPaymentId })
    .eq('id', pagamento.id)
    .is('id_transacao_mercadopago', null);

  if (updateError) {
    console.error('[Pagamento] Falha ao salvar id_transacao_mercadopago:', updateError);
    throw new Error(GENERIC_ERROR);
  }

  return { paymentId: mpPaymentId, qrCode, qrCodeBase64 };
}
