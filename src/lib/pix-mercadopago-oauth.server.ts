const AUTHORIZATION_ENDPOINT = "https://auth.mercadopago.com.br/authorization";
const TOKEN_ENDPOINT = "https://api.mercadopago.com/oauth/token";
const PKCE_VALUE_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/u;
const STATE_PATTERN = /^[A-Za-z0-9_-]{43,128}$/u;
const MERCADOPAGO_USER_ID_PATTERN = /^\d{1,128}$/u;
const SAFE_REMOTE_CODE_PATTERN = /^[A-Za-z0-9._-]{1,128}$/u;
const MAX_TOKEN_RESPONSE_CHARS = 65_536;
const MAX_TOKEN_CHARS = 8_192;
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 30_000;

const INVALID_INPUT_MESSAGE = "Parâmetros OAuth Mercado Pago inválidos.";
const REMOTE_ERROR_MESSAGE = "Não foi possível concluir a comunicação segura com o Mercado Pago.";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type MercadoPagoOAuthTokenSet = Readonly<{
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  expiresAt: string;
  scope?: string;
  tokenType?: string;
}>;

export type MercadoPagoOAuthClient = Readonly<{
  buildAuthorizationUrl(input: { state: string; codeChallenge: string }): string;
  exchangeAuthorizationCode(input: {
    code: string;
    codeVerifier: string;
  }): Promise<MercadoPagoOAuthTokenSet>;
  refreshAccessToken(refreshToken: string): Promise<MercadoPagoOAuthTokenSet>;
}>;

type OAuthClientConfig = Readonly<{
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  timeoutMs?: number;
}>;

type OAuthClientDependencies = Readonly<{
  fetch?: FetchLike;
  now?: () => number;
}>;

function invalidInput(): never {
  throw new Error(INVALID_INPUT_MESSAGE);
}

function remoteError(): never {
  throw new Error(REMOTE_ERROR_MESSAGE);
}

function requireTrimmedString(value: unknown, maximumLength: number): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximumLength ||
    value !== value.trim()
  ) {
    invalidInput();
  }

  return value;
}

function validateRedirectUri(value: string): string {
  const redirectUri = requireTrimmedString(value, 2_048);

  try {
    const parsed = new URL(redirectUri);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      invalidInput();
    }
  } catch {
    invalidInput();
  }

  return redirectUri;
}

function validateTimeout(value: number | undefined): number {
  const timeout = value ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > MAX_TIMEOUT_MS) {
    invalidInput();
  }

  return timeout;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readSafeRemoteErrorCode(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;

  const candidates = [payload["error"], payload["error_code"], payload["code"]];
  for (const candidate of candidates) {
    const normalized =
      typeof candidate === "number" && Number.isSafeInteger(candidate)
        ? String(candidate)
        : candidate;

    if (typeof normalized === "string" && SAFE_REMOTE_CODE_PATTERN.test(normalized)) {
      return normalized;
    }
  }

  return undefined;
}

function readToken(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_TOKEN_CHARS ||
    value !== value.trim()
  ) {
    remoteError();
  }

  return value;
}

function readUserId(value: unknown): string {
  const normalized =
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? String(value) : value;

  if (typeof normalized !== "string" || !MERCADOPAGO_USER_ID_PATTERN.test(normalized)) {
    remoteError();
  }

  return normalized;
}

function readExpiresIn(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 31_536_000) {
    remoteError();
  }

  return value as number;
}

function readOptionalString(value: unknown, maximumLength: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || value.length > maximumLength || value !== value.trim()) {
    remoteError();
  }

  return value;
}

function parseTokenSet(payload: unknown, now: () => number): MercadoPagoOAuthTokenSet {
  if (!isRecord(payload)) remoteError();

  const expiresInSeconds = readExpiresIn(payload["expires_in"]);
  const nowValue = now();
  if (!Number.isFinite(nowValue) || nowValue < 0) remoteError();

  const expiresAt = new Date(nowValue + expiresInSeconds * 1_000);
  if (Number.isNaN(expiresAt.getTime())) remoteError();

  const scope = readOptionalString(payload["scope"], 2_048);
  const tokenType = readOptionalString(payload["token_type"], 64);

  return Object.freeze({
    userId: readUserId(payload["user_id"]),
    accessToken: readToken(payload["access_token"]),
    refreshToken: readToken(payload["refresh_token"]),
    expiresInSeconds,
    expiresAt: expiresAt.toISOString(),
    ...(scope ? { scope } : {}),
    ...(tokenType ? { tokenType } : {}),
  });
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const body = await response.text();
  if (body.length === 0 || body.length > MAX_TOKEN_RESPONSE_CHARS) remoteError();

  try {
    return JSON.parse(body) as unknown;
  } catch {
    remoteError();
  }
}

export function createMercadoPagoOAuthClient(
  config: OAuthClientConfig,
  dependencies: OAuthClientDependencies = {},
): MercadoPagoOAuthClient {
  const clientId = requireTrimmedString(config.clientId, 128);
  const clientSecret = requireTrimmedString(config.clientSecret, 512);
  const redirectUri = validateRedirectUri(config.redirectUri);
  const timeoutMs = validateTimeout(config.timeoutMs);
  const fetchImplementation = dependencies.fetch ?? globalThis.fetch;
  const now = dependencies.now ?? Date.now;

  if (typeof fetchImplementation !== "function" || typeof now !== "function") invalidInput();

  async function requestToken(payload: Record<string, string>): Promise<MercadoPagoOAuthTokenSet> {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), timeoutMs);
    const grantType =
      payload["grant_type"] === "refresh_token" ? "refresh_token" : "authorization_code";

    try {
      let response: Response;
      try {
        response = await fetchImplementation(TOKEN_ENDPOINT, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: abortController.signal,
        });
      } catch {
        console.error("[PixOAuthDiag] token_transport_failed", {
          grantType,
          reason: abortController.signal.aborted ? "timeout" : "network",
        });
        remoteError();
      }

      let responsePayload: unknown;
      try {
        responsePayload = await readJsonResponse(response);
      } catch {
        console.error("[PixOAuthDiag] token_response_unreadable", {
          grantType,
          status: response.status,
        });
        remoteError();
      }

      if (!response.ok) {
        console.error("[PixOAuthDiag] token_exchange_rejected", {
          grantType,
          status: response.status,
          errorCode: readSafeRemoteErrorCode(responsePayload) ?? "unknown",
        });
        remoteError();
      }

      try {
        const tokenSet = parseTokenSet(responsePayload, now);
        console.info("[PixOAuthDiag] token_exchange_accepted", {
          grantType,
          status: response.status,
        });
        return tokenSet;
      } catch {
        console.error("[PixOAuthDiag] token_response_invalid_shape", {
          grantType,
          status: response.status,
        });
        remoteError();
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  return Object.freeze({
    buildAuthorizationUrl({ state, codeChallenge }): string {
      if (!STATE_PATTERN.test(state) || !PKCE_VALUE_PATTERN.test(codeChallenge)) invalidInput();

      const url = new URL(AUTHORIZATION_ENDPOINT);
      url.search = new URLSearchParams({
        client_id: clientId,
        response_type: "code",
        platform_id: "mp",
        state,
        redirect_uri: redirectUri,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      }).toString();

      return url.toString();
    },

    async exchangeAuthorizationCode({ code, codeVerifier }): Promise<MercadoPagoOAuthTokenSet> {
      const authorizationCode = requireTrimmedString(code, 500);
      if (authorizationCode.length < 4 || !PKCE_VALUE_PATTERN.test(codeVerifier)) invalidInput();

      return requestToken({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code: authorizationCode,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      });
    },

    async refreshAccessToken(refreshToken): Promise<MercadoPagoOAuthTokenSet> {
      const validatedRefreshToken = requireTrimmedString(refreshToken, MAX_TOKEN_CHARS);

      return requestToken({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: validatedRefreshToken,
      });
    },
  });
}
