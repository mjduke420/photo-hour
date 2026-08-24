import type { StyleSpecification } from "maplibre-gl";

export interface BasemapOption {
  id: string;
  label: string;
  description: string;
  /** MapTiler styles need a key; the OSM and Carto rasters do not. */
  requiresKey: boolean;
  resolve(maptilerKey: string | null): StyleSpecification | string | null;
}

function rasterStyle(
  id: string,
  tiles: string[],
  attribution: string,
  maxzoom: number,
): StyleSpecification {
  return {
    version: 8,
    sources: {
      [id]: { type: "raster", tiles, tileSize: 256, attribution, maxzoom },
    },
    layers: [{ id: `${id}-base`, type: "raster", source: id }],
  };
}

const OSM_ATTRIBUTION = "&copy; OpenStreetMap contributors";
const CARTO_ATTRIBUTION = `${OSM_ATTRIBUTION}, &copy; CARTO`;

/**
 * Ordered by usefulness for scouting: the muted styles are first because a
 * loud basemap fights with the shadow overlay for attention.
 */
export const BASEMAPS: BasemapOption[] = [
  {
    id: "muted",
    label: "Muted",
    description: "Low-contrast basemap that keeps the shadow overlay readable",
    requiresKey: false,
    resolve: () =>
      rasterStyle(
        "carto-light",
        [
          "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
          "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
          "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        ],
        CARTO_ATTRIBUTION,
        19,
      ),
  },
  {
    id: "osm",
    label: "Streets",
    description: "Standard OpenStreetMap, no API key needed",
    requiresKey: false,
    resolve: () =>
      rasterStyle(
        "osm",
        ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        OSM_ATTRIBUTION,
        19,
      ),
  },
  {
    id: "dark",
    label: "Dark",
    description: "Dark basemap for planning night and twilight shoots",
    requiresKey: false,
    resolve: () =>
      rasterStyle(
        "carto-dark",
        [
          "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
          "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
          "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        ],
        CARTO_ATTRIBUTION,
        19,
      ),
  },
  {
    id: "satellite",
    label: "Satellite",
    description: "Aerial imagery, for reading the actual ground cover",
    requiresKey: true,
    resolve: (key) => (key ? `https://api.maptiler.com/maps/satellite/style.json?key=${key}` : null),
  },
  {
    id: "outdoor",
    label: "Topo",
    description: "Contours and trails, for reading the shape of the terrain",
    requiresKey: true,
    resolve: (key) => (key ? `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${key}` : null),
  },
];

export const DEFAULT_BASEMAP_ID = "muted";

/** Only the styles this deployment can actually load. */
export function availableBasemaps(maptilerKey: string | null): BasemapOption[] {
  return BASEMAPS.filter((option) => !option.requiresKey || Boolean(maptilerKey));
}

export function findBasemap(id: string, maptilerKey: string | null): BasemapOption {
  const options = availableBasemaps(maptilerKey);
  return (
    options.find((option) => option.id === id) ??
    options.find((option) => option.id === DEFAULT_BASEMAP_ID) ??
    (options[0] as BasemapOption)
  );
}
