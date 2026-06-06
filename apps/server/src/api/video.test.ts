import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { addUserToOrg, signUpAndCreateOrg } from "../../test/helpers/auth";
import { asJson, req } from "../../test/helpers/request";
import { db } from "../db";
import { videoConnections, zoomVideoAccounts } from "../db/schema";
import { upsertZoomConnection } from "../services/video";

const SECRET = "zoom_webhook_test_secret";

function signZoomWebhook(rawBody: string, ts = String(Math.floor(Date.now() / 1000))) {
  const message = `v0:${ts}:${rawBody}`;
  const sig = `v0=${createHmac("sha256", SECRET).update(message).digest("hex")}`;
  return { ts, sig };
}

async function seedZoomConnection(orgId: string) {
  return upsertZoomConnection(orgId, {
    accessToken: "access_token_xyz",
    refreshToken: "refresh_token_xyz",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    scopes: ["meeting:write", "meeting:read"],
    zoomUserId: `zoom_user_${orgId}`,
    zoomAccountId: `zoom_account_${orgId}`,
    email: "host@example.com",
    accountType: "basic",
  });
}

describe("GET /api/video/providers", () => {
  test("401 without session", async () => {
    const res = await req("/api/video/providers");
    expect(res.status).toBe(401);
  });

  test("lists zoom when configured", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/video/providers", {
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(200);
    const body = await asJson<{ providers: string[] }>(res);
    expect(body.providers).toContain("zoom");
  });
});

describe("GET /api/video/connections/zoom", () => {
  test("null when not connected", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/video/connections/zoom", {
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(200);
    const body = await asJson<{ connection: unknown }>(res);
    expect(body.connection).toBeNull();
  });

  test("returns connection after seeding", async () => {
    const fx = await signUpAndCreateOrg();
    await seedZoomConnection(fx.orgId);
    const res = await req("/api/video/connections/zoom", {
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(200);
    const body = await asJson<{
      connection: { provider: string; status: string; email: string | null };
    }>(res);
    expect(body.connection.provider).toBe("zoom");
    expect(body.connection.status).toBe("active");
    expect(body.connection.email).toBe("host@example.com");
  });
});

describe("POST /api/video/connect/zoom", () => {
  test("403 for non-admin", async () => {
    const fx = await signUpAndCreateOrg();
    const viewer = await addUserToOrg(fx.orgId, "viewer");
    const res = await req("/api/video/connect/zoom", {
      method: "POST",
      cookie: viewer.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(403);
  });

  test("admin gets Zoom authorize URL", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/video/connect/zoom", {
      method: "POST",
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(200);
    const body = await asJson<{ url: string }>(res);
    const url = new URL(body.url);
    expect(url.origin + url.pathname).toBe("https://zoom.us/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("zoom_client_test");
    expect(url.searchParams.get("state")).toBeTruthy();
  });
});

describe("DELETE /api/video/connections/zoom", () => {
  test("404 when nothing to delete", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/video/connections/zoom", {
      method: "DELETE",
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(404);
  });

  test("204-ish deleted true and rows gone", async () => {
    const fx = await signUpAndCreateOrg();
    await seedZoomConnection(fx.orgId);
    const res = await req("/api/video/connections/zoom", {
      method: "DELETE",
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(200);
    const body = await asJson<{ deleted: boolean }>(res);
    expect(body.deleted).toBe(true);

    const remaining = await db
      .select()
      .from(videoConnections)
      .where(eq(videoConnections.orgId, fx.orgId));
    expect(remaining).toHaveLength(0);
  });
});

describe("POST /api/video/webhooks/zoom", () => {
  test("url_validation returns encryptedToken", async () => {
    const body = JSON.stringify({
      event: "endpoint.url_validation",
      payload: { plainToken: "challenge-xyz" },
    });
    const res = await req("/api/video/webhooks/zoom", {
      method: "POST",
      body,
    });
    expect(res.status).toBe(200);
    const json = await asJson<{ plainToken: string; encryptedToken: string }>(res);
    const expected = createHmac("sha256", SECRET).update("challenge-xyz").digest("hex");
    expect(json.plainToken).toBe("challenge-xyz");
    expect(json.encryptedToken).toBe(expected);
  });

  test("rejects bad signature", async () => {
    const body = JSON.stringify({
      event: "app_deauthorized",
      payload: { user_id: "u", account_id: "a" },
    });
    const res = await req("/api/video/webhooks/zoom", {
      method: "POST",
      body,
      headers: {
        "x-zm-signature": "v0=deadbeef",
        "x-zm-request-timestamp": String(Math.floor(Date.now() / 1000)),
      },
    });
    expect(res.status).toBe(400);
  });

  test("app_deauthorized clears stored connection", async () => {
    const fx = await signUpAndCreateOrg();
    const conn = await seedZoomConnection(fx.orgId);
    expect(conn.status).toBe("active");

    const accountRows = await db
      .select()
      .from(zoomVideoAccounts)
      .where(eq(zoomVideoAccounts.connectionId, conn.id));
    const zoomUserId = accountRows[0]?.zoomUserId;
    expect(zoomUserId).toBeTruthy();

    const body = JSON.stringify({
      event: "app_deauthorized",
      payload: { user_id: zoomUserId, account_id: "any" },
    });
    const { ts, sig } = signZoomWebhook(body);
    const res = await req("/api/video/webhooks/zoom", {
      method: "POST",
      body,
      headers: { "x-zm-signature": sig, "x-zm-request-timestamp": ts },
    });
    expect(res.status).toBe(200);

    const remaining = await db
      .select()
      .from(videoConnections)
      .where(eq(videoConnections.orgId, fx.orgId));
    expect(remaining).toHaveLength(0);
  });
});

describe("Zoom webhook dedupe", () => {
  test("duplicate meeting.ended skipped", async () => {
    const fx = await signUpAndCreateOrg();
    await seedZoomConnection(fx.orgId);

    const body = JSON.stringify({
      event: "meeting.ended",
      event_ts: 1234567890,
      payload: {
        object: {
          id: 99,
          uuid: "uuid-dedupe-test",
          host_id: "h",
          end_time: "2026-05-22T10:00:00Z",
        },
      },
    });
    const { ts, sig } = signZoomWebhook(body);
    const first = await req("/api/video/webhooks/zoom", {
      method: "POST",
      body,
      headers: { "x-zm-signature": sig, "x-zm-request-timestamp": ts },
    });
    expect(first.status).toBe(200);
    const firstJson = await asJson<{ duplicate?: boolean }>(first);
    expect(firstJson.duplicate).toBeUndefined();

    const second = await req("/api/video/webhooks/zoom", {
      method: "POST",
      body,
      headers: { "x-zm-signature": sig, "x-zm-request-timestamp": ts },
    });
    expect(second.status).toBe(200);
    const secondJson = await asJson<{ duplicate?: boolean }>(second);
    expect(secondJson.duplicate).toBe(true);
  });
});

describe("meeting.deleted webhook", () => {
  test("drops event_video row", async () => {
    const fx = await signUpAndCreateOrg();
    const conn = await seedZoomConnection(fx.orgId);

    // seed event_video row directly
    const { events, eventVideo } = await import("../db/schema");
    const eventRows = await db
      .insert(events)
      .values({
        orgId: fx.orgId,
        title: "Test",
        date: "2026-06-01",
        time: "10:00:00",
        duration: 60,
      })
      .returning({ id: events.id });
    const eventId = eventRows[0]!.id;
    await db.insert(eventVideo).values({
      orgId: fx.orgId,
      eventId,
      provider: "zoom",
      connectionId: conn.id,
      externalMeetingId: "777777",
      externalMeetingUuid: "uuid-del-test",
      joinUrl: "https://zoom.us/j/777777",
    });

    const body = JSON.stringify({
      event: "meeting.deleted",
      event_ts: 1234567891,
      payload: { object: { id: 777777, uuid: "uuid-del-test" } },
    });
    const { ts, sig } = signZoomWebhook(body);
    const res = await req("/api/video/webhooks/zoom", {
      method: "POST",
      body,
      headers: { "x-zm-signature": sig, "x-zm-request-timestamp": ts },
    });
    expect(res.status).toBe(200);

    const remaining = await db.select().from(eventVideo).where(eq(eventVideo.eventId, eventId));
    expect(remaining).toHaveLength(0);
  });
});

describe("POST /api/events/:id/registrations/import", () => {
  test("401 without session", async () => {
    const res = await req("/api/events/x/registrations/import", {
      method: "POST",
      body: { rows: [] },
    });
    expect(res.status).toBe(401);
  });

  test("404 event missing", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/events/nonexistent/registrations/import", {
      method: "POST",
      body: { rows: [{ name: "A", email: "a@example.com" }] },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(404);
  });

  test("happy path creates registrations + reports counts", async () => {
    const fx = await signUpAndCreateOrg();
    const created = await req("/api/events", {
      method: "POST",
      body: {
        title: "Workshop",
        date: "2026-06-15",
        time: "10:00:00",
        duration: 60,
        videoProvider: null,
      },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    const evBody = await asJson<{ event: { id: string } }>(created);

    const res = await req(`/api/events/${evBody.event.id}/registrations/import`, {
      method: "POST",
      body: {
        rows: [
          { name: "Alice", email: "alice@example.com" },
          { name: "Bob", email: "bob@example.com" },
          { name: "", email: "no-name@example.com" },
          { name: "Bad", email: "not-an-email" },
        ],
      },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(200);
    const json = await asJson<{
      total: number;
      created: number;
      failed: number;
      errors: Array<{ row: number }>;
    }>(res);
    expect(json.total).toBe(4);
    expect(json.created).toBe(2);
    expect(json.failed).toBe(2);
    expect(json.errors).toHaveLength(2);
  });
});

describe("GET /api/video/events/:id/attendance", () => {
  test("401 without session", async () => {
    const res = await req("/api/video/events/some-id/attendance");
    expect(res.status).toBe(401);
  });

  test("returns empty list when no registrations", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/video/events/event-xyz/attendance", {
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(200);
    const body = await asJson<{ attendance: unknown[] }>(res);
    expect(body.attendance).toEqual([]);
  });

  test("403 for viewer", async () => {
    const fx = await signUpAndCreateOrg();
    const viewer = await addUserToOrg(fx.orgId, "viewer");
    const res = await req("/api/video/events/x/attendance", {
      cookie: viewer.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(403);
  });
});

describe("GET /api/video/callback/zoom", () => {
  test("400 missing code/state", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/video/callback/zoom", { cookie: fx.cookie });
    expect(res.status).toBe(400);
  });

  test("400 invalid state", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/video/callback/zoom?code=abc&state=bogus", {
      cookie: fx.cookie,
    });
    expect(res.status).toBe(400);
  });
});
