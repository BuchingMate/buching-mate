import { createHmac, timingSafeEqual } from "node:crypto";

// Signed token carried in Calendar subscribe/unsubscribe links. It identifies
// the org + email so a public endpoint can act without a session. The same
// token works for both the subscribe link (in the confirmation email) and the
// unsubscribe link (in marketing email) — the route decides which action to
// take. It never expires: an unsubscribe link must keep working for the life of
// the email (CAN-SPAM).

type CalendarTokenPayload = {
  orgId: string;
  email: string;
};

function secret(): string {
  const value = Bun.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error("BETTER_AUTH_SECRET required for calendar token signing");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createCalendarToken(input: { orgId: string; email: string }): string {
  const payload: CalendarTokenPayload = { orgId: input.orgId, email: input.email.toLowerCase() };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyCalendarToken(token: string): CalendarTokenPayload {
  const [encoded, providedSig] = token.split(".");
  if (!encoded || !providedSig) throw new Error("malformed calendar token");

  const expected = sign(encoded);
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("invalid calendar token signature");
  }

  let payload: CalendarTokenPayload;
  try {
    payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as CalendarTokenPayload;
  } catch {
    throw new Error("malformed calendar token payload");
  }
  if (typeof payload.orgId !== "string" || typeof payload.email !== "string") {
    throw new Error("invalid calendar token payload");
  }
  return payload;
}
