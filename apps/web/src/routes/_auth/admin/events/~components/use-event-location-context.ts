import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { eventsQueryOptions } from "@/queries/events";
import { zoomConnectionQueryOptions } from "@/queries/video";
import type { RecentLocation } from "./location-field";

// Shared data + actions for the smart LocationField: the org's Zoom connection
// status, a deep-link to connect Zoom, and recent physical addresses drawn from
// other events. Used by the create route and the event detail/edit page.
export function useEventLocationContext({
  orgSlug,
  excludeEventId,
}: {
  orgSlug: string | null;
  excludeEventId?: string;
}) {
  const navigate = useNavigate();
  const { data: zoomData } = useQuery(zoomConnectionQueryOptions);
  const zoomConnected = zoomData?.connection?.status === "active";
  const { data: eventsData } = useQuery(eventsQueryOptions);

  const recentLocations = useMemo<RecentLocation[]>(() => {
    const out: RecentLocation[] = [];
    const seen = new Set<string>();
    for (const e of eventsData?.events ?? []) {
      if (excludeEventId && e.id === excludeEventId) continue;
      const address = e.location?.trim();
      // Skip virtual links — only surface physical addresses as recents.
      if (!address || /^https?:\/\//i.test(address) || seen.has(address)) continue;
      seen.add(address);
      out.push({
        address,
        lat: e.locationLat === null ? "" : String(e.locationLat),
        lng: e.locationLng === null ? "" : String(e.locationLng),
      });
      if (out.length >= 5) break;
    }
    return out;
  }, [eventsData, excludeEventId]);

  const connectZoom = () => {
    if (!orgSlug) return;
    navigate({ to: "/admin/$orgSlug/settings", params: { orgSlug }, search: { tab: "video" } });
  };

  return { recentLocations, zoomConnected, connectZoom };
}
