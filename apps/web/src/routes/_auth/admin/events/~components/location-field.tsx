import { useEffect, useRef, useState } from "react";
import { Globe, MapPin, Video, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { geoAutocomplete, geoPlaceDetails, type PlaceSuggestion } from "@/lib/geo";

export type RecentLocation = { address: string; lat: string; lng: string };

// Places autocomplete session id. crypto.randomUUID only exists in secure
// contexts (https / localhost) — plain-http dev hosts like lvh.me lack it, so
// fall back to a random string; uniqueness is all the Places API needs.
function newSessionId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

// Presets that just prep the field for a pasted link (no live integration).
const PASTE_PRESETS = [
  { label: "Google Meet", hint: "Paste your Google Meet link" },
  { label: "Custom link", hint: "Paste a virtual event link" },
] as const;

export function LocationField({
  value,
  onChange,
  onCoords,
  disabled,
  recentLocations,
  videoProvider,
  zoomConnected,
  onConnectZoom,
  onVideoProviderChange,
}: {
  value: string;
  onChange: (value: string) => void;
  onCoords: (lat: string, lng: string) => void;
  disabled?: boolean;
  recentLocations: RecentLocation[];
  videoProvider: "" | "zoom";
  zoomConnected: boolean;
  onConnectZoom: () => void;
  onVideoProviderChange: (provider: "" | "zoom") => void;
}) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [placeholder, setPlaceholder] = useState("Search an address or paste a link");
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionRef = useRef<string>(newSessionId());
  const skipRef = useRef(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    if (skipRef.current) {
      // Query was set by selecting a suggestion — don't re-fetch.
      skipRef.current = false;
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await geoAutocomplete(q, sessionRef.current);
        setSuggestions(res.suggestions);
        setOpen(res.suggestions.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Show live address results once the user has typed enough; otherwise the
  // focus menu offers recent addresses + virtual-link presets.
  const showSuggestions = query.trim().length >= 3 && suggestions.length > 0;

  const pick = async (s: PlaceSuggestion) => {
    setOpen(false);
    skipRef.current = true;
    const fallback = [s.primary, s.secondary].filter(Boolean).join(", ");
    try {
      const details = await geoPlaceDetails(s.placeId, sessionRef.current);
      const address = details.address || fallback;
      setQuery(address);
      onChange(address);
      onCoords(
        details.lat === null ? "" : String(details.lat),
        details.lng === null ? "" : String(details.lng),
      );
    } catch {
      setQuery(fallback);
      onChange(fallback);
      onCoords("", "");
    }
    sessionRef.current = newSessionId();
  };

  const pickRecent = (r: RecentLocation) => {
    setOpen(false);
    skipRef.current = true;
    setQuery(r.address);
    onChange(r.address);
    onCoords(r.lat, r.lng);
  };

  const pickPaste = (hint: string) => {
    setOpen(false);
    skipRef.current = true;
    setQuery("");
    onChange("");
    onCoords("", "");
    setPlaceholder(hint);
    inputRef.current?.focus();
  };

  const pickZoom = () => {
    setOpen(false);
    if (!zoomConnected) {
      onConnectZoom();
      return;
    }
    setQuery("");
    onChange("");
    onCoords("", "");
    onVideoProviderChange("zoom");
  };

  // Zoom chosen: replace the address input with a pill — the join link is
  // generated from your Zoom integration when the event is saved.
  if (videoProvider === "zoom") {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2">
        <span className="flex min-w-0 items-center gap-2 text-sm">
          <Video className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0">
            <span className="block font-medium">Zoom meeting</span>
            <span className="block text-xs text-muted-foreground">
              Link generated from your Zoom on save
            </span>
          </span>
        </span>
        {!disabled && (
          <button
            type="button"
            onClick={() => onVideoProviderChange("")}
            className="rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label="Remove Zoom meeting"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          onCoords("", "");
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <ul className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
          {showSuggestions ? (
            suggestions.map((s) => (
              <li key={s.placeId}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(s)}
                  className="flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block truncate">{s.primary}</span>
                    {s.secondary && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {s.secondary}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))
          ) : (
            <>
              <li className="px-2 py-1 text-xs font-medium text-muted-foreground">
                Recent locations
              </li>
              {recentLocations.length > 0 ? (
                recentLocations.map((r) => (
                  <li key={r.address}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickRecent(r)}
                      className="flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                    >
                      <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span className="block min-w-0 truncate">{r.address}</span>
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-2 py-1.5 text-sm text-muted-foreground">
                  No saved locations yet
                </li>
              )}
              <li className="px-2 py-1 text-xs font-medium text-muted-foreground">Virtual</li>
              <li>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={pickZoom}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <Video className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    {zoomConnected ? "Create Zoom meeting" : "Connect Zoom to add a meeting"}
                  </span>
                </button>
              </li>
              {PASTE_PRESETS.map((p) => (
                <li key={p.label}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickPaste(p.hint)}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    <Globe className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{p.label}</span>
                  </button>
                </li>
              ))}
            </>
          )}
        </ul>
      )}
    </div>
  );
}
