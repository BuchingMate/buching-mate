import { api } from "./api";

export type VideoProvider = "zoom";

export type VideoConnectionDto = {
  id: string;
  provider: VideoProvider;
  accountId: string;
  status: "active" | "revoked" | "error";
  email: string | null;
  connectedAt: string;
  revokedAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
};

export type ListVideoProvidersResponse = { providers: VideoProvider[] };
export type GetZoomConnectionResponse = { connection: VideoConnectionDto | null };
export type StartZoomConnectResponse = { url: string };

export function listVideoProviders() {
  return api.get<ListVideoProvidersResponse>("/api/video/providers");
}

export function getZoomConnection() {
  return api.get<GetZoomConnectionResponse>("/api/video/connections/zoom");
}

export function startZoomConnect() {
  return api.post<StartZoomConnectResponse>("/api/video/connect/zoom", {});
}

export function disconnectZoom() {
  return api.delete<{ deleted: boolean }>("/api/video/connections/zoom");
}

export function getHostStartUrl(eventId: string) {
  return api.get<{ url: string }>(`/api/video/events/${eventId}/host-start-url`);
}
