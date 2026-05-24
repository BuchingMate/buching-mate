import type { BroadcastDto, CreateBroadcastRequest } from "@workspace/contracts";
import { api } from "./api";

export type ListBroadcastsResponse = { broadcasts: BroadcastDto[] };
export type BroadcastResponse = { broadcast: BroadcastDto };

export function listBroadcasts() {
  return api.get<ListBroadcastsResponse>("/api/broadcasts");
}

export function createBroadcast(input: CreateBroadcastRequest) {
  return api.post<BroadcastResponse>("/api/broadcasts", input);
}

export function sendBroadcast(broadcastId: string) {
  return api.post<BroadcastResponse>(`/api/broadcasts/${broadcastId}/send`, {});
}
