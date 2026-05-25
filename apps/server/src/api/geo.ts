import { Hono } from "hono";
import { apiError } from "./errors";
import type { ApiEnv } from "./types";
import { requireAuth } from "../middleware/auth";
import { GOOGLE_MAPS_API_KEY } from "../env";

// Server-side proxy for Google Places (New) so the API key never reaches the
// browser. Autocomplete-only usage (no map rendering) keeps us within Google's
// terms. Returns empty results (not an error) when no key is configured so the
// location field degrades to a plain text input.

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const PLACE_URL = "https://places.googleapis.com/v1/places";

interface Suggestion {
  placeId: string;
  primary: string;
  secondary: string;
}

export const geoRoutes = new Hono<ApiEnv>()
  .use("*", requireAuth)
  .get("/autocomplete", async (c) => {
    const q = c.req.query("q")?.trim() ?? "";
    const session = c.req.query("session") ?? "";
    if (!GOOGLE_MAPS_API_KEY || q.length < 3) {
      return c.json<{ suggestions: Suggestion[] }>({ suggestions: [] });
    }
    const res = await fetch(AUTOCOMPLETE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
      },
      body: JSON.stringify({ input: q, ...(session ? { sessionToken: session } : {}) }),
    });
    if (!res.ok) return apiError(c, 502, "geo_upstream", "Address lookup failed");
    const data = (await res.json()) as {
      suggestions?: {
        placePrediction?: {
          placeId: string;
          structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
          text?: { text: string };
        };
      }[];
    };
    const suggestions: Suggestion[] = (data.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId))
      .map((p) => ({
        placeId: p.placeId,
        primary: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
        secondary: p.structuredFormat?.secondaryText?.text ?? "",
      }));
    return c.json({ suggestions });
  })
  .get("/place", async (c) => {
    const placeId = c.req.query("placeId")?.trim() ?? "";
    const session = c.req.query("session") ?? "";
    if (!GOOGLE_MAPS_API_KEY || !placeId) {
      return apiError(c, 400, "geo_invalid", "placeId is required");
    }
    const url = new URL(`${PLACE_URL}/${encodeURIComponent(placeId)}`);
    if (session) url.searchParams.set("sessionToken", session);
    const res = await fetch(url, {
      headers: {
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": "formattedAddress,location,displayName",
      },
    });
    if (!res.ok) return apiError(c, 502, "geo_upstream", "Address lookup failed");
    const data = (await res.json()) as {
      formattedAddress?: string;
      displayName?: { text?: string };
      location?: { latitude: number; longitude: number };
    };
    return c.json({
      address: data.formattedAddress ?? data.displayName?.text ?? "",
      lat: data.location?.latitude ?? null,
      lng: data.location?.longitude ?? null,
    });
  });
