/**
 * Mapzen/AWS "Terrarium" elevation tiles pack metres above sea level into the
 * RGB channels of a PNG. This module is the single source of truth for that
 * encoding; the GLSL shader mirrors `decodeTerrarium` exactly.
 */

export const TERRARIUM_TILE_SIZE = 256;

/** Terrarium tiles are published for zoom 0 through 15. */
export const TERRARIUM_MAX_ZOOM = 15;

export const TERRARIUM_OFFSET = 32768;

/** Decodes one pixel of a Terrarium tile. Channels are 0-255. */
export function decodeTerrarium(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - TERRARIUM_OFFSET;
}

/**
 * Decodes an RGBA byte buffer into a Float32Array of metres.
 * Fully transparent pixels are treated as sea level, which is how the upstream
 * tiles represent ocean beyond the coastline mask.
 */
export function decodeTerrariumBuffer(rgba: Uint8ClampedArray | Uint8Array): Float32Array {
  const pixels = Math.floor(rgba.length / 4);
  const out = new Float32Array(pixels);
  for (let i = 0; i < pixels; i += 1) {
    const o = i * 4;
    if (rgba[o + 3] === 0) {
      out[i] = 0;
      continue;
    }
    out[i] = decodeTerrarium(rgba[o] ?? 0, rgba[o + 1] ?? 0, rgba[o + 2] ?? 0);
  }
  return out;
}

/** Highest elevation present in a decoded height buffer, floored at sea level. */
export function maxElevation(heights: Float32Array): number {
  let max = 0;
  for (let i = 0; i < heights.length; i += 1) {
    const h = heights[i] ?? 0;
    if (h > max) max = h;
  }
  return max;
}
