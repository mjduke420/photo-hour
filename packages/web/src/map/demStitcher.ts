import {
  clampLatitude,
  decodeTerrarium,
  lngLatToMercator,
  mercatorToLngLat,
  metersToMercatorUnits,
  shadowReachMeters,
  TERRARIUM_TILE_SIZE,
  type BoundsLngLat,
} from "@photo-hour/shared";

/** Stitched elevation raster, ready to upload as a WebGL texture. */
export interface DemTexture {
  /** Raw Terrarium RGBA bytes, decoded on the GPU rather than here. */
  pixels: Uint8Array;
  width: number;
  height: number;
  /** Mercator coordinate of the north-west corner. */
  originX: number;
  originY: number;
  spanX: number;
  spanY: number;
  maxElevation: number;
  zoom: number;
  /** Identity of the covered area, so callers can skip redundant reloads. */
  key: string;
}

export interface DemRequest {
  bounds: BoundsLngLat;
  mapZoom: number;
  /** Compass bearing of the sun in radians, used to bias the fetch margin. */
  sunAzimuth: number;
  sunAltitude: number;
}

export interface MercatorBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const MIN_DEM_ZOOM = 2;
const MAX_DEM_ZOOM = 13;
const MAX_TILES = 100;
const MAX_CONCURRENT_FETCHES = 8;

/**
 * Relief allowance used to size the fetch margin. Terrain up to this height
 * above the viewport is assumed to exist just outside it, which decides how far
 * beyond the screen the elevation fetch needs to reach for a low sun.
 */
const ASSUMED_RELIEF_M = 2500;
const MAX_MARGIN_M = 60000;

/** Terrarium encoding of exactly sea level, used for gaps in coverage. */
const SEA_LEVEL_FILL = "rgb(128, 0, 0)";

export function boundsToMercator(bounds: BoundsLngLat): MercatorBox {
  const northWest = lngLatToMercator({ lng: bounds.west, lat: clampLatitude(bounds.north) });
  const southEast = lngLatToMercator({ lng: bounds.east, lat: clampLatitude(bounds.south) });
  return {
    minX: Math.min(northWest.x, southEast.x),
    maxX: Math.max(northWest.x, southEast.x),
    minY: Math.min(northWest.y, southEast.y),
    maxY: Math.max(northWest.y, southEast.y),
  };
}

/**
 * Grows the box towards the sun only.
 *
 * Blocking terrain always lies between a point and the sun, so widening the
 * fetch in every direction would quadruple the tile count for no benefit.
 */
export function expandTowardsSun(
  box: MercatorBox,
  sunAzimuth: number,
  sunAltitude: number,
): MercatorBox {
  const centreLat = mercatorToLngLat({
    x: (box.minX + box.maxX) / 2,
    y: (box.minY + box.maxY) / 2,
  }).lat;

  const reach = shadowReachMeters(sunAltitude, ASSUMED_RELIEF_M, MAX_MARGIN_M);
  const margin = metersToMercatorUnits(reach, centreLat);

  const east = Math.sin(sunAzimuth);
  const north = Math.cos(sunAzimuth);

  return {
    minX: box.minX - margin * Math.max(0, -east),
    maxX: box.maxX + margin * Math.max(0, east),
    // Mercator y grows southward, so a northern sun extends the top edge.
    minY: box.minY - margin * Math.max(0, north),
    maxY: box.maxY + margin * Math.max(0, -north),
  };
}

export interface TilePlan {
  zoom: number;
  minTileX: number;
  minTileY: number;
  columns: number;
  rows: number;
}

/** Picks the highest elevation zoom whose tile count stays within budget. */
export function planTiles(box: MercatorBox, mapZoom: number): TilePlan {
  let zoom = Math.min(MAX_DEM_ZOOM, Math.max(MIN_DEM_ZOOM, Math.round(mapZoom)));

  for (;;) {
    const scale = 2 ** zoom;
    const minTileX = Math.max(0, Math.floor(box.minX * scale));
    const maxTileX = Math.min(scale - 1, Math.floor(box.maxX * scale));
    const minTileY = Math.max(0, Math.floor(box.minY * scale));
    const maxTileY = Math.min(scale - 1, Math.floor(box.maxY * scale));

    const columns = Math.max(1, maxTileX - minTileX + 1);
    const rows = Math.max(1, maxTileY - minTileY + 1);

    if (columns * rows <= MAX_TILES || zoom <= MIN_DEM_ZOOM) {
      return { zoom, minTileX, minTileY, columns, rows };
    }
    zoom -= 1;
  }
}

function createCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Decoding depends on the exact bytes, so colour management has to be off.
 * Left on, the browser would convert the PNG through a colour profile and
 * silently change every elevation value.
 */
async function loadTile(
  zoom: number,
  x: number,
  y: number,
  signal: AbortSignal | undefined,
): Promise<ImageBitmap | null> {
  const init = signal ? { signal } : {};
  const response = await fetch(`/api/dem/${zoom}/${x}/${y}.png`, init).catch(() => null);
  if (!response || !response.ok) return null;
  const blob = await response.blob().catch(() => null);
  if (!blob) return null;
  return createImageBitmap(blob, {
    colorSpaceConversion: "none",
    premultiplyAlpha: "none",
  }).catch(() => null);
}

async function runWithConcurrency(
  tasks: Array<() => Promise<void>>,
  limit: number,
): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    for (;;) {
      const index = next;
      next += 1;
      const task = tasks[index];
      if (!task) return;
      await task();
    }
  });
  await Promise.all(workers);
}

/**
 * Fetches the elevation tiles covering a view plus its sunward margin and
 * stitches them into one raster.
 */
export async function loadDem(
  request: DemRequest,
  signal?: AbortSignal,
): Promise<DemTexture | null> {
  const expanded = expandTowardsSun(
    boundsToMercator(request.bounds),
    request.sunAzimuth,
    request.sunAltitude,
  );
  const plan = planTiles(expanded, request.mapZoom);

  const width = plan.columns * TERRARIUM_TILE_SIZE;
  const height = plan.rows * TERRARIUM_TILE_SIZE;
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d", {
    willReadFrequently: true,
    colorSpace: "srgb",
  }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!context) return null;

  // Anywhere the source has no tile stays at sea level, so a gap in coverage
  // does not become a hole that cuts every ray passing through it short.
  context.fillStyle = SEA_LEVEL_FILL;
  context.fillRect(0, 0, width, height);

  const tasks: Array<() => Promise<void>> = [];
  for (let row = 0; row < plan.rows; row += 1) {
    for (let column = 0; column < plan.columns; column += 1) {
      tasks.push(async () => {
        const bitmap = await loadTile(
          plan.zoom,
          plan.minTileX + column,
          plan.minTileY + row,
          signal,
        );
        if (!bitmap) return;
        context.drawImage(bitmap, column * TERRARIUM_TILE_SIZE, row * TERRARIUM_TILE_SIZE);
        bitmap.close();
      });
    }
  }

  await runWithConcurrency(tasks, MAX_CONCURRENT_FETCHES);
  if (signal?.aborted) return null;

  const image = context.getImageData(0, 0, width, height);
  const pixels = new Uint8Array(image.data.buffer.slice(0));

  let maxElevation = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const elevation = decodeTerrarium(pixels[i] ?? 0, pixels[i + 1] ?? 0, pixels[i + 2] ?? 0);
    if (elevation > maxElevation) maxElevation = elevation;
  }

  const scale = 2 ** plan.zoom;
  return {
    pixels,
    width,
    height,
    originX: plan.minTileX / scale,
    originY: plan.minTileY / scale,
    spanX: plan.columns / scale,
    spanY: plan.rows / scale,
    maxElevation,
    zoom: plan.zoom,
    key: `${plan.zoom}/${plan.minTileX}/${plan.minTileY}/${plan.columns}x${plan.rows}`,
  };
}
