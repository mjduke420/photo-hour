import { clampLatitude, lngLatToMercator, mercatorToLngLat, type LngLat } from "./mercator.js";

export interface TileCoord {
  z: number;
  x: number;
  y: number;
}

export interface TileRange {
  z: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface BoundsLngLat {
  west: number;
  south: number;
  east: number;
  north: number;
}

export function tilesAtZoom(z: number): number {
  return 2 ** z;
}

/** Fractional tile coordinates - the integer part is the tile, the rest is the offset within it. */
export function lngLatToTileFraction(lngLat: LngLat, z: number): { x: number; y: number } {
  const { x, y } = lngLatToMercator(lngLat);
  const n = tilesAtZoom(z);
  return { x: x * n, y: y * n };
}

export function tileToLngLat(x: number, y: number, z: number): LngLat {
  const n = tilesAtZoom(z);
  return mercatorToLngLat({ x: x / n, y: y / n });
}

/** Wraps a tile column around the antimeridian. Rows are clamped instead. */
export function wrapTileX(x: number, z: number): number {
  const n = tilesAtZoom(z);
  return ((x % n) + n) % n;
}

export function isValidTile({ z, x, y }: TileCoord, maxZoom: number): boolean {
  if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y)) return false;
  if (z < 0 || z > maxZoom) return false;
  const n = tilesAtZoom(z);
  return x >= 0 && x < n && y >= 0 && y < n;
}

export function tileRangeForBounds(bounds: BoundsLngLat, z: number): TileRange {
  const n = tilesAtZoom(z);
  const topLeft = lngLatToTileFraction(
    { lng: bounds.west, lat: clampLatitude(bounds.north) },
    z,
  );
  const bottomRight = lngLatToTileFraction(
    { lng: bounds.east, lat: clampLatitude(bounds.south) },
    z,
  );
  return {
    z,
    minX: Math.floor(topLeft.x),
    maxX: Math.floor(bottomRight.x),
    minY: Math.max(0, Math.floor(topLeft.y)),
    maxY: Math.min(n - 1, Math.floor(bottomRight.y)),
  };
}

export function tileRangeSize(range: TileRange): { width: number; height: number; count: number } {
  const width = range.maxX - range.minX + 1;
  const height = range.maxY - range.minY + 1;
  return { width, height, count: width * height };
}
