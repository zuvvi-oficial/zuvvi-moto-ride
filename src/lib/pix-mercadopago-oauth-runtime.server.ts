import {
  createPixMercadoPagoOAuthFlow,
  type PixMercadoPagoOAuthFlow,
} from "./pix-mercadopago-oauth-flow.server.js";
import { createMercadoPagoOAuthClient } from "./pix-mercadopago-oauth.server.js";
import {
  createPixOAuthSupabasePersistenceFromClient,
  type PixOAuthRpcClient,
} from "./pix-mercadopago-oauth-supabase.server.js";
import type { PixMercadoPagoOAuthCompletionInput } from "./pix-mercadopago-oauth-input.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const BASE64_KEY_PATTERN = /^[A-Za-z0-9+/_-]+={0,2}$/u;
const REQUIRED_KEY_BYTES = 32;
const START_ERROR = "Não foi possível iniciar a conexão segura com o Mercado Pago.";
const COMPLETE_ERROR = "Não foi possível concluir a conexão segura com o Mercado Pago.";
const CONFIGURATION_ERROR = "A conexão segura com o Mercado Pago não está disponível.";

type QueryResponse = Readonly<{
  data: unknown;
  error: unknown;
}>;

type MaybeSingleBuilder = Readonly<{
  maybeSingle(): PromiseLike<QueryResponse>;
}>;

type FilterBuilder = Readonly<{
  eq(column: string, value: unknown): MaybeSingleBuilder;
}>;

type SelectBuilder = Readonly<{
  select(columns: string): FilterBuilder;
}>;

export type PixOAuthServerSupabaseClient = PixOAuthRpcClient &
  Readonly<{
    from(table: string): SelectBuilder;
  }>;

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type PixMercadoPagoOAuthRuntimeConfig = Readonly<{
  clientId: string | undefined;
  clientSecret: string | undefined;
  encryptionKey: string | undefined;
  redirectUri: string;
  supabaseClient: PixOAuthServerSupabaseClient;
}>;

type RuntimeDependencies = Readonly<{
  fetch?: FetchLike;
  now?: () => number;
}>;

export type PixMercadoPagoOAuthServerActions = Readonly<{
  startForAuthenticatedUser(authUserId: string): Promise<Readonly<{ authorizationUrl: string }>>;
  completeForAuthenticatedUser(
    authUserId: string,
    input: PixMercadoPagoOAuthCompletionInput,
  ): Promise<Readonly<{ pending: true; confirmationExpiresAt: string }>>;
}>;

function requireUuid(value: unknown): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw new Error("invalid");
  return value.toLowerCase();
}

function requireEnvironmentValue(value: string | undefined, maximumLength: number): string {
  if (!value || value.length > maximumLength || value !== value.trim()) {
    throw new Error("invalid");
  }

  return value;
}

function requireEncryptionKey(value: string | undefined): string {
  const encodedKey = requireEnvironmentValue(value, 128);
  if (!BASE64_KEY_PATTERN.test(encodedKey)) throw new Error("invalid");

  const normalized = encodedKey.replaceAll("-", "+").replaceAll("_", "/");
  const paddingLength = (4 - (normalized.length % 4)) % 4;

  try {
    if (atob(normalized + "=".repeat(paddingLength)).length !== REQUIRED_KEY_BYTES) {
      throw new Error("invalid");
    }
  } catch {
    throw new Error("invalid");
  }

  return encodedKey;
}

function readUsuario(data: unknown): string {
  if (
    typeof data !== "object" ||
    data === null ||
    (data as Record<string, unknown>)["is_motorista"] !== true
  ) {
    throw new Error("invalid");
  }

  return requireUuid((data as Record<string, unknown>)["id"]);
}

function readMotorista(data: unknown, expectedId: string): string {
  if (typeof data !== "object" || data === null) throw new Error("invalid");
  const motoristaId = requireUuid((data as Record<string, unknown>)["id"]);
  if (motoristaId !== expectedId) throw new Error("invalid");
  return motoristaId;
}

export function createPixOAuthMotoristaResolver(client: PixOAuthServerSupabaseClient) {
  return async (authUserId: string): Promise<string> => {
    try {
      const validatedAuthUserId = requireUuid(authUserId);
      const usuarioResult = await client
        .from("usuarios")
        .select("id, is_motorista")
        .eq("auth_user_id", validatedAuthUserId)
        .maybeSingle();

      if (usuarioResult.error) throw new Error("invalid");
      const motoristaId = readUsuario(usuarioResult.data);

      const motoristaResult = await client
        .from("motoristas")
        .select("id")
        .eq("id", motoristaId)
        .maybeSingle();

      if (motoristaResult.error) throw new Error("invalid");
      return readMotorista(motoristaResult.data, motoristaId);
    } catch {
      throw new Error("Não foi possível validar o motorista autenticado.");
    }
  };
}

function createActions(
  resolveMotoristaId: (authUserId: string) => Promise<string>,
  flow: PixMercadoPagoOAuthFlow,
): PixMercadoPagoOAuthServerActions {
  return Object.freeze({
    async startForAuthenticatedUser(authUserId) {
      try {
        const motoristaId = await resolveMotoristaId(authUserId);
        return await flow.startConnection(motoristaId);
      } catch {
        throw new Error(START_ERROR);
      }
    },

    async completeForAuthenticatedUser(authUserId, input) {
      try {
        const motoristaId = await resolveMotoristaId(authUserId);
        return await flow.completeConnection({
          motoristaId,
          code: input.code,
          state: input.state,
        });
      } catch {
        throw new Error(COMPLETE_ERROR);
      }
    },
  });
}

export function createPixMercadoPagoOAuthRuntime(
  config: PixMercadoPagoOAuthRuntimeConfig,
  dependencies: RuntimeDependencies = {},
): PixMercadoPagoOAuthServerActions {
  try {
    const clientId = requireEnvironmentValue(config.clientId, 128);
    const clientSecret = requireEnvironmentValue(config.clientSecret, 512);
    const encryptionKey = requireEncryptionKey(config.encryptionKey);
    const oauthClient = createMercadoPagoOAuthClient(
      {
        clientId,
        clientSecret,
        redirectUri: config.redirectUri,
      },
      {
        ...(dependencies.fetch ? { fetch: dependencies.fetch } : {}),
        ...(dependencies.now ? { now: dependencies.now } : {}),
      },
    );
    const persistence = createPixOAuthSupabasePersistenceFromClient(config.supabaseClient);
    const flow = createPixMercadoPagoOAuthFlow(
      { encryptionKey, oauthClient, persistence },
      dependencies.now ? { now: dependencies.now } : {},
    );

    return createActions(createPixOAuthMotoristaResolver(config.supabaseClient), flow);
  } catch {
    throw new Error(CONFIGURATION_ERROR);
  }
}
