import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parsePixMercadoPagoOAuthCompletionInput } from "./pix-mercadopago-oauth-input";
import type { PixOAuthServerSupabaseClient } from "./pix-mercadopago-oauth-runtime.server";

const REDIRECT_URI = "https://zuvvi-moto-ride.lovable.app/motorista/mercadopago-callback";
const START_ERROR = "Não foi possível iniciar a conexão segura com o Mercado Pago.";
const COMPLETE_ERROR = "Não foi possível concluir a conexão segura com o Mercado Pago.";

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
