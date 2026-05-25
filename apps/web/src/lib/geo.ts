import { api } from "./api";

export interface PlaceSuggestion {
  placeId: string;
  primary: string;
  secondary: string;
}

export function geoAutocomplete(q: string, session: string) {
  const params = new URLSearchParams({ q, session });
  return api.get<{ suggestions: PlaceSuggestion[] }>(`/api/geo/autocomplete?${params}`);
}

export function geoPlaceDetails(placeId: string, session: string) {
  const params = new URLSearchParams({ placeId, session });
  return api.get<{ address: string; lat: number | null; lng: number | null }>(
    `/api/geo/place?${params}`,
  );
}
