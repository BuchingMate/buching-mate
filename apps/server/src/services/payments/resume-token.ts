import { createHmac, timingSafeEqual } from "node:crypto";

const RESUME_TTL_MS = 31 * 60 * 1000;

type ResumePayload = {
  registrationId: string;
  eventId: string;
  orgSlug: string;
  expiresAt: number;
};

function secret(): string {
  const value = Bun.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error("BETTER_AUTH_SECRET required for resume token signing");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createResumeToken(input: {
  registrationId: string;
  eventId: string;
  orgSlug: string;
}): string {
  const payload: ResumePayload = {
    registrationId: input.registrationId,
    eventId: input.eventId,
    orgSlug: input.orgSlug,
    expiresAt: Date.now() + RESUME_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyResumeToken(token: string): ResumePayload {
  const [encoded, providedSig] = token.split(".");
  if (!encoded || !providedSig) throw new Error("malformed resume token");

  const expected = sign(encoded);
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("invalid resume token signature");
  }

  let payload: ResumePayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ResumePayload;
  } catch {
    throw new Error("malformed resume token payload");
  }
  if (typeof payload.expiresAt !== "number" || payload.expiresAt < Date.now()) {
    throw new Error("expired resume token");
  }
  if (
    typeof payload.registrationId !== "string" ||
    typeof payload.eventId !== "string" ||
    typeof payload.orgSlug !== "string"
  ) {
    throw new Error("invalid resume token payload");
  }
  return payload;
}
