const STATE_PATTERN = /^[A-Za-z0-9_-]{43,128}$/u;
const CODE_MIN_CHARS = 4;
const CODE_MAX_CHARS = 500;

export type PixMercadoPagoOAuthCompletionInput = Readonly<{
  code: string;
  state: string;
}>;

export function parsePixMercadoPagoOAuthCompletionInput(
  value: unknown,
): PixMercadoPagoOAuthCompletionInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Parâmetros OAuth inválidos.");
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.length !== 2 || keys[0] !== "code" || keys[1] !== "state") {
    throw new Error("Parâmetros OAuth inválidos.");
  }

  const code = record["code"];
  const state = record["state"];
  if (
    typeof code !== "string" ||
    code.length < CODE_MIN_CHARS ||
    code.length > CODE_MAX_CHARS ||
    code !== code.trim() ||
    typeof state !== "string" ||
    !STATE_PATTERN.test(state)
  ) {
    throw new Error("Parâmetros OAuth inválidos.");
  }

  return Object.freeze({ code, state });
}
