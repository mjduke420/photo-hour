import { clamp, DEG, smoothstep } from "./math.js";
import {
  curvatureDropMeters,
  EARTH_CIRCUMFERENCE_M,
  mercatorToLngLat,
  type MercatorPoint,
} from "./mercator.js";
import { SOLAR_DISC_RADIUS_RAD, sunDirectionMercator } from "./sun.js";

/**
 * A queryable elevation surface in mercator space.
 *
 * This is the CPU twin of the elevation texture the shader samples. Keeping a
 * reference implementation here means the marching logic can be unit tested
 * against synthetic terrain, which a GLSL-only implementation could not be.
 */
export interface HeightField {
  /** Elevation in metres at a mercator point, or null when outside coverage. */
  sample(x: number, y: number): number | null;
  /** Highest elevation anywhere in the field, used to terminate rays early. */
  maxElevation: number;
}

export interface ShadowMarchOptions {
  /** Length of the first step along the ray, in metres. */
  baseStepMeters: number;
  /** Multiplier applied to the step length each iteration. */
  stepGrowth: number;
  maxSteps: number;
  maxDistanceMeters: number;
  /** Half-width of the penumbra, in radians. */
  solarDiscRadiusRad: number;
}

export const DEFAULT_MARCH_OPTIONS: ShadowMarchOptions = {
  baseStepMeters: 30,
  stepGrowth: 1.035,
  maxSteps: 256,
  maxDistanceMeters: 120000,
  solarDiscRadiusRad: SOLAR_DISC_RADIUS_RAD,
};

export interface SunVector {
  altitude: number;
  azimuth: number;
}

/**
 * Fraction of the solar disc hidden from a point by terrain, from 0 (full sun)
 * to 1 (fully shadowed).
 *
 * Walks towards the sun in geometrically growing steps, tracking the steepest
 * angle subtended by terrain along the way. That angle is compared against the
 * sun altitude across the width of the solar disc, which yields a soft penumbra
 * rather than a hard binary edge.
 */
export function shadowFactor(
  field: HeightField,
  origin: MercatorPoint,
  sun: SunVector,
  options: ShadowMarchOptions = DEFAULT_MARCH_OPTIONS,
): number {
  const discRadius = options.solarDiscRadiusRad;

  // The sun is fully below the horizon: everything is in shadow.
  if (sun.altitude <= -discRadius) return 1;

  const originHeight = field.sample(origin.x, origin.y);
  if (originHeight === null) return 0;

  const { lat } = mercatorToLngLat(origin);
  const metersPerMercatorUnit = EARTH_CIRCUMFERENCE_M * Math.cos(lat * DEG);
  if (!(metersPerMercatorUnit > 0)) return 0;

  const direction = sunDirectionMercator(sun.azimuth);
  const upperBound = sun.altitude + discRadius;
  const lowerBound = sun.altitude - discRadius;

  let steepestBlockingAngle = -Math.PI / 2;
  let distance = 0;
  let step = options.baseStepMeters;

  for (let i = 0; i < options.maxSteps; i += 1) {
    distance += step;
    step *= options.stepGrowth;
    if (distance > options.maxDistanceMeters) break;

    // Once the *bottom* of the solar disc clears the highest terrain in the
    // field, no terrain further along the ray can block any part of the disc.
    // Testing against the top of the disc instead would be wrong: terrain
    // between the two bounds still produces partial shadow.
    if (originHeight + distance * Math.tan(lowerBound) > field.maxElevation) break;

    const offset = distance / metersPerMercatorUnit;
    const height = field.sample(
      origin.x + direction.x * offset,
      origin.y + direction.y * offset,
    );
    if (height === null) break;

    const apparent = height - curvatureDropMeters(distance);
    if (apparent <= originHeight) continue;

    const angle = Math.atan2(apparent - originHeight, distance);
    if (angle > steepestBlockingAngle) {
      steepestBlockingAngle = angle;
      if (steepestBlockingAngle >= upperBound) return 1;
    }
  }

  return smoothstep(lowerBound, upperBound, steepestBlockingAngle);
}

export interface GridHeightFieldSpec {
  heights: Float32Array;
  width: number;
  height: number;
  /** Mercator coordinate of the top-left corner of the grid. */
  originX: number;
  originY: number;
  /** Mercator extent covered by the grid. */
  spanX: number;
  spanY: number;
  maxElevation: number;
}

/** Rounding slack allowed when deciding whether a point sits on the edge. */
const EDGE_TOLERANCE = 1e-9;

export interface BilinearHeightFieldSpec extends Omit<GridHeightFieldSpec, "heights"> {
  /** Elevation in metres at integer raster coordinates. Never called out of bounds. */
  read(column: number, row: number): number;
}

/**
 * Bilinear elevation lookup over a raster, matching the smoothing the shader
 * applies when it samples the DEM texture.
 *
 * Taking a reader callback rather than a materialised array lets a caller that
 * already holds packed bytes decode only the four texels a query touches,
 * without duplicating this interpolation.
 */
export function createBilinearHeightField(spec: BilinearHeightFieldSpec): HeightField {
  const { read, width, height, originX, originY, spanX, spanY } = spec;

  const at = (column: number, row: number): number => {
    const c = column < 0 ? 0 : column > width - 1 ? width - 1 : column;
    const r = row < 0 ? 0 : row > height - 1 ? height - 1 : row;
    return read(c, r);
  };

  return {
    maxElevation: spec.maxElevation,
    sample(x: number, y: number): number | null {
      const u = (x - originX) / spanX;
      const v = (y - originY) / spanY;
      // The far edge is inside the coverage, but subtracting two nearby
      // mercator values leaves rounding error, so a point exactly on that edge
      // can land a hair past 1. Tolerate that instead of reporting no data.
      if (u < -EDGE_TOLERANCE || u > 1 + EDGE_TOLERANCE) return null;
      if (v < -EDGE_TOLERANCE || v > 1 + EDGE_TOLERANCE) return null;

      const fx = clamp(u, 0, 1) * (width - 1);
      const fy = clamp(v, 0, 1) * (height - 1);
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;

      const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
      const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
      return top * (1 - ty) + bottom * ty;
    },
  };
}

/** Bilinear elevation lookup over a decoded elevation grid. */
export function createGridHeightField(spec: GridHeightFieldSpec): HeightField {
  const { heights, width } = spec;
  return createBilinearHeightField({
    ...spec,
    read: (column, row) => heights[row * width + column] ?? 0,
  });
}
