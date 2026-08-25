import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parsePixMercadoPagoOAuthCompletionInput } from "./pix-mercadopago-oauth-input";
import type { PixOAuthServerSupabaseClient } from "./pix-mercadopago-oauth-runtime.server";
import type { PixMercadoPagoAccountClient } from "./pix-mercadopago-account.server";

const REDIRECT_URI = "https://zuvvi-moto-ride.lovable.app/motorista/mercadopago-callback";
const START_ERROR = "Não foi possível iniciar a conexão segura com o Mercado Pago.";
const COMPLETE_ERROR = "Não foi possível concluir a conexão segura com o Mercado Pago.";
const STATUS_ERROR = "Não foi possível consultar a conexão segura com o Mercado Pago.";
const DISCONNECT_ERROR = "Não foi possível desconectar a conta Mercado Pago com segurança.";

async function createAuthenticatedRuntime() {
  const [{ supabaseAdmin }, { createPixMercadoPagoOAuthRuntime }] = await Promise.all([
    import("@/integrations/supabase/client.server"),
    import("./pix-mercadopago-oauth-runtime.server"),
  ]);

  return createPixMercadoPagoOAuthRuntime({
    clientId: process.env["MERCADOPAGO_CLIENT_ID"],
    clientSecret: process.env["MERCADOPAGO_CLIENT_SECRET"],
    encryptionKey: process.env["PIX_OAUTH_ENCRYPTION_KEY"],
    redirectUri: REDIRECT_URI,
    supabaseClient: supabaseAdmin as unknown as PixOAuthServerSupabaseClient,
  });
}

async function createAuthenticatedAccountContext(authUserId: string) {
  const [
    { supabaseAdmin },
    { createPixOAuthMotoristaResolver },
    { getPixMercadoPagoSecureConnectionStatus, disconnectPixMercadoPagoSafely },
  ] = await Promise.all([
    import("@/integrations/supabase/client.server"),
    import("./pix-mercadopago-oauth-runtime.server"),
    import("./pix-mercadopago-account.server"),
  ]);

  const oauthClient = supabaseAdmin as unknown as PixOAuthServerSupabaseClient;
  const motoristaId = await createPixOAuthMotoristaResolver(oauthClient)(authUserId);
  const accountClient = supabaseAdmin as unknown as PixMercadoPagoAccountClient;

  return {
    motoristaId,
    getStatus: () => getPixMercadoPagoSecureConnectionStatus(accountClient, motoristaId),
    disconnect: () => disconnectPixMercadoPagoSafely(accountClient, motoristaId),
  };
}

export const iniciarConexaoMercadoPagoPixSegura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const runtime = await createAuthenticatedRuntime();
      return await runtime.startForAuthenticatedUser(context.userId);
    } catch {
      throw new Error(START_ERROR);
    }
  });

export const concluirConexaoMercadoPagoPixSegura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parsePixMercadoPagoOAuthCompletionInput)
  .handler(async ({ data, context }) => {
    try {
      const runtime = await createAuthenticatedRuntime();
      return await runtime.completeForAuthenticatedUser(context.userId, data);
    } catch {
      throw new Error(COMPLETE_ERROR);
    }
  });

export const getStatusConexaoMercadoPagoPixSegura = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const account = await createAuthenticatedAccountContext(context.userId);
      return await account.getStatus();
    } catch {
      throw new Error(STATUS_ERROR);
    }
  });

export const desconectarMercadoPagoPixSeguro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const account = await createAuthenticatedAccountContext(context.userId);
      return await account.disconnect();
    } catch {
      throw new Error(DISCONNECT_ERROR);
    }
  });
