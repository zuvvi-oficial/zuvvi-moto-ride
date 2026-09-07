// Rotina periódica (chamada por job externo, ver src/server.ts) que resolve
// tentativas Pix presas em 'criando' reaproveitando a reconciliação canônica
// já usada no fluxo síncrono de criação de cobrança (pagamento.server.ts).
// Nenhuma lógica de decisão nova é criada aqui: apenas identifica candidatas
// vencidas e delega o resultado inteiramente a reconciliarEPersistirPagamentoPix.
import { obterAccessTokenValido, reconciliarEPersistirPagamentoPix } from "./pagamento.server";
import { calcularDeadlinePix, getPixPaymentTimeoutSeconds } from "./pagamento-pix-status.functions";

const BATCH_LIMIT = 50;

export type ResumoReconciliacaoPendentes = Readonly<{
  verificadas: number;
  vencidas: number;
  resolvidas: number;
  semCobrancaConhecida: number;
  falharam: number;
}>;

type TentativaPresaRow = Readonly<{
  id: string;
  motorista_id: string;
  idempotency_key: string;
  mercadopago_payment_id: string | null;
  valor_total: number;
  created_at: string;
  expires_at: string | null;
}>;

export async function reconciliarTentativasPixPendentes(): Promise<ResumoReconciliacaoPendentes> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let verificadas = 0;
  let vencidas = 0;
  let resolvidas = 0;
  let semCobrancaConhecida = 0;
  let falharam = 0;

  const { data: tentativas, error } = await supabaseAdmin
    .from("pagamentos_pix_tentativas")
    .select("id, motorista_id, idempotency_key, mercadopago_payment_id, valor_total, created_at, expires_at")
    .eq("estado_interno", "criando")
    .order("created_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) {
    console.error("[PixReconciliacaoPendentes] Falha ao buscar tentativas presas.");
    throw new Error("Não foi possível buscar tentativas Pix pendentes.");
  }

  const timeoutSeconds = getPixPaymentTimeoutSeconds(process.env["PIX_PAYMENT_TIMEOUT_SECONDS"]);
  const nowMs = Date.now();
  const candidatas = (tentativas ?? []) as TentativaPresaRow[];
  verificadas = candidatas.length;

  for (const tentativa of candidatas) {
    const deadlineAt = calcularDeadlinePix(tentativa.created_at, tentativa.expires_at, timeoutSeconds);
    const deadlineMs = deadlineAt ? Date.parse(deadlineAt) : NaN;
    if (!Number.isFinite(deadlineMs) || nowMs < deadlineMs) continue;

    vencidas += 1;

    try {
      const { data: motorista, error: motoristaError } = await supabaseAdmin
        .from("motoristas")
        .select("conta_mercado_pago_id")
        .eq("id", tentativa.motorista_id)
        .maybeSingle();

      if (motoristaError || !motorista?.conta_mercado_pago_id) {
        console.error(
          "[PixReconciliacaoPendentes] Motorista sem conta Mercado Pago associada; tentativa mantida.",
          { tentativaId: tentativa.id },
        );
        falharam += 1;
        continue;
      }

      const mercadoPagoUserId = motorista.conta_mercado_pago_id;
      const accessToken = await obterAccessTokenValido(
        supabaseAdmin as any,
        tentativa.motorista_id,
        mercadoPagoUserId,
      );

      const reconciliado = await reconciliarEPersistirPagamentoPix(supabaseAdmin as any, {
        accessToken,
        tentativaId: tentativa.id,
        externalReference: tentativa.idempotency_key,
        valorTotal: Number(tentativa.valor_total),
        mercadoPagoUserId,
        paymentId: tentativa.mercadopago_payment_id,
      });

      if (reconciliado) {
        resolvidas += 1;
      } else {
        // Mercado Pago ainda não tem registro dessa tentativa; permanece 'criando'
        // para uma próxima execução, exatamente como o fluxo síncrono já faz.
        semCobrancaConhecida += 1;
      }
    } catch (err) {
      console.error("[PixReconciliacaoPendentes] Falha ao reconciliar tentativa presa.", {
        tentativaId: tentativa.id,
        kind: err instanceof Error ? err.name : "unknown",
      });
      falharam += 1;
    }
  }

  return Object.freeze({ verificadas, vencidas, resolvidas, semCobrancaConhecida, falharam });
}
