import type {
  CreateResourceRequest,
  EventResourceDto,
  ResourceDto,
  ResourceUsageDto,
  UpdateEventResourcesRequest,
  UpdateResourceRequest,
} from "@workspace/contracts";
import { api } from "./api";

export interface ListResourcesOptions {
  type?: string | null;
  includeArchived?: boolean;
  eventIds?: string[];
  eventTags?: string[];
}

export function listResources(options: ListResourcesOptions = {}) {
  const params = new URLSearchParams();
  if (options.type) params.set("type", options.type);
  if (options.includeArchived) params.set("includeArchived", "true");
  if (options.eventIds?.length) params.set("eventIds", options.eventIds.join(","));
  if (options.eventTags?.length) params.set("eventTags", options.eventTags.join(","));
  const query = params.toString();
  return api.get<{ resources: ResourceDto[] }>(`/api/resources${query ? `?${query}` : ""}`);
}

export function getResource(resourceId: string) {
  return api.get<{ resource: ResourceDto }>(`/api/resources/${resourceId}`);
}

export function createResource(input: CreateResourceRequest) {
  return api.post<{ resource: ResourceDto }>("/api/resources", input);
}

export function updateResource(resourceId: string, input: UpdateResourceRequest) {
  return api.patch<{ resource: ResourceDto }>(`/api/resources/${resourceId}`, input);
}

export function deleteResource(resourceId: string) {
  return api.delete<{ deleted: true }>(`/api/resources/${resourceId}`);
}

export function archiveResource(resourceId: string) {
  return api.post<{ resource: ResourceDto }>(`/api/resources/${resourceId}/archive`);
}

export function unarchiveResource(resourceId: string) {
  return api.post<{ resource: ResourceDto }>(`/api/resources/${resourceId}/unarchive`);
}

export function listResourceUsages(resourceId: string) {
  return api.get<{ usages: ResourceUsageDto[] }>(`/api/resources/${resourceId}/events`);
}

export function listEventResources(eventId: string) {
  return api.get<{ resources: EventResourceDto[] }>(`/api/events/${eventId}/resources`);
}

export function replaceEventResources(eventId: string, input: UpdateEventResourcesRequest) {
  return api.put<{ resources: EventResourceDto[] }>(`/api/events/${eventId}/resources`, input);
}
