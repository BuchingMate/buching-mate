import { Hono } from "hono";
import type { PublicRegistrationRequest } from "@workspace/contracts";
import { apiError } from "./errors";
import { isRecord, readJson, stringOrNull } from "./validation";
import { logEvent } from "../observability/events";
import { enrichLogger, getLogger } from "../observability/request-context";
import { attendeeAuth } from "../auth/attendee";
import { requireAttendee } from "../middleware/auth";
import {
  cancelOwnRegistration,
  getPublicEvent,
  getPublicOrg,
  listMyRegistrations,
  listPublicEvents,
  registerForPublicEvent,
} from "../services/public";
import { createCheckoutForRegistration } from "../services/payments/checkout";
import { verifyResumeToken } from "../services/payments/resume-token";
import { db } from "../db";
import { registrations, organization, events as eventsTable } from "../db/schema";
import { and, eq } from "drizzle-orm";

function parsePublicRegistration(input: unknown): PublicRegistrationRequest | string {
  if (!isRecord(input)) return "Request body must be an object";
  if (typeof input.name !== "string" || input.name.trim().length === 0) return "Name is required";
  if (typeof input.email !== "string" || input.email.trim().length === 0)
    return "Email is required";
  const phone = stringOrNull(input.phone);
  if (phone === undefined) return "Phone must be a string or null";
  return { name: input.name.trim(), email: input.email.trim().toLowerCase(), phone };
}

export const publicRoutes = new Hono()
  .on(["POST", "GET"], "/auth/*", (c) => attendeeAuth.handler(c.req.raw))
  .get("/me/registrations", requireAttendee, async (c) => {
    const rows = await listMyRegistrations(c.var.attendeeUser.email);
    return c.json({ registrations: rows });
  })
  .post("/me/registrations/:id/cancel", requireAttendee, async (c) => {
    const result = await cancelOwnRegistration(c.var.attendeeUser.email, c.req.param("id"));
    if (result === "not_found") return apiError(c, 404, "not_found", "Registration not found");
    if (result === "forbidden") return apiError(c, 403, "forbidden", "Not your registration");
    return c.json({ registration: result });
  })
  .use("/orgs/:slug/*", async (c, next) => {
    enrichLogger({ orgSlug: c.req.param("slug"), source: "public" });
    await next();
  })
  .use("/orgs/:slug", async (c, next) => {
    enrichLogger({ orgSlug: c.req.param("slug"), source: "public" });
    await next();
  })
  .get("/orgs/:slug", async (c) => {
    const org = await getPublicOrg(c.req.param("slug"));
    if (!org) {
      getLogger().warn("tenant.notFound");
      return apiError(c, 404, "org_not_found", "Organization not found");
    }
    enrichLogger({ orgId: org.org.id });
    return c.json(org);
  })
  .get("/orgs/:slug/events", async (c) => {
    const events = await listPublicEvents(c.req.param("slug"));
    if (!events) {
      getLogger().warn("tenant.notFound");
      return apiError(c, 404, "org_not_found", "Organization not found");
    }
    return c.json({ events });
  })
  .get("/orgs/:slug/events/:eventId", async (c) => {
    const eventId = c.req.param("eventId");
    enrichLogger({ eventId });
    const event = await getPublicEvent(c.req.param("slug"), eventId);
    if (!event) return apiError(c, 404, "event_not_found", "Event not found");
    return c.json({ event });
  })
  .post("/orgs/:slug/events/:eventId/register", async (c) => {
    const eventId = c.req.param("eventId");
    enrichLogger({ eventId });
    const input = parsePublicRegistration(await readJson(c));
    if (typeof input === "string") return apiError(c, 400, "invalid_registration", input);

    const reqUrl = new URL(c.req.url);
    const publicOrigin = `${reqUrl.protocol}//${reqUrl.host}`;
    const attendeeSession = await attendeeAuth.api
      .getSession({ headers: c.req.raw.headers })
      .catch(() => null);
    const attendeeUserId = attendeeSession?.user.id ?? null;
    const outcome = await registerForPublicEvent(
      c.req.param("slug"),
      eventId,
      input,
      publicOrigin,
      attendeeUserId,
    );
    if (outcome === "org_not_found") {
      getLogger().warn("tenant.notFound");
      return apiError(c, 404, "org_not_found", "Organization not found");
    }
    if (outcome === "event_not_found")
      return apiError(c, 404, "event_not_found", "Event not found");
    if (outcome === "attendee_not_found")
      return apiError(c, 404, "attendee_not_found", "Attendee not found");
    if (outcome === "duplicate_registration") {
      logEvent("registration.duplicate", { eventId });
      return apiError(
        c,
        409,
        "duplicate_registration",
        "You are already registered for this event",
      );
    }

    if (outcome.type === "resume") {
      logEvent("registration.resume", {
        registrationId: outcome.registration.id,
        eventId,
      });
      return c.json({ registration: outcome.registration, resume: true }, 200);
    }

    logEvent("registration.created", {
      registrationId: outcome.registration.id,
      eventId,
    });
    return c.json({ registration: outcome.registration }, 201);
  })
  .post("/orgs/:slug/events/:eventId/checkout", async (c) => {
    enrichLogger({ eventId: c.req.param("eventId") });
    const body = (await readJson(c)) as Record<string, unknown> | null;
    if (!isRecord(body)) {
      return apiError(c, 400, "invalid_checkout", "Body must be an object");
    }
    if (typeof body.registrationId !== "string" || body.registrationId.length === 0) {
      return apiError(c, 400, "invalid_checkout", "registrationId is required");
    }
    if (typeof body.successUrl !== "string" || typeof body.cancelUrl !== "string") {
      return apiError(c, 400, "invalid_checkout", "successUrl and cancelUrl are required");
    }
    const preferred = typeof body.provider === "string" ? body.provider : undefined;

    const result = await createCheckoutForRegistration({
      registrationId: body.registrationId,
      orgSlug: c.req.param("slug"),
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
      preferredProvider: preferred,
    });

    if (result.type === "error") {
      const status = result.code === "registration_not_found" ? 404 : 400;
      return apiError(c, status, result.code, result.message);
    }

    logEvent("payment.checkout.created", {
      registrationId: body.registrationId,
      sessionId: result.sessionId,
    });
    return c.json({ url: result.url, sessionId: result.sessionId });
  })
  .post("/orgs/:slug/events/:eventId/resume", async (c) => {
    const slug = c.req.param("slug");
    const eventId = c.req.param("eventId");
    enrichLogger({ eventId });

    const body = (await readJson(c)) as Record<string, unknown> | null;
    if (!isRecord(body) || typeof body.token !== "string" || body.token.length === 0) {
      return apiError(c, 400, "invalid_resume", "token is required");
    }

    let payload;
    try {
      payload = verifyResumeToken(body.token);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "invalid token";
      return apiError(c, 400, "invalid_resume_token", msg);
    }

    if (payload.eventId !== eventId || payload.orgSlug !== slug) {
      return apiError(c, 400, "invalid_resume_token", "token does not match event");
    }

    const orgRows = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, slug))
      .limit(1);
    if (!orgRows[0]) return apiError(c, 404, "org_not_found", "Organization not found");

    const regRows = await db
      .select()
      .from(registrations)
      .where(
        and(eq(registrations.id, payload.registrationId), eq(registrations.orgId, orgRows[0].id)),
      )
      .limit(1);
    const reg = regRows[0];
    if (!reg) return apiError(c, 404, "registration_not_found", "Registration not found");

    if (reg.paymentStatus === "paid" || reg.status === "confirmed") {
      return c.json({ paid: true });
    }
    if (reg.status === "cancelled" || reg.paymentStatus === "expired") {
      return c.json({ expired: true });
    }

    const eventRows = await db
      .select({ id: eventsTable.id })
      .from(eventsTable)
      .where(eq(eventsTable.id, eventId))
      .limit(1);
    if (!eventRows[0]) return apiError(c, 404, "event_not_found", "Event not found");

    const reqUrl = new URL(c.req.url);
    const origin = `${reqUrl.protocol}//${reqUrl.host}`;
    const result = await createCheckoutForRegistration({
      registrationId: reg.id,
      orgSlug: slug,
      successUrl: `${origin}/events/${eventId}/return?status=success&rid=${reg.id}`,
      cancelUrl: `${origin}/events/${eventId}/return?status=cancel&rid=${reg.id}`,
    });

    if (result.type === "error") {
      const status = result.code === "registration_not_found" ? 404 : 400;
      return apiError(c, status, result.code, result.message);
    }

    logEvent("payment.checkout.resumed", {
      registrationId: reg.id,
      sessionId: result.sessionId,
    });
    return c.json({ url: result.url, sessionId: result.sessionId });
  });
