import {
  createBilinearHeightField,
  decodeTerrarium,
  lngLatToMercator,
  shadowFactor,
  type HeightField,
  type SunVector,
} from "@photo-hour/shared";
import type { DemTexture } from "./demStitcher.js";

/**
 * Reads elevation straight out of the packed tile bytes.
 *
 * A point query touches four texels, so decoding the whole raster into floats
 * first would waste several megabytes and a full pass over it for one answer.
 */
export function heightFieldFromDem(dem: DemTexture): HeightField {
  const { pixels, width } = dem;

  return createBilinearHeightField({
    width: dem.width,
    height: dem.height,
    originX: dem.originX,
    originY: dem.originY,
    spanX: dem.spanX,
    spanY: dem.spanY,
    maxElevation: dem.maxElevation,
    read(column, row) {
      const offset = (row * width + column) * 4;
      if (pixels[offset + 3] === 0) return 0;
      return decodeTerrarium(
        pixels[offset] ?? 0,
        pixels[offset + 1] ?? 0,
        pixels[offset + 2] ?? 0,
      );
    },
  });
}

export interface PointLight {
  /** 0 in full sun, 1 fully shadowed, in between during the penumbra. */
  shadow: number;
  elevation: number | null;
}

/**
 * Whether one specific spot is lit, answered on the CPU.
 *
 * The overlay already shades the whole view, but a photographer standing at a
 * chosen spot wants a straight answer about that spot, and the GPU raster is
 * not readable without an expensive pixel read-back.
 */
export function lightAtPoint(
  dem: DemTexture | null,
  point: { lng: number; lat: number },
  sun: SunVector,
): PointLight | null {
  if (!dem) return null;

  const field = heightFieldFromDem(dem);
  const mercator = lngLatToMercator(point);
  const elevation = field.sample(mercator.x, mercator.y);
  if (elevation === null) return null;

  return { shadow: shadowFactor(field, mercator, sun), elevation };
}
