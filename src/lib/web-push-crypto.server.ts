import {
  createECDH,
  createCipheriv,
  createHmac,
  createPrivateKey,
  randomBytes,
  sign as cryptoSign,
} from "node:crypto";

// Implementação própria do Web Push (VAPID — RFC 8292 — e criptografia de
// mensagem aes128gcm — RFC 8291/8188), sem depender do pacote `web-push`.
// Este ambiente de desenvolvimento não tem acesso ao registry privado do
// projeto para instalar dependências novas; Node já traz tudo que essas
// RFCs exigem (ECDH P-256, HKDF via HMAC-SHA256, AES-128-GCM).

export function base64url(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
}

export function fromBase64url(str: string): Buffer {
  const normalized = str.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64");
}

function hkdfExtract(salt: Buffer, ikm: Buffer): Buffer {
  return createHmac("sha256", salt).update(ikm).digest();
}

// As mensagens Web Push nunca precisam de mais de 32 bytes de material
// derivado nesta implementação, então um único bloco HKDF (T(1)) é suficiente.
function hkdfExpand(prk: Buffer, info: Buffer, length: number): Buffer {
  const t1 = createHmac("sha256", prk).update(Buffer.concat([info, Buffer.from([0x01])])).digest();
  if (length > t1.length) throw new Error("HKDF expand length não suportado nesta implementação.");
  return t1.subarray(0, length);
}

export type VapidKeys = Readonly<{
  publicKeyBase64Url: string;
  privateKeyBase64Url: string;
}>;

// DER helpers para montar um PKCS8 EC de P-256 a partir dos bytes crus da
// chave (RFC 5915 embrulhado em PKCS8, RFC 5958). Evitamos createPrivateKey
// com format "jwk" de propósito: em produção esse formato falhou com
// "options.key property must be of type string..." — sinal de um runtime
// cujo node:crypto não reconhece objeto JWK como entrada válida. DER/PKCS8
// é a forma mais básica e amplamente suportada de importar uma chave EC.
function derLength(len: number): Buffer {
  if (len < 0x80) return Buffer.from([len]);
  if (len < 0x100) return Buffer.from([0x81, len]);
  return Buffer.from([0x82, (len >> 8) & 0xff, len & 0xff]);
}

function derTlv(tag: number, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), derLength(content.length), content]);
}

const OID_EC_PUBLIC_KEY = Buffer.from([0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01]);
const OID_PRIME256V1 = Buffer.from([0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07]);

function pkcs8FromRawEcP256(privateKeyRaw: Buffer, publicKeyRaw: Buffer): Buffer {
  // ECPrivateKey ::= SEQUENCE { version 1, privateKey OCTET STRING,
  //                             [1] EXPLICIT publicKey BIT STRING }  -- RFC 5915
  const publicKeyBitString = derTlv(0x03, Buffer.concat([Buffer.from([0x00]), publicKeyRaw]));
  const explicitPublicKey = derTlv(0xa1, publicKeyBitString);
  const ecPrivateKey = derTlv(
    0x30,
    Buffer.concat([
      Buffer.from([0x02, 0x01, 0x01]), // version = 1
      derTlv(0x04, privateKeyRaw),
      explicitPublicKey,
    ]),
  );

  // PrivateKeyInfo ::= SEQUENCE { version 0, algorithm AlgorithmIdentifier,
  //                               privateKey OCTET STRING }  -- PKCS8 / RFC 5958
  const algorithmIdentifier = derTlv(0x30, Buffer.concat([OID_EC_PUBLIC_KEY, OID_PRIME256V1]));
  return derTlv(
    0x30,
    Buffer.concat([
      Buffer.from([0x02, 0x01, 0x00]), // version = 0
      algorithmIdentifier,
      derTlv(0x04, ecPrivateKey),
    ]),
  );
}

function vapidPrivateKeyObject(privateKeyBase64Url: string, publicKeyRaw: Buffer) {
  const privateKeyRaw = fromBase64url(privateKeyBase64Url);
  if (privateKeyRaw.length !== 32) {
    throw new Error("VAPID_PRIVATE_KEY inválida: esperado escalar de 32 bytes.");
  }
  return createPrivateKey({
    key: pkcs8FromRawEcP256(privateKeyRaw, publicKeyRaw),
    format: "der",
    type: "pkcs8",
  });
}

// Gera o cabeçalho Authorization (VAPID, RFC 8292) para uma notificação
// destinada a um endpoint específico. audience é sempre a origem do endpoint
// (ex.: https://fcm.googleapis.com), nunca a URL completa.
export function generateVapidAuthorizationHeader(input: {
  audience: string;
  subject: string;
  vapidPublicKeyBase64Url: string;
  vapidPrivateKeyBase64Url: string;
  expirationSeconds?: number;
  now?: () => number;
}): string {
  const now = input.now ?? Date.now;
  const publicKeyRaw = fromBase64url(input.vapidPublicKeyBase64Url);
  if (publicKeyRaw.length !== 65 || publicKeyRaw[0] !== 0x04) {
    throw new Error("VAPID_PUBLIC_KEY inválida: esperado ponto EC não comprimido de 65 bytes.");
  }

  const header = base64url(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" }), "utf8"));
  const claims = base64url(
    Buffer.from(
      JSON.stringify({
        aud: input.audience,
        // Limite recomendado pela RFC 8292: no máximo 24h de validade.
        exp: Math.floor(now() / 1000) + (input.expirationSeconds ?? 12 * 3600),
        sub: input.subject,
      }),
      "utf8",
    ),
  );
  const signingInput = `${header}.${claims}`;

  const privateKey = vapidPrivateKeyObject(input.vapidPrivateKeyBase64Url, publicKeyRaw);
  // JWT/JOSE usa a assinatura ECDSA "raw" (r || s, 64 bytes para P-256), não a
  // codificação DER que node:crypto produz por padrão — dsaEncoding pede o formato certo.
  const signature = cryptoSign("sha256", Buffer.from(signingInput, "utf8"), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  });

  const jwt = `${signingInput}.${base64url(signature)}`;
  return `vapid t=${jwt}, k=${input.vapidPublicKeyBase64Url}`;
}

// Criptografa o payload de uma notificação Web Push segundo RFC 8291
// (aes128gcm), usando a chave pública (p256dh) e o segredo de autenticação
// (auth) da inscrição do navegador. O corpo retornado já inclui o cabeçalho
// de registro (salt + rs + keyid) exigido pela RFC 8188 — não usa os
// cabeçalhos HTTP Crypto-Key/Encryption do esquema aesgcm (obsoleto).
export function encryptWebPushPayload(input: {
  payload: string;
  p256dhBase64Url: string;
  authBase64Url: string;
}): Buffer {
  const uaPublicRaw = fromBase64url(input.p256dhBase64Url);
  if (uaPublicRaw.length !== 65 || uaPublicRaw[0] !== 0x04) {
    throw new Error("p256dh inválida: esperado ponto EC não comprimido de 65 bytes.");
  }
  const authSecret = fromBase64url(input.authBase64Url);
  if (authSecret.length !== 16) {
    throw new Error("auth inválido: esperado segredo de 16 bytes.");
  }

  const localEcdh = createECDH("prime256v1");
  localEcdh.generateKeys();
  const localPublicRaw = localEcdh.getPublicKey(undefined, "uncompressed");
  const ecdhSecret = localEcdh.computeSecret(uaPublicRaw);

  const prkKey = hkdfExtract(authSecret, ecdhSecret);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0", "utf8"), uaPublicRaw, localPublicRaw]);
  const ikm = hkdfExpand(prkKey, keyInfo, 32);

  const salt = randomBytes(16);
  const prk = hkdfExtract(salt, ikm);
  const cek = hkdfExpand(prk, Buffer.from("Content-Encoding: aes128gcm\0", "utf8"), 16);
  const nonce = hkdfExpand(prk, Buffer.from("Content-Encoding: nonce\0", "utf8"), 12);

  // Delimitador de padding 0x02: registro único, sem registros adicionais.
  const padded = Buffer.concat([Buffer.from(input.payload, "utf8"), Buffer.from([0x02])]);
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(padded), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096, 0);
  const recordHeader = Buffer.concat([
    salt,
    recordSize,
    Buffer.from([localPublicRaw.length]),
    localPublicRaw,
  ]);

  return Buffer.concat([recordHeader, ciphertext, authTag]);
}
