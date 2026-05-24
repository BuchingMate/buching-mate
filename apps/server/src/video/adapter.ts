export type VideoProvider = "zoom";

export type ZoomAccountType = "basic" | "licensed" | "on_prem";

export type VideoOAuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string[];
  zoomUserId: string;
  zoomAccountId: string;
  email: string | null;
  accountType: ZoomAccountType;
};

export type RecurrenceInput = {
  frequency: "daily" | "weekly" | "monthly";
  interval?: number;
  weeklyDays?: number[];
  monthlyDay?: number;
  endDateUtc?: Date;
  endTimes?: number;
};

export type CreateMeetingInput = {
  topic: string;
  startUtc: Date;
  durationMinutes: number;
  timezone?: string;
  agenda?: string | null;
  enableRegistration?: boolean;
  recurrence?: RecurrenceInput | null;
};

export type CreatedMeeting = {
  meetingId: string;
  meetingUuid: string | null;
  joinUrl: string;
  hostStartUrl: string | null;
  passcode: string | null;
  registrationEnabled: boolean;
  raw: Record<string, unknown>;
};

export type UpdateMeetingInput = Partial<CreateMeetingInput>;

export type CreateRegistrantInput = {
  meetingId: string;
  email: string;
  firstName: string;
  lastName?: string;
};

export type CreatedRegistrant = {
  registrantId: string;
  joinUrl: string;
  raw: Record<string, unknown>;
};

export type CancelRegistrantInput = {
  meetingId: string;
  registrantId: string;
  email: string;
};

export type PastParticipant = {
  email: string | null;
  name: string | null;
  joinTime: Date | null;
  leaveTime: Date | null;
  durationSeconds: number | null;
  registrantId: string | null;
  ipAddress: string | null;
  country: string | null;
  city: string | null;
  device: string | null;
  networkType: string | null;
};

export type VideoWebhookEvent =
  | { type: "endpoint.url_validation"; plainToken: string }
  | { type: "app.deauthorized"; providerEventId: string; userId: string; accountId: string }
  | {
      type: "meeting.ended";
      providerEventId: string;
      meetingId: string;
      meetingUuid: string;
      hostId: string | null;
      endTime: Date | null;
    }
  | {
      type: "meeting.deleted";
      providerEventId: string;
      meetingId: string;
      meetingUuid: string | null;
    };

export interface VideoProviderAdapter {
  readonly provider: VideoProvider;
  buildOnboardingUrl(input: { state: string; redirectUri: string }): string;
  exchangeOAuthCode(input: { code: string; redirectUri: string }): Promise<VideoOAuthTokens>;
  refreshAccessToken(refreshToken: string): Promise<VideoOAuthTokens>;
  createMeeting(accessToken: string, input: CreateMeetingInput): Promise<CreatedMeeting>;
  updateMeeting(accessToken: string, meetingId: string, input: UpdateMeetingInput): Promise<void>;
  deleteMeeting(accessToken: string, meetingId: string): Promise<void>;
  createRegistrant(accessToken: string, input: CreateRegistrantInput): Promise<CreatedRegistrant>;
  cancelRegistrant(accessToken: string, input: CancelRegistrantInput): Promise<void>;
  getPastParticipants(accessToken: string, meetingUuid: string): Promise<PastParticipant[]>;
  verifyAndParseWebhook(
    headers: Record<string, string | undefined>,
    rawBody: string,
  ): Promise<VideoWebhookEvent | null>;
  computeUrlValidationResponse(plainToken: string): { plainToken: string; encryptedToken: string };
}

export class VideoAdapterConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VideoAdapterConfigError";
  }
}

export class VideoInvalidSignatureError extends Error {
  constructor(message = "invalid webhook signature") {
    super(message);
    this.name = "VideoInvalidSignatureError";
  }
}

export class VideoApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `video api error ${status}`);
    this.name = "VideoApiError";
    this.status = status;
    this.body = body;
  }
}
