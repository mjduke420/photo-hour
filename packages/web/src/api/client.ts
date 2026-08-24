export interface ClientConfig {
  maptilerKey: string | null;
  demMaxZoom: number;
  attribution: {
    elevation: string;
    basemap: string;
  };
}

export interface PlaceResult {
  name: string;
  lat: number;
  lng: number;
  kind: string;
}

const FALLBACK_CONFIG: ClientConfig = {
  maptilerKey: null,
  demMaxZoom: 15,
  attribution: {
    elevation: "Elevation: Mapzen terrain tiles via AWS Open Data",
    basemap: "Map data: OpenStreetMap contributors",
  },
};

/**
 * Bootstrap values from the server. A failure here is not fatal: the app falls
 * back to the keyless basemaps rather than refusing to start.
 */
export async function fetchClientConfig(): Promise<ClientConfig> {
  const response = await fetch("/api/config").catch(() => null);
  if (!response || !response.ok) return FALLBACK_CONFIG;
  const body = (await response.json().catch(() => null)) as Partial<ClientConfig> | null;
  if (!body) return FALLBACK_CONFIG;
  return {
    maptilerKey: typeof body.maptilerKey === "string" ? body.maptilerKey : null,
    demMaxZoom: typeof body.demMaxZoom === "number" ? body.demMaxZoom : FALLBACK_CONFIG.demMaxZoom,
    attribution: body.attribution ?? FALLBACK_CONFIG.attribution,
  };
}

export class PlaceSearchError extends Error {}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceResult[]> {
  const init = signal ? { signal } : {};
  const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, init);
  if (!response.ok) {
    throw new PlaceSearchError(
      response.status === 429
        ? "Too many searches just now, try again in a moment"
        : "Location search is unavailable",
    );
  }
  const body = (await response.json()) as { results?: PlaceResult[] };
  return body.results ?? [];
}
