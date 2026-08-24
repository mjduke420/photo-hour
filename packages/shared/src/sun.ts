import SunCalc from "suncalc";
import { normalizeRadians, radToDeg } from "./math.js";

export interface SunPosition {
  /** Angle above the horizon, in radians. Negative when the sun has set. */
  altitude: number;
  /** Compass bearing of the sun, in radians clockwise from true north. */
  azimuth: number;
  altitudeDeg: number;
  azimuthDeg: number;
  isUp: boolean;
}

/**
 * Angular radius of the solar disc as seen from earth (~0.265 degrees).
 * Shadow edges are softened across this angle to produce a realistic penumbra
 * instead of a hard binary edge.
 */
export const SOLAR_DISC_RADIUS_RAD = 0.00465;

/**
 * SunCalc reports azimuth in radians measured from due south, increasing
 * westward. Everything downstream wants a compass bearing from north, so the
 * conversion happens here once.
 */
export function sunPosition(date: Date, lat: number, lng: number): SunPosition {
  const { altitude, azimuth } = SunCalc.getPosition(date, lat, lng);
  const bearing = normalizeRadians(azimuth + Math.PI);
  return {
    altitude,
    azimuth: bearing,
    altitudeDeg: radToDeg(altitude),
    azimuthDeg: radToDeg(bearing),
    isUp: altitude > 0,
  };
}

/**
 * Horizontal unit vector pointing from an observer towards the sun, expressed
 * in mercator space where +x is east and +y is south.
 */
export function sunDirectionMercator(azimuth: number): { x: number; y: number } {
  return { x: Math.sin(azimuth), y: -Math.cos(azimuth) };
}

/**
 * Ground length of the shadow cast by a vertical object. Returns Infinity once
 * the sun is at or below the horizon, where no finite shadow exists.
 */
export function shadowLengthMeters(heightMeters: number, altitude: number): number {
  if (altitude <= 0) return Number.POSITIVE_INFINITY;
  return heightMeters / Math.tan(altitude);
}

/**
 * How far terrain outside the viewport can still reach into it, given the local
 * relief. Used to size the elevation-fetch margin around the visible bounds.
 */
export function shadowReachMeters(
  altitude: number,
  reliefMeters: number,
  maxMeters: number,
): number {
  const floorRad = 0.5 * (Math.PI / 180);
  const effective = Math.max(altitude, floorRad);
  return Math.min(maxMeters, reliefMeters / Math.tan(effective));
}
