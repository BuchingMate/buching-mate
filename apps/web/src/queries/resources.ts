import { queryOptions } from "@tanstack/react-query";
import {
  getResource,
  listEventResources,
  listResourceUsages,
  listResources,
  type ListResourcesOptions,
} from "@/lib/resources";

export const resourceKeys = {
  all: ["resources"] as const,
  lists: () => [...resourceKeys.all, "list"] as const,
  list: (options: ListResourcesOptions) =>
    [
      ...resourceKeys.lists(),
      options.type ?? "all",
      options.includeArchived ?? false,
      [...(options.eventIds ?? [])].sort().join(","),
      [...(options.eventTags ?? [])].sort().join(","),
    ] as const,
  details: () => [...resourceKeys.all, "detail"] as const,
  detail: (resourceId: string) => [...resourceKeys.details(), resourceId] as const,
  usages: (resourceId: string) => [...resourceKeys.all, "usages", resourceId] as const,
  eventLists: () => [...resourceKeys.all, "event"] as const,
  eventList: (eventId: string) => [...resourceKeys.eventLists(), eventId] as const,
};

export const resourcesQueryOptions = (options: ListResourcesOptions = {}) =>
  queryOptions({
    queryKey: resourceKeys.list(options),
    queryFn: () => listResources(options),
  });

export const resourceQueryOptions = (resourceId: string) =>
  queryOptions({
    queryKey: resourceKeys.detail(resourceId),
    queryFn: () => getResource(resourceId),
  });

export const resourceUsagesQueryOptions = (resourceId: string) =>
  queryOptions({
    queryKey: resourceKeys.usages(resourceId),
    queryFn: () => listResourceUsages(resourceId),
  });

export const eventResourcesQueryOptions = (eventId: string) =>
  queryOptions({
    queryKey: resourceKeys.eventList(eventId),
    queryFn: () => listEventResources(eventId),
  });
