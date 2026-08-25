import assert from "node:assert/strict";
import test from "node:test";
import {
  createPkceChallenge,
  decryptOAuthSecret,
  encryptOAuthSecret,
  generateOAuthState,
  generatePkceVerifier,
  hashOAuthState,
} from "../../src/lib/pix-oauth-crypto.server.js";

const TEST_KEY = Buffer.from(Array.from({ length: 32 }, (_, index) => index)).toString("base64url");
const OTHER_TEST_KEY = Buffer.from(Array.from({ length: 32 }, (_, index) => 255 - index)).toString(
  "base64url",
);

test("gera state aleatório de 32 bytes em base64url", () => {
  const first = generateOAuthState();
  const second = generateOAuthState();

  assert.match(first, /^[A-Za-z0-9_-]{43}$/u);
  assert.match(second, /^[A-Za-z0-9_-]{43}$/u);
  assert.notEqual(first, second);
});

test("gera code_verifier PKCE válido e não repetido", () => {
  const first = generatePkceVerifier();
  const second = generatePkceVerifier();

  assert.match(first, /^[A-Za-z0-9._~-]{43,128}$/u);
  assert.match(second, /^[A-Za-z0-9._~-]{43,128}$/u);
  assert.equal(first.length, 86);
  assert.notEqual(first, second);
});

test("reproduz o vetor oficial S256 do RFC 7636", async () => {
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  assert.equal(await createPkceChallenge(verifier), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});

test("rejeita code_verifier curto ou com caracteres inválidos", async () => {
  await assert.rejects(() => createPkceChallenge("curto"), {
    message: "Code verifier PKCE inválido.",
  });
  await assert.rejects(() => createPkceChallenge("!".repeat(43)), {
    message: "Code verifier PKCE inválido.",
  });
});

test("calcula SHA-256 hexadecimal conhecido e determinístico", async () => {
  const expected = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
  assert.equal(await hashOAuthState("abc"), expected);
  assert.equal(await hashOAuthState("abc"), expected);
  assert.notEqual(await hashOAuthState("abcd"), expected);
});

test("rejeita state vazio ou excessivo", async () => {
  await assert.rejects(() => hashOAuthState(""), {
    message: "State OAuth inválido.",
  });
  await assert.rejects(() => hashOAuthState("x".repeat(513)), {
    message: "State OAuth inválido.",
  });
});

test("cifra e decifra envelope AES-256-GCM sem texto puro", async () => {
  const secret = "verifier-super-secreto-1234567890";
  const envelope = await encryptOAuthSecret(secret, TEST_KEY);

  assert.match(envelope, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u);
  assert.equal(envelope.includes(secret), false);
  assert.equal(await decryptOAuthSecret(envelope, TEST_KEY), secret);
});

test("usa IV aleatório para o mesmo texto e chave", async () => {
  const first = await encryptOAuthSecret("mesmo-segredo", TEST_KEY);
  const second = await encryptOAuthSecret("mesmo-segredo", TEST_KEY);

  assert.notEqual(first, second);
  assert.equal(await decryptOAuthSecret(first, TEST_KEY), "mesmo-segredo");
  assert.equal(await decryptOAuthSecret(second, TEST_KEY), "mesmo-segredo");
});

test("rejeita chave incorreta ou malformada", async () => {
  const envelope = await encryptOAuthSecret("segredo", TEST_KEY);

  await assert.rejects(() => decryptOAuthSecret(envelope, OTHER_TEST_KEY), {
    message: "Envelope OAuth inválido.",
  });
  await assert.rejects(() => encryptOAuthSecret("segredo", "chave-curta"), {
    message: "Chave OAuth inválida.",
  });
});

test("rejeita envelope adulterado, malformado ou de versão desconhecida", async () => {
  const envelope = await encryptOAuthSecret("segredo", TEST_KEY);
  const lastCharacter = envelope.at(-1);
  const tampered = `${envelope.slice(0, -1)}${lastCharacter === "A" ? "B" : "A"}`;

  await assert.rejects(() => decryptOAuthSecret(tampered, TEST_KEY), {
    message: "Envelope OAuth inválido.",
  });
  await assert.rejects(() => decryptOAuthSecret("v1.incompleto", TEST_KEY), {
    message: "Envelope OAuth inválido.",
  });
  await assert.rejects(() => decryptOAuthSecret(envelope.replace(/^v1/u, "v2"), TEST_KEY), {
    message: "Envelope OAuth inválido.",
  });
});

test("rejeita segredo vazio ou acima do limite", async () => {
  await assert.rejects(() => encryptOAuthSecret("", TEST_KEY), {
    message: "Segredo OAuth inválido.",
  });
  await assert.rejects(() => encryptOAuthSecret("x".repeat(8193), TEST_KEY), {
    message: "Segredo OAuth inválido.",
  });
});
