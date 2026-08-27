const PKCE_VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;
const BASE64_KEY_PATTERN = /^[A-Za-z0-9+/_-]+={0,2}$/;
const ENVELOPE_VERSION = "v1";
const ENVELOPE_CONTEXT = "zuvvi:pix-oauth:v1";
const AES_KEY_BYTES = 32;
const AES_GCM_IV_BYTES = 12;
const MAX_SECRET_BYTES = 8192;

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64ToBytes(value: string): Uint8Array {
  if (!value || value !== value.trim() || !BASE64_KEY_PATTERN.test(value)) {
    throw new Error("Chave OAuth inválida.");
  }

  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const paddingLength = (4 - (normalized.length % 4)) % 4;

  try {
    const binary = atob(normalized + "=".repeat(paddingLength));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new Error("Chave OAuth inválida.");
  }
}

function base64UrlToBytes(value: string): Uint8Array {
  if (!value || !/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw new Error("Envelope OAuth inválido.");
  }

  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const paddingLength = (4 - (normalized.length % 4)) % 4;

  try {
    const binary = atob(normalized + "=".repeat(paddingLength));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new Error("Envelope OAuth inválido.");
  }
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function validatePkceVerifier(verifier: string): void {
  if (!PKCE_VERIFIER_PATTERN.test(verifier)) {
    throw new Error("Code verifier PKCE inválido.");
  }
}

async function importAesKey(encodedKey: string): Promise<CryptoKey> {
  const keyBytes = base64ToBytes(encodedKey);
  if (keyBytes.byteLength !== AES_KEY_BYTES) {
    throw new Error("Chave OAuth inválida.");
  }

  return crypto.subtle.importKey("raw", toArrayBuffer(keyBytes), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export function generateOAuthState(): string {
  return bytesToBase64Url(randomBytes(32));
}

export function generatePkceVerifier(): string {
  const verifier = bytesToBase64Url(randomBytes(64));
  validatePkceVerifier(verifier);
  return verifier;
}

export async function createPkceChallenge(verifier: string): Promise<string> {
  validatePkceVerifier(verifier);
  const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(encoder.encode(verifier)));
  return bytesToBase64Url(new Uint8Array(digest));
}

export async function hashOAuthState(state: string): Promise<string> {
  const stateBytes = encoder.encode(state);
  if (stateBytes.byteLength === 0 || stateBytes.byteLength > 512) {
    throw new Error("State OAuth inválido.");
  }

  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", toArrayBuffer(stateBytes)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function encryptOAuthSecret(plaintext: string, encodedKey: string): Promise<string> {
  const plaintextBytes = encoder.encode(plaintext);
  if (plaintextBytes.byteLength === 0 || plaintextBytes.byteLength > MAX_SECRET_BYTES) {
    throw new Error("Segredo OAuth inválido.");
  }

  const key = await importAesKey(encodedKey);
  const iv = randomBytes(AES_GCM_IV_BYTES);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(iv),
      additionalData: toArrayBuffer(encoder.encode(ENVELOPE_CONTEXT)),
      tagLength: 128,
    },
    key,
    toArrayBuffer(plaintextBytes),
  );

  return [
    ENVELOPE_VERSION,
    bytesToBase64Url(iv),
    bytesToBase64Url(new Uint8Array(ciphertext)),
  ].join(".");
}

export async function decryptOAuthSecret(envelope: string, encodedKey: string): Promise<string> {
  try {
    const parts = envelope.split(".");
    if (parts.length !== 3 || parts[0] !== ENVELOPE_VERSION) {
      throw new Error("Envelope OAuth inválido.");
    }

    const iv = base64UrlToBytes(parts[1] ?? "");
    const ciphertext = base64UrlToBytes(parts[2] ?? "");
    if (iv.byteLength !== AES_GCM_IV_BYTES || ciphertext.byteLength < 17) {
      throw new Error("Envelope OAuth inválido.");
    }

    const key = await importAesKey(encodedKey);
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(iv),
        additionalData: toArrayBuffer(encoder.encode(ENVELOPE_CONTEXT)),
        tagLength: 128,
      },
      key,
      toArrayBuffer(ciphertext),
    );

    return decoder.decode(plaintext);
  } catch {
    throw new Error("Envelope OAuth inválido.");
  }
}
