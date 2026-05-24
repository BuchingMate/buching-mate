import { queryOptions } from "@tanstack/react-query";
import { listBroadcasts } from "@/lib/broadcasts";

export const broadcastKeys = {
  all: ["broadcasts"] as const,
};

export const broadcastsQueryOptions = queryOptions({
  queryKey: broadcastKeys.all,
  queryFn: () => listBroadcasts(),
});
