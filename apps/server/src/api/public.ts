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
  getGlobalPublicEvent,
  getJoinForMyRegistration,
  getPublicEvent,
  getPublicOrg,
  listAllPublicEvents,
  listMyRegistrations,
  listPublicEvents,
  registerForPublicEvent,
} from "../services/public";
import { publicOriginForOrg } from "../services/domains";
import { createCheckoutForRegistration } from "../services/payments/checkout";
import { verifyResumeToken } from "../services/payments/resume-token";
import { verifyCalendarToken } from "../lib/calendar-token";
import { subscribeToCalendar, unsubscribeFromCalendar } from "../services/calendar";
import { resolveOrgByHostname } from "../services/domains";
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
  return {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone,
    subscribeToCalendar: input.subscribeToCalendar === true,
  };
}

// Minimal standalone confirmation page for the subscribe/unsubscribe links. No
// app shell — it's reached straight from an email, often without a session.
function calendarPage(message: string): string {
  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>Unsubscribe</title></head>
  <body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f6f7f9;color:#0f172a;">
    <div style="max-width:420px;margin:80px auto;padding:32px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;text-align:center;">
      <p style="margin:0;font-size:15px;line-height:1.6;color:#475569;">${message}</p>
    </div>
  </body>
</html>`;
}

export const publicRoutes = new Hono()
  .on(["POST", "GET"], "/auth/*", (c) => attendeeAuth.handler(c.req.raw))
  // Which org (if any) serves its public pages on this hostname. Used by the
  // web app's SSR loaders to route custom domains; cacheable since domain
  // activation is rare.
  .get("/domains/resolve", async (c) => {
    const raw = c.req.query("host");
    if (!raw) return apiError(c, 400, "invalid_host", "host query parameter is required");
    const hostname = raw.trim().toLowerCase().split(":")[0];
    const resolved = await resolveOrgByHostname(hostname);
    c.header("Cache-Control", "public, max-age=300");
    return c.json({ slug: resolved?.slug ?? null });
  })
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
  .get("/me/registrations/:id/join", requireAttendee, async (c) => {
    const result = await getJoinForMyRegistration(c.var.attendeeUser.email, c.req.param("id"));
    if (result === "not_found") return apiError(c, 404, "not_found", "No video meeting found");
    if (result === "forbidden") return apiError(c, 403, "forbidden", "Not your registration");
    if (result === "not_ready")
      return apiError(c, 409, "not_ready", "Registration not yet confirmed");
    return c.json(result);
  })
  // Cross-org feed for the main-domain /events page.
  .get("/events", async (c) => {
    const events = await listAllPublicEvents();
    return c.json({ events });
  })
  // Event by id alone — lets main-domain event links work without an org slug.
  .get("/events/:eventId", async (c) => {
    const eventId = c.req.param("eventId");
    enrichLogger({ eventId, source: "public" });
    const result = await getGlobalPublicEvent(eventId);
    if (!result) return apiError(c, 404, "event_not_found", "Event not found");
    return c.json(result);
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
  // Standalone Calendar opt-in from the org's public events page, for someone
  // who isn't booking right now.
  .post("/orgs/:slug/calendar/subscribe", async (c) => {
    const body = (await readJson(c)) as Record<string, unknown> | null;
    if (!isRecord(body) || typeof body.email !== "string" || !body.email.trim()) {
      return apiError(c, 400, "invalid_subscribe", "Email is required");
    }
    const org = await getPublicOrg(c.req.param("slug"));
    if (!org) return apiError(c, 404, "org_not_found", "Organization not found");
    await subscribeToCalendar({
      orgId: org.org.id,
      email: body.email.trim().toLowerCase(),
      source: "org_page",
    });
    return c.json({ subscribed: true });
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

    const attendeeSession = await attendeeAuth.api
      .getSession({ headers: c.req.raw.headers })
      .catch(() => null);
    const attendeeUserId = attendeeSession?.user.id ?? null;
    const outcome = await registerForPublicEvent(
      c.req.param("slug"),
      eventId,
      input,
      attendeeUserId,
    );
    if (outcome === "org_not_found") {
      getLogger().warn("tenant.notFound");
      return apiError(c, 404, "org_not_found", "Organization not found");
    }
    if (outcome === "event_not_found")
      return apiError(c, 404, "event_not_found", "Event not found");
    // Unreachable through the public page (cancelled events aren't public),
    // but the service can still answer it on a race.
    if (outcome === "event_not_bookable")
      return apiError(c, 409, "event_not_bookable", "This event is no longer taking registrations");
    if (outcome === "event_full") return apiError(c, 409, "event_full", "This event is full");
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
  // One-click unsubscribe target for marketing email. Mail clients POST here
  // (RFC 8058, List-Unsubscribe-Post); humans who click the footer link GET it.
  // Both carry the signed token in the query and leave the org's Calendar.
  .post("/unsubscribe", async (c) => {
    const token = new URL(c.req.url).searchParams.get("token");
    if (!token) return apiError(c, 400, "invalid_unsubscribe", "Missing token");
    try {
      const { orgId, email } = verifyCalendarToken(token);
      await unsubscribeFromCalendar({ orgId, email });
    } catch {
      return apiError(c, 400, "invalid_unsubscribe", "Invalid or malformed unsubscribe link");
    }
    return c.body(null, 204);
  })
  .get("/unsubscribe", async (c) => {
    const token = c.req.query("token");
    if (!token) {
      return c.html(calendarPage("This unsubscribe link is missing its token."), 400);
    }
    try {
      const { orgId, email } = verifyCalendarToken(token);
      await unsubscribeFromCalendar({ orgId, email });
    } catch {
      return c.html(calendarPage("This unsubscribe link is invalid or has expired."), 400);
    }
    return c.html(
      calendarPage("You've left this Calendar. You won't receive any more of its emails."),
    );
  })
  // One-click subscribe target for the "Subscribe to Calendar" link in the
  // confirmation email. Same signed token as unsubscribe; the route is the
  // action. GET only, since it's a plain link a human clicks.
  .get("/calendar/subscribe", async (c) => {
    const token = c.req.query("token");
    if (!token) {
      return c.html(calendarPage("This subscribe link is missing its token."), 400);
    }
    try {
      const { orgId, email } = verifyCalendarToken(token);
      await subscribeToCalendar({ orgId, email, source: "email_link" });
    } catch {
      return c.html(calendarPage("This subscribe link is invalid or has expired."), 400);
    }
    return c.html(
      calendarPage("You're subscribed. You'll hear about this organizer's upcoming events."),
    );
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

    const origin = await publicOriginForOrg(orgRows[0].id);
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
