import { queryOptions } from "@tanstack/react-query";
import { getZoomConnection, listVideoProviders } from "@/lib/video";

export const videoKeys = {
  all: ["video"] as const,
  providers: () => [...videoKeys.all, "providers"] as const,
  zoomConnection: () => [...videoKeys.all, "zoom-connection"] as const,
};

export const videoProvidersQueryOptions = queryOptions({
  queryKey: videoKeys.providers(),
  queryFn: () => listVideoProviders(),
});

export const zoomConnectionQueryOptions = queryOptions({
  queryKey: videoKeys.zoomConnection(),
  queryFn: () => getZoomConnection(),
});
