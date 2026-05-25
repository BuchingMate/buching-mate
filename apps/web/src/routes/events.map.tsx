import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { getPublicRequestInfo, listPublicEventPins } from "@/lib/public";
import { NoSubdomainPlaceholder } from "./~components/no-subdomain";

const TILES_URL = "https://pub-f029b32869c242eba81dce1456520c09.r2.dev/sydney.pmtiles";
const SYDNEY_CENTER: [number, number] = [151.2093, -33.8688];
const NEON = "#ff7a1a";

const eventPinsQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ["public", "event-pins", slug],
    queryFn: () => listPublicEventPins(slug),
  });

export const Route = createFileRoute("/events/map")({
  component: EventsMapPage,
  loader: async ({ context }) => {
    const { slug } = await getPublicRequestInfo();
    if (!slug) return { slug: null as string | null };
    await context.queryClient.ensureQueryData(eventPinsQueryOptions(slug));
    return { slug };
  },
});

function EventsMapPage() {
  const { slug } = Route.useLoaderData();
  if (!slug) return <NoSubdomainPlaceholder />;
  return <MapView slug={slug} />;
}

function MapView({ slug }: { slug: string }) {
  const { data } = useSuspenseQuery(eventPinsQueryOptions(slug));
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let map: import("maplibre-gl").Map | null = null;
    let protocol: import("pmtiles").Protocol | null = null;

    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      await import("maplibre-gl/dist/maplibre-gl.css");
      const { Protocol } = await import("pmtiles");
      const themes = await import("protomaps-themes-base");

      protocol = new Protocol();
      maplibregl.addProtocol("pmtiles", protocol.tile);

      map = new maplibregl.Map({
        container: containerRef.current!,
        style: {
          version: 8,
          glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
          sprite: "https://protomaps.github.io/basemaps-assets/sprites/v4/dark",
          sources: {
            protomaps: {
              type: "vector",
              url: `pmtiles://${TILES_URL}`,
              attribution:
                '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>',
            },
          },
          layers: themes.default("protomaps", "black", "en"),
        },
        center: SYDNEY_CENTER,
        zoom: 11,
      });

      map.addControl(new maplibregl.NavigationControl(), "top-right");

      map.on("load", () => {
        if (!map) return;
        for (const pin of data.pins) {
          const el = document.createElement("div");
          el.className = "neon-pin";
          el.innerHTML = `<span class="neon-pin__ring"></span><span class="neon-pin__dot"></span>`;

          const popup = new maplibregl.Popup({ offset: 18, className: "neon-popup" }).setHTML(
            `<div class="neon-popup__inner">
               <div class="neon-popup__title">${escapeHtml(pin.title)}</div>
               ${pin.location ? `<div class="neon-popup__meta">// ${escapeHtml(pin.location)}</div>` : ""}
               <div class="neon-popup__meta">// ${pin.start_date} · ${pin.start_time}</div>
               <a href="/events/${pin.id}" class="neon-popup__link">[ open record &gt; ]</a>
             </div>`,
          );

          new maplibregl.Marker({ element: el })
            .setLngLat([Number(pin.longitude), Number(pin.latitude)])
            .setPopup(popup)
            .addTo(map);
        }
      });
    })();

    return () => {
      map?.remove();
      if (protocol) {
        import("maplibre-gl").then(({ default: maplibregl }) => {
          maplibregl.removeProtocol("pmtiles");
        });
      }
    };
  }, [data]);

  return (
    <div className="neon-map">
      <style>{NEON_CSS}</style>
      <div ref={containerRef} className="neon-map__canvas" />
      <div className="neon-map__scanlines" />
      <div className="neon-map__vignette" />
      <div className="neon-map__hud neon-map__hud--tl">
        <div className="neon-map__hud-label">// SCAN</div>
        <div className="neon-map__hud-value">SYDNEY · -33.87, 151.21</div>
      </div>
      <div className="neon-map__hud neon-map__hud--tr-offset">
        <div className="neon-map__hud-label">// NODES</div>
        <div className="neon-map__hud-value">{String(data.pins.length).padStart(3, "0")} active</div>
      </div>
      <div className="neon-map__hud neon-map__hud--bl">
        <div className="neon-map__hud-label">// FEED</div>
        <div className="neon-map__hud-value">events.sock @ buching-mate</div>
      </div>
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

const NEON_CSS = `
  .neon-map {
    position: relative;
    width: 100%;
    height: 100vh;
    background: #000;
    overflow: hidden;
    font-family: ui-monospace, "JetBrains Mono", "Fira Code", "SF Mono", Menlo, monospace;
  }
  .neon-map__canvas { position: absolute; inset: 0; }
  .neon-map__scanlines {
    position: absolute; inset: 0;
    background-image: repeating-linear-gradient(
      to bottom,
      rgba(255,122,26,0.04) 0px,
      rgba(255,122,26,0.04) 1px,
      transparent 1px,
      transparent 3px
    );
    pointer-events: none;
    mix-blend-mode: screen;
    z-index: 2;
  }
  .neon-map__vignette {
    position: absolute; inset: 0;
    background: radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.85) 100%);
    pointer-events: none;
    z-index: 3;
  }
  .neon-map__hud {
    position: absolute;
    z-index: 4;
    padding: 8px 12px;
    background: rgba(0,0,0,0.7);
    border: 1px solid rgba(255,122,26,0.35);
    color: ${NEON};
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    backdrop-filter: blur(6px);
    box-shadow: 0 0 12px rgba(255,122,26,0.15), inset 0 0 12px rgba(255,122,26,0.08);
  }
  .neon-map__hud--tl { top: 16px; left: 16px; }
  .neon-map__hud--tr-offset { top: 16px; right: 60px; }
  .neon-map__hud--bl { bottom: 32px; left: 16px; }
  .neon-map__hud-label { opacity: 0.7; font-size: 10px; }
  .neon-map__hud-value { color: #fff; text-shadow: 0 0 6px ${NEON}; margin-top: 2px; }

  .neon-pin {
    position: relative;
    width: 14px;
    height: 14px;
    cursor: pointer;
  }
  .neon-pin__dot {
    position: absolute;
    inset: 0;
    background: ${NEON};
    box-shadow: 0 0 8px ${NEON}, 0 0 16px rgba(255,122,26,0.5);
    border: 1px solid #fff2;
  }
  .neon-pin__ring {
    position: absolute;
    inset: -3px;
    border: 1px solid ${NEON};
    opacity: 0.7;
    animation: neon-pulse 1.8s ease-out infinite;
  }
  @keyframes neon-pulse {
    0%   { transform: scale(0.7); opacity: 0.9; }
    100% { transform: scale(2.0); opacity: 0; }
  }

  .maplibregl-popup.neon-popup .maplibregl-popup-content {
    background: rgba(5,10,8,0.92);
    border: 1px solid rgba(255,122,26,0.55);
    box-shadow: 0 0 18px rgba(255,122,26,0.25);
    color: #d6ffe9;
    padding: 12px 14px;
    border-radius: 2px;
    font-family: ui-monospace, "JetBrains Mono", "Fira Code", monospace;
  }
  .maplibregl-popup.neon-popup .maplibregl-popup-tip {
    border-top-color: rgba(255,122,26,0.55);
    border-bottom-color: rgba(255,122,26,0.55);
  }
  .maplibregl-popup.neon-popup .maplibregl-popup-close-button {
    color: ${NEON};
    font-size: 18px;
    padding: 0 6px;
  }
  .neon-popup__title {
    font-size: 13px;
    font-weight: 700;
    color: ${NEON};
    text-shadow: 0 0 6px rgba(255,122,26,0.6);
    letter-spacing: 0.04em;
    margin-bottom: 4px;
  }
  .neon-popup__meta { font-size: 11px; opacity: 0.85; }
  .neon-popup__link {
    display: inline-block;
    margin-top: 8px;
    font-size: 11px;
    color: ${NEON};
    text-decoration: none;
    border: 1px solid rgba(255,122,26,0.5);
    padding: 4px 8px;
    transition: all 0.15s;
  }
  .neon-popup__link:hover {
    background: ${NEON};
    color: #000;
    box-shadow: 0 0 12px ${NEON};
  }

  .maplibregl-ctrl-group {
    background: rgba(0,0,0,0.7) !important;
    border: 1px solid rgba(255,122,26,0.4) !important;
    box-shadow: 0 0 8px rgba(255,122,26,0.2) !important;
  }
  .maplibregl-ctrl-group button {
    background-color: transparent !important;
  }
  .maplibregl-ctrl-group button span {
    filter: invert(1);
  }
  .maplibregl-ctrl-attrib {
    background: rgba(0,0,0,0.6) !important;
    color: ${NEON} !important;
  }
  .maplibregl-ctrl-attrib a { color: ${NEON} !important; }
`;
