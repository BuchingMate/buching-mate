import { zoomEnabled } from "../env";
import { VideoAdapterConfigError, type VideoProvider, type VideoProviderAdapter } from "./adapter";
import { createZoomAdapter } from "./zoom";

const adapters = new Map<VideoProvider, VideoProviderAdapter>();

if (zoomEnabled) {
  adapters.set("zoom", createZoomAdapter());
}

export function getVideoAdapter(provider: VideoProvider): VideoProviderAdapter {
  const adapter = adapters.get(provider);
  if (!adapter) {
    throw new VideoAdapterConfigError(`video provider not configured: ${provider}`);
  }
  return adapter;
}

export function isVideoProviderAvailable(provider: VideoProvider): boolean {
  return adapters.has(provider);
}

export function listAvailableVideoProviders(): VideoProvider[] {
  return Array.from(adapters.keys());
}
