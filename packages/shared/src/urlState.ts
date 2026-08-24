import { clamp } from "./math.js";
import { MAX_MERCATOR_LATITUDE } from "./mercator.js";
import { MINUTES_PER_DAY } from "./time.js";

/**
 * The shareable part of the app state, round-tripped through the URL hash so a
 * planned shoot can be bookmarked or sent to someone else.
 *
 * Format: #map=<zoom>/<lat>/<lng>&d=<YYYY-MM-DD>&t=<minutes>&b=<basemapId>
 */
export interface UrlState {
  zoom: number;
  lat: number;
  lng: number;
  dateISO: string;
  minutes: number;
  basemap: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const BASEMAP_PATTERN = /^[a-z0-9-]{1,32}$/;

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function encodeUrlState(state: UrlState): string {
  const map = [round(state.zoom, 2), round(state.lat, 5), round(state.lng, 5)].join("/");
  const params = new URLSearchParams({
    map,
    d: state.dateISO,
    t: String(Math.round(state.minutes)),
    b: state.basemap,
  });
  return `#${params.toString()}`;
}

/**
 * Returns only the fields present and valid in the hash, so callers can merge
 * the result over their defaults. Anything malformed is dropped rather than
 * throwing, because the hash is user-editable.
 */
export function decodeUrlState(hash: string): Partial<UrlState> {
  const trimmed = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!trimmed) return {};

  const params = new URLSearchParams(trimmed);
  const result: Partial<UrlState> = {};

  const map = params.get("map");
  if (map) {
    const parts = map.split("/").map(Number);
    const [zoom, lat, lng] = parts;
    if (
      parts.length === 3 &&
      Number.isFinite(zoom) &&
      Number.isFinite(lat) &&
      Number.isFinite(lng)
    ) {
      result.zoom = clamp(zoom as number, 0, 22);
      result.lat = clamp(lat as number, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);
      result.lng = clamp(lng as number, -180, 180);
    }
  }

  const date = params.get("d");
  if (date && DATE_PATTERN.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    result.dateISO = date;
  }

  if (params.has("t")) {
    const minutes = Number(params.get("t"));
    if (Number.isFinite(minutes)) {
      result.minutes = clamp(minutes, 0, MINUTES_PER_DAY - 1);
    }
  }

  const basemap = params.get("b");
  if (basemap && BASEMAP_PATTERN.test(basemap)) {
    result.basemap = basemap;
  }

  return result;
}
