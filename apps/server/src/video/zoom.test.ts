import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { VideoInvalidSignatureError } from "./adapter";
import { createZoomAdapter } from "./zoom";

const SECRET = "zoom_webhook_test_secret";

function signBody(ts: string, rawBody: string): string {
  const message = `v0:${ts}:${rawBody}`;
  return `v0=${createHmac("sha256", SECRET).update(message).digest("hex")}`;
}

describe("ZoomAdapter.computeUrlValidationResponse", () => {
  test("returns hmac-sha256 of plain token", () => {
    const adapter = createZoomAdapter();
    const out = adapter.computeUrlValidationResponse("abc123");
    expect(out.plainToken).toBe("abc123");
    const expected = createHmac("sha256", SECRET).update("abc123").digest("hex");
    expect(out.encryptedToken).toBe(expected);
  });
});

describe("ZoomAdapter.verifyAndParseWebhook", () => {
  test("url_validation event short-circuits signature check", async () => {
    const adapter = createZoomAdapter();
    const body = JSON.stringify({
      event: "endpoint.url_validation",
      payload: { plainToken: "tok" },
    });
    const out = await adapter.verifyAndParseWebhook({}, body);
    expect(out).toEqual({ type: "endpoint.url_validation", plainToken: "tok" });
  });

  test("rejects missing signature headers", async () => {
    const adapter = createZoomAdapter();
    const body = JSON.stringify({ event: "app_deauthorized", payload: {} });
    await expect(adapter.verifyAndParseWebhook({}, body)).rejects.toBeInstanceOf(
      VideoInvalidSignatureError,
    );
  });

  test("rejects stale timestamp", async () => {
    const adapter = createZoomAdapter();
    const body = JSON.stringify({ event: "app_deauthorized", payload: {} });
    const stale = String(Math.floor(Date.now() / 1000) - 60 * 60);
    const sig = signBody(stale, body);
    await expect(
      adapter.verifyAndParseWebhook(
        { "x-zm-signature": sig, "x-zm-request-timestamp": stale },
        body,
      ),
    ).rejects.toBeInstanceOf(VideoInvalidSignatureError);
  });

  test("rejects tampered signature", async () => {
    const adapter = createZoomAdapter();
    const body = JSON.stringify({ event: "app_deauthorized", payload: {} });
    const ts = String(Math.floor(Date.now() / 1000));
    await expect(
      adapter.verifyAndParseWebhook(
        { "x-zm-signature": "v0=deadbeef", "x-zm-request-timestamp": ts },
        body,
      ),
    ).rejects.toBeInstanceOf(VideoInvalidSignatureError);
  });

  test("accepts valid app_deauthorized signature", async () => {
    const adapter = createZoomAdapter();
    const body = JSON.stringify({
      event: "app_deauthorized",
      payload: { user_id: "u1", account_id: "a1" },
    });
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = signBody(ts, body);
    const out = await adapter.verifyAndParseWebhook(
      { "x-zm-signature": sig, "x-zm-request-timestamp": ts },
      body,
    );
    expect(out).toMatchObject({ type: "app.deauthorized", userId: "u1", accountId: "a1" });
  });

  test("accepts valid meeting.ended", async () => {
    const adapter = createZoomAdapter();
    const body = JSON.stringify({
      event: "meeting.ended",
      payload: {
        object: {
          id: 123456789,
          uuid: "abc==/uuid",
          host_id: "host_1",
          end_time: "2026-05-22T10:00:00Z",
        },
      },
    });
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = signBody(ts, body);
    const out = await adapter.verifyAndParseWebhook(
      { "x-zm-signature": sig, "x-zm-request-timestamp": ts },
      body,
    );
    expect(out).toMatchObject({
      type: "meeting.ended",
      meetingId: "123456789",
      meetingUuid: "abc==/uuid",
      hostId: "host_1",
      endTime: new Date("2026-05-22T10:00:00Z"),
    });
  });

  test("returns null for unrecognized event with valid signature", async () => {
    const adapter = createZoomAdapter();
    const body = JSON.stringify({ event: "meeting.started", payload: {} });
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = signBody(ts, body);
    const out = await adapter.verifyAndParseWebhook(
      { "x-zm-signature": sig, "x-zm-request-timestamp": ts },
      body,
    );
    expect(out).toBeNull();
  });
});

describe("ZoomAdapter.buildOnboardingUrl", () => {
  test("constructs authorize URL with required params", () => {
    const adapter = createZoomAdapter();
    const url = adapter.buildOnboardingUrl({
      state: "state-token",
      redirectUri: "http://localhost:3456/api/video/callback/zoom",
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("https://zoom.us/oauth/authorize");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("client_id")).toBe("zoom_client_test");
    expect(parsed.searchParams.get("state")).toBe("state-token");
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3456/api/video/callback/zoom",
    );
  });
});
