import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isPaymentProvider, type PaymentProvider } from "@workspace/contracts";

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

type StatePayload = {
  orgId: string;
  userId: string;
  provider: PaymentProvider;
  nonce: string;
  expiresAt: number;
};

function secret(): string {
  const value = Bun.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error("BETTER_AUTH_SECRET required for OAuth state signing");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createOAuthState(input: {
  orgId: string;
  userId: string;
  provider: PaymentProvider;
}): string {
  const payload: StatePayload = {
    orgId: input.orgId,
    userId: input.userId,
    provider: input.provider,
    nonce: randomBytes(12).toString("base64url"),
    expiresAt: Date.now() + STATE_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function verifyOAuthState(token: string): StatePayload {
  const [encoded, providedSig] = token.split(".");
  if (!encoded || !providedSig) {
    throw new Error("malformed state");
  }
  const expected = sign(encoded);
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("invalid state signature");
  }
  let payload: StatePayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as StatePayload;
  } catch {
    throw new Error("malformed state payload");
  }
  if (typeof payload.expiresAt !== "number" || payload.expiresAt < Date.now()) {
    throw new Error("expired state");
  }
  if (!isPaymentProvider(payload.provider)) {
    throw new Error("invalid provider in state");
  }
  return payload;
}
