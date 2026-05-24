import { createHmac, timingSafeEqual } from "node:crypto";
import { requireZoomEnv } from "../env";
import {
  VideoAdapterConfigError,
  VideoApiError,
  VideoInvalidSignatureError,
  type CancelRegistrantInput,
  type CreateMeetingInput,
  type CreateRegistrantInput,
  type CreatedMeeting,
  type CreatedRegistrant,
  type PastParticipant,
  type UpdateMeetingInput,
  type VideoOAuthTokens,
  type VideoProviderAdapter,
  type VideoWebhookEvent,
  type ZoomAccountType,
} from "./adapter";

const ZOOM_OAUTH_AUTHORIZE = "https://zoom.us/oauth/authorize";
const ZOOM_OAUTH_TOKEN = "https://zoom.us/oauth/token";
const ZOOM_API_BASE = "https://api.zoom.us/v2";

const SIGNATURE_TOLERANCE_SEC = 5 * 60;

function basicAuth(): string {
  const { clientId, clientSecret } = requireZoomEnv();
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

async function jsonFetch<T>(
  url: string,
  init: RequestInit & { authBearer?: string; authBasic?: boolean },
): Promise<T> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.authBearer) headers.authorization = `Bearer ${init.authBearer}`;
  if (init.authBasic) headers.authorization = `Basic ${basicAuth()}`;

  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    throw new VideoApiError(res.status, body);
  }
  return body as T;
}

type ZoomTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

type ZoomUserResponse = {
  id: string;
  account_id: string;
  email?: string;
  type?: number;
};

function mapAccountType(type: number | undefined): ZoomAccountType {
  if (type === 2) return "licensed";
  if (type === 3) return "on_prem";
  return "basic";
}

function encodeMeetingUuid(uuid: string): string {
  if (uuid.startsWith("/") || uuid.includes("//")) {
    return encodeURIComponent(encodeURIComponent(uuid));
  }
  return encodeURIComponent(uuid);
}

async function fetchTokens(form: URLSearchParams): Promise<ZoomTokenResponse> {
  const res = await fetch(`${ZOOM_OAUTH_TOKEN}?${form.toString()}`, {
    method: "POST",
    headers: {
      authorization: `Basic ${basicAuth()}`,
      "content-type": "application/x-www-form-urlencoded",
    },
  });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) throw new VideoApiError(res.status, body, "zoom token exchange failed");
  return body as ZoomTokenResponse;
}

async function tokensToVideoOAuth(token: ZoomTokenResponse): Promise<VideoOAuthTokens> {
  const me = await jsonFetch<ZoomUserResponse>(`${ZOOM_API_BASE}/users/me`, {
    method: "GET",
    authBearer: token.access_token,
  });
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: new Date(Date.now() + token.expires_in * 1000),
    scopes: token.scope ? token.scope.split(/\s+/).filter(Boolean) : [],
    zoomUserId: me.id,
    zoomAccountId: me.account_id,
    email: me.email ?? null,
    accountType: mapAccountType(me.type),
  };
}

function toZoomStart(startUtc: Date): string {
  return startUtc.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function toZoomRecurrence(rec: NonNullable<CreateMeetingInput["recurrence"]>) {
  const type = rec.frequency === "daily" ? 1 : rec.frequency === "weekly" ? 2 : 3;
  const out: Record<string, unknown> = {
    type,
    repeat_interval: rec.interval ?? 1,
  };
  if (rec.frequency === "weekly" && rec.weeklyDays && rec.weeklyDays.length > 0) {
    out.weekly_days = rec.weeklyDays.join(",");
  }
  if (rec.frequency === "monthly") {
    out.monthly_day = rec.monthlyDay ?? 1;
  }
  if (rec.endDateUtc) out.end_date_time = toZoomStart(rec.endDateUtc);
  else if (rec.endTimes) out.end_times = rec.endTimes;
  return out;
}

export function createZoomAdapter(): VideoProviderAdapter {
  return {
    provider: "zoom",

    buildOnboardingUrl({ state, redirectUri }) {
      const { clientId } = requireZoomEnv();
      const url = new URL(ZOOM_OAUTH_AUTHORIZE);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("state", state);
      return url.toString();
    },

    async exchangeOAuthCode({ code, redirectUri }) {
      const form = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      });
      const token = await fetchTokens(form);
      return tokensToVideoOAuth(token);
    },

    async refreshAccessToken(refreshToken) {
      const form = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      });
      const token = await fetchTokens(form);
      return tokensToVideoOAuth(token);
    },

    async createMeeting(accessToken, input: CreateMeetingInput): Promise<CreatedMeeting> {
      const reg = input.enableRegistration === true;
      const isRecurring = input.recurrence != null;
      const body: Record<string, unknown> = {
        topic: input.topic,
        type: isRecurring ? 8 : 2,
        start_time: toZoomStart(input.startUtc),
        duration: input.durationMinutes,
        timezone: input.timezone ?? "UTC",
        agenda: input.agenda ?? undefined,
        settings: {
          join_before_host: false,
          waiting_room: reg ? false : true,
          approval_type: reg ? 0 : 2,
          registration_type: reg ? 1 : undefined,
        },
      };
      if (input.recurrence) {
        body.recurrence = toZoomRecurrence(input.recurrence);
      }
      const created = await jsonFetch<{
        id: number;
        uuid?: string;
        join_url: string;
        start_url: string;
        password?: string;
      }>(`${ZOOM_API_BASE}/users/me/meetings`, {
        method: "POST",
        body: JSON.stringify(body),
        authBearer: accessToken,
      });
      return {
        meetingId: String(created.id),
        meetingUuid: created.uuid ?? null,
        joinUrl: created.join_url,
        hostStartUrl: created.start_url ?? null,
        passcode: created.password ?? null,
        registrationEnabled: reg,
        raw: created as unknown as Record<string, unknown>,
      };
    },

    async updateMeeting(accessToken, meetingId, input: UpdateMeetingInput) {
      const body: Record<string, unknown> = {};
      if (input.topic !== undefined) body.topic = input.topic;
      if (input.startUtc !== undefined) body.start_time = toZoomStart(input.startUtc);
      if (input.durationMinutes !== undefined) body.duration = input.durationMinutes;
      if (input.timezone !== undefined) body.timezone = input.timezone;
      if (input.agenda !== undefined) body.agenda = input.agenda ?? "";
      if (input.recurrence !== undefined) {
        body.recurrence = input.recurrence ? toZoomRecurrence(input.recurrence) : undefined;
        body.type = input.recurrence ? 8 : 2;
      }
      if (Object.keys(body).length === 0) return;
      await jsonFetch<unknown>(`${ZOOM_API_BASE}/meetings/${meetingId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
        authBearer: accessToken,
      });
    },

    async createRegistrant(accessToken, input: CreateRegistrantInput): Promise<CreatedRegistrant> {
      const body = {
        email: input.email,
        first_name: input.firstName,
        last_name: input.lastName ?? "",
      };
      const created = await jsonFetch<{ registrant_id: string; join_url: string }>(
        `${ZOOM_API_BASE}/meetings/${input.meetingId}/registrants`,
        {
          method: "POST",
          body: JSON.stringify(body),
          authBearer: accessToken,
        },
      );
      return {
        registrantId: created.registrant_id,
        joinUrl: created.join_url,
        raw: created as unknown as Record<string, unknown>,
      };
    },

    async cancelRegistrant(accessToken, input: CancelRegistrantInput): Promise<void> {
      await jsonFetch<unknown>(`${ZOOM_API_BASE}/meetings/${input.meetingId}/registrants/status`, {
        method: "PUT",
        body: JSON.stringify({
          action: "cancel",
          registrants: [{ id: input.registrantId, email: input.email }],
        }),
        authBearer: accessToken,
      });
    },

    async getPastParticipants(accessToken, meetingUuid): Promise<PastParticipant[]> {
      const encoded = encodeMeetingUuid(meetingUuid);
      const all: PastParticipant[] = [];
      let nextPageToken: string | undefined;
      do {
        const url = new URL(`${ZOOM_API_BASE}/past_meetings/${encoded}/participants`);
        url.searchParams.set("page_size", "300");
        if (nextPageToken) url.searchParams.set("next_page_token", nextPageToken);
        const res = await jsonFetch<{
          participants: Array<{
            id?: string;
            user_email?: string;
            name?: string;
            join_time?: string;
            leave_time?: string;
            duration?: number;
            registrant_id?: string;
            ip_address?: string;
            location?: string;
            city?: string;
            country?: string;
            device?: string;
            network_type?: string;
          }>;
          next_page_token?: string;
        }>(url.toString(), { method: "GET", authBearer: accessToken });
        for (const p of res.participants ?? []) {
          all.push({
            email: p.user_email?.toLowerCase() ?? null,
            name: p.name ?? null,
            joinTime: p.join_time ? new Date(p.join_time) : null,
            leaveTime: p.leave_time ? new Date(p.leave_time) : null,
            durationSeconds: typeof p.duration === "number" ? p.duration : null,
            registrantId: p.registrant_id ?? null,
            ipAddress: p.ip_address ?? null,
            country: p.country ?? null,
            city: p.city ?? p.location ?? null,
            device: p.device ?? null,
            networkType: p.network_type ?? null,
          });
        }
        nextPageToken =
          res.next_page_token && res.next_page_token.length > 0 ? res.next_page_token : undefined;
      } while (nextPageToken);
      return all;
    },

    async deleteMeeting(accessToken, meetingId) {
      const url = `${ZOOM_API_BASE}/meetings/${meetingId}?schedule_for_reminder=false`;
      const res = await fetch(url, {
        method: "DELETE",
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok && res.status !== 404) {
        const text = await res.text();
        throw new VideoApiError(res.status, text, "zoom delete meeting failed");
      }
    },

    async verifyAndParseWebhook(headers, rawBody): Promise<VideoWebhookEvent | null> {
      const { webhookSecretToken } = requireZoomEnv();
      if (!webhookSecretToken) {
        throw new VideoAdapterConfigError("ZOOM_WEBHOOK_SECRET_TOKEN not set");
      }

      let parsed: { event?: string; payload?: Record<string, unknown>; event_ts?: number };
      try {
        parsed = JSON.parse(rawBody);
      } catch {
        throw new VideoInvalidSignatureError("invalid json body");
      }
      const eventTs = typeof parsed.event_ts === "number" ? parsed.event_ts : Date.now();

      if (parsed.event === "endpoint.url_validation") {
        const plainToken =
          typeof parsed.payload?.plainToken === "string" ? parsed.payload.plainToken : "";
        if (!plainToken) throw new VideoInvalidSignatureError("missing plainToken");
        return { type: "endpoint.url_validation", plainToken };
      }

      const sigHeader = headers["x-zm-signature"];
      const tsHeader = headers["x-zm-request-timestamp"];
      if (!sigHeader || !tsHeader) {
        throw new VideoInvalidSignatureError("missing zoom signature headers");
      }
      const ts = Number(tsHeader);
      if (!Number.isFinite(ts)) throw new VideoInvalidSignatureError("invalid timestamp");
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - ts) > SIGNATURE_TOLERANCE_SEC) {
        throw new VideoInvalidSignatureError("stale timestamp");
      }
      const message = `v0:${tsHeader}:${rawBody}`;
      const computed = `v0=${createHmac("sha256", webhookSecretToken).update(message).digest("hex")}`;
      const a = Buffer.from(computed);
      const b = Buffer.from(sigHeader);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        throw new VideoInvalidSignatureError("signature mismatch");
      }

      if (parsed.event === "app_deauthorized") {
        const payload = parsed.payload as { user_id?: string; account_id?: string } | undefined;
        if (!payload?.user_id || !payload?.account_id) return null;
        return {
          type: "app.deauthorized",
          providerEventId: `app_deauthorized:${payload.user_id}:${eventTs}`,
          userId: payload.user_id,
          accountId: payload.account_id,
        };
      }

      if (parsed.event === "meeting.ended") {
        const obj = (parsed.payload as { object?: Record<string, unknown> } | undefined)?.object;
        const idRaw = obj?.id;
        const uuidRaw = obj?.uuid;
        if (idRaw === undefined || idRaw === null || typeof uuidRaw !== "string") return null;
        const endTimeRaw = obj?.end_time;
        return {
          type: "meeting.ended",
          providerEventId: `meeting.ended:${uuidRaw}:${eventTs}`,
          meetingId: String(idRaw),
          meetingUuid: uuidRaw,
          hostId: typeof obj?.host_id === "string" ? obj.host_id : null,
          endTime: typeof endTimeRaw === "string" ? new Date(endTimeRaw) : null,
        };
      }

      if (parsed.event === "meeting.deleted") {
        const obj = (parsed.payload as { object?: Record<string, unknown> } | undefined)?.object;
        const idRaw = obj?.id;
        const uuidRaw = typeof obj?.uuid === "string" ? obj.uuid : null;
        if (idRaw === undefined || idRaw === null) return null;
        return {
          type: "meeting.deleted",
          providerEventId: `meeting.deleted:${String(idRaw)}:${eventTs}`,
          meetingId: String(idRaw),
          meetingUuid: uuidRaw,
        };
      }

      return null;
    },

    computeUrlValidationResponse(plainToken) {
      const { webhookSecretToken } = requireZoomEnv();
      if (!webhookSecretToken) {
        throw new VideoAdapterConfigError("ZOOM_WEBHOOK_SECRET_TOKEN not set");
      }
      const encryptedToken = createHmac("sha256", webhookSecretToken)
        .update(plainToken)
        .digest("hex");
      return { plainToken, encryptedToken };
    },
  };
}
