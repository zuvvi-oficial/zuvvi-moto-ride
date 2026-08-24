import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Etapa 2 — Conexão da conta Mercado Pago do motorista (OAuth).
 * Não persiste access_token do motorista, apenas o identificador da conta.
 */

const REDIRECT_URI = "https://zuvvi-moto-ride.lovable.app/motorista/mercadopago-callback";

async function getMotoristaId(context: { userId: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: usuario, error } = await supabaseAdmin
    .from("usuarios")
    .select("id, is_motorista")
    .eq("auth_user_id", context.userId)
    .maybeSingle();

  if (error || !usuario) throw new Error("Usuário não encontrado.");
  if (!usuario.is_motorista) throw new Error("Acesso restrito a motoristas.");

  return usuario.id;
}

export const getStatusConexaoMercadoPago = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const motoristaId = await getMotoristaId(context);

    const { data, error } = await supabaseAdmin
      .from("motoristas")
      .select("conta_mercado_pago_id")
      .eq("id", motoristaId)
      .maybeSingle();

    if (error) throw new Error("Não foi possível verificar a conexão.");

    return { conectado: !!data?.conta_mercado_pago_id };
  });

export const iniciarConexaoMercadoPago = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = process.env["MERCADOPAGO_CLIENT_ID"];
    if (!clientId) {
      console.error("[MercadoPago] MERCADOPAGO_CLIENT_ID ausente.");
      throw new Error("Não foi possível iniciar a conexão. Tente novamente.");
    }

    await getMotoristaId(context);

    const state = crypto.randomUUID();

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      platform_id: "mp",
      state,
      redirect_uri: REDIRECT_URI,
    });

    return {
      url: `https://auth.mercadopago.com.br/authorization?${params.toString()}`,
      state,
    };
  });

export const concluirConexaoMercadoPago = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string }) =>
    z.object({ code: z.string().min(4).max(500) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const clientId = process.env["MERCADOPAGO_CLIENT_ID"];
    const clientSecret = process.env["MERCADOPAGO_CLIENT_SECRET"];

    if (!clientId || !clientSecret) {
      console.error("[MercadoPago] Credenciais OAuth ausentes.");
      throw new Error("Não foi possível concluir a conexão. Tente novamente.");
    }

    const motoristaId = await getMotoristaId(context);

    const response = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code: data.code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { user_id?: number | string; message?: string }
      | null;

    if (!response.ok || !payload?.user_id) {
      console.error("[MercadoPago] Falha na troca do code:", response.status, payload?.message);
      throw new Error("Não foi possível concluir a conexão. Tente novamente.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("motoristas")
      .update({ conta_mercado_pago_id: String(payload.user_id) })
      .eq("id", motoristaId);

    if (error) {
      console.error("[MercadoPago] Falha ao salvar conta:", error.message);
      if (error.code === "23505") {
        throw new Error(
          "Esta conta Mercado Pago já está conectada a outro motorista Zuvvi. Use uma conta diferente.",
        );
      }
      throw new Error("Não foi possível concluir a conexão. Tente novamente.");
    }

    return { conectado: true };
  });

export const desconectarMercadoPago = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const motoristaId = await getMotoristaId(context);

    const { data, error } = await supabaseAdmin
      .from("motoristas")
      .update({ conta_mercado_pago_id: null })
      .eq("id", motoristaId)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      console.error("[MercadoPago] Falha ao desconectar conta:", error?.message);
      throw new Error("Não foi possível desconectar a conta. Tente novamente.");
    }

    return { conectado: false };
  });
