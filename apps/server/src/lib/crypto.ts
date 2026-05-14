import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function loadKey(): Buffer {
  const raw = Bun.env.PAYMENT_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("PAYMENT_ENCRYPTION_KEY not set");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("PAYMENT_ENCRYPTION_KEY must decode to 32 bytes (base64)");
  }
  return key;
}

// Layout: [iv(12) | tag(16) | ciphertext]
export function encrypt(plaintext: string): Buffer {
  const key = loadKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]);
}

export function decrypt(blob: Buffer): string {
  const key = loadKey();
  if (blob.length < IV_LEN + TAG_LEN) {
    throw new Error("ciphertext too short");
  }
  const iv = blob.subarray(0, IV_LEN);
  const tag = blob.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = blob.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export function generateKeyBase64(): string {
  return randomBytes(32).toString("base64");
}
