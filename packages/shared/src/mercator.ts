import { clamp, DEG, RAD } from "./math.js";

/** Length of the equator in metres (WGS84 sphere used by Web Mercator). */
export const EARTH_CIRCUMFERENCE_M = 40075016.686;

/** Mean earth radius in metres. */
export const EARTH_RADIUS_M = 6371008.8;

/**
 * Effective earth radius used when correcting for the apparent drop of distant
 * terrain. The 7/6 factor is the standard atmospheric-refraction allowance used
 * in line-of-sight and viewshed calculations.
 */
export const REFRACTED_EARTH_RADIUS_M = (EARTH_RADIUS_M * 7) / 6;

/** Latitude beyond which Web Mercator is undefined. */
export const MAX_MERCATOR_LATITUDE = 85.051129;

export interface LngLat {
  lng: number;
  lat: number;
}

/** A point in MapLibre mercator space, where the whole world spans 0..1. */
export interface MercatorPoint {
  x: number;
  y: number;
}

export function clampLatitude(lat: number): number {
  return clamp(lat, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);
}

export function lngLatToMercator({ lng, lat }: LngLat): MercatorPoint {
  const clamped = clampLatitude(lat);
  const x = (180 + lng) / 360;
  const y = 0.5 - Math.log(Math.tan(Math.PI / 4 + (clamped * DEG) / 2)) / (2 * Math.PI);
  return { x, y };
}

export function mercatorToLngLat({ x, y }: MercatorPoint): LngLat {
  const lng = x * 360 - 180;
  const lat = (2 * Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) - Math.PI / 2) * RAD;
  return { lng, lat };
}

/**
 * Web Mercator is conformal, so one mercator unit maps to the same ground
 * distance in every direction at a given latitude - but that distance shrinks
 * towards the poles by cos(lat).
 */
export function mercatorUnitsToMeters(units: number, lat: number): number {
  return units * EARTH_CIRCUMFERENCE_M * Math.cos(clampLatitude(lat) * DEG);
}

export function metersToMercatorUnits(meters: number, lat: number): number {
  return meters / (EARTH_CIRCUMFERENCE_M * Math.cos(clampLatitude(lat) * DEG));
}

/** Ground resolution in metres per screen pixel at a given latitude and zoom. */
export function metersPerPixel(lat: number, zoom: number, tileSize = 256): number {
  return (EARTH_CIRCUMFERENCE_M * Math.cos(clampLatitude(lat) * DEG)) / (tileSize * 2 ** zoom);
}

/**
 * How far distant terrain appears to drop below a flat plane, in metres, after
 * accounting for earth curvature and atmospheric refraction.
 */
export function curvatureDropMeters(distanceMeters: number): number {
  return (distanceMeters * distanceMeters) / (2 * REFRACTED_EARTH_RADIUS_M);
}
