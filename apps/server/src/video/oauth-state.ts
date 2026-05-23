import { randomBytes } from "node:crypto";
import { decrypt, encrypt } from "../lib/crypto";

const STATE_TTL_MS = 10 * 60 * 1000;

export type OAuthState = {
  orgId: string;
  userId: string;
  exp: number;
  nonce: string;
};

export function issueOAuthState(orgId: string, userId: string): string {
  const payload: OAuthState = {
    orgId,
    userId,
    exp: Date.now() + STATE_TTL_MS,
    nonce: randomBytes(12).toString("hex"),
  };
  return encrypt(JSON.stringify(payload)).toString("base64url");
}

export function verifyOAuthState(state: string): OAuthState {
  let blob: Buffer;
  try {
    blob = Buffer.from(state, "base64url");
  } catch {
    throw new Error("invalid state encoding");
  }
  let parsed: OAuthState;
  try {
    parsed = JSON.parse(decrypt(blob)) as OAuthState;
  } catch {
    throw new Error("invalid state payload");
  }
  if (!parsed.orgId || !parsed.userId || typeof parsed.exp !== "number") {
    throw new Error("malformed state");
  }
  if (Date.now() > parsed.exp) {
    throw new Error("state expired");
  }
  return parsed;
}
