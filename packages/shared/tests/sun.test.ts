import { describe, expect, it } from "vitest";
import {
  shadowLengthMeters,
  shadowReachMeters,
  sunDirectionMercator,
  sunPosition,
  SOLAR_DISC_RADIUS_RAD,
} from "../src/sun.js";
import { radToDeg } from "../src/math.js";

const OTTAWA = { lat: 45.4215, lng: -75.6972 };

/** Scans a UTC day at one-minute resolution and returns the highest sun. */
function highestSunOfDay(dateISO: string, lat: number, lng: number) {
  let best = sunPosition(new Date(`${dateISO}T00:00:00Z`), lat, lng);
  for (let minute = 1; minute < 1440; minute += 1) {
    const at = new Date(`${dateISO}T00:00:00Z`);
    at.setUTCMinutes(minute);
    const position = sunPosition(at, lat, lng);
    if (position.altitude > best.altitude) best = position;
  }
  return best;
}

describe("sunPosition", () => {
  it("reaches the geometrically expected altitude at the summer solstice", () => {
    // Maximum altitude equals 90 - latitude + declination (23.44 at solstice).
    const peak = highestSunOfDay("2026-06-21", OTTAWA.lat, OTTAWA.lng);
    expect(peak.altitudeDeg).toBeCloseTo(90 - OTTAWA.lat + 23.44, 0);
  });

  it("puts the midday sun due south in the northern hemisphere", () => {
    const peak = highestSunOfDay("2026-06-21", OTTAWA.lat, OTTAWA.lng);
    expect(peak.azimuthDeg).toBeGreaterThan(178);
    expect(peak.azimuthDeg).toBeLessThan(182);
  });

  it("puts the midday sun due north in the southern hemisphere", () => {
    const peak = highestSunOfDay("2026-06-21", -33.87, 151.21);
    expect(Math.min(peak.azimuthDeg, 360 - peak.azimuthDeg)).toBeLessThan(3);
  });

  it("reaches the expected lower altitude at the winter solstice", () => {
    const peak = highestSunOfDay("2026-12-21", OTTAWA.lat, OTTAWA.lng);
    expect(peak.altitudeDeg).toBeCloseTo(90 - OTTAWA.lat - 23.44, 0);
  });

  it("reports a compass bearing in the range zero to 360", () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const at = new Date(Date.UTC(2026, 7, 24, hour));
      const position = sunPosition(at, OTTAWA.lat, OTTAWA.lng);
      expect(position.azimuthDeg).toBeGreaterThanOrEqual(0);
      expect(position.azimuthDeg).toBeLessThan(360);
    }
  });

  it("marks the sun as down at local midnight", () => {
    const midnight = new Date("2026-08-24T04:00:00Z");
    expect(sunPosition(midnight, OTTAWA.lat, OTTAWA.lng).isUp).toBe(false);
  });

  it("keeps the sun above the horizon all day inside the arctic circle in June", () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const at = new Date(Date.UTC(2026, 5, 21, hour));
      expect(sunPosition(at, 78.22, 15.63).altitude).toBeGreaterThan(0);
    }
  });
});

describe("sunDirectionMercator", () => {
  it("points north for a bearing of zero, where mercator y decreases", () => {
    const north = sunDirectionMercator(0);
    expect(north.x).toBeCloseTo(0, 12);
    expect(north.y).toBeCloseTo(-1, 12);
  });

  it("points east for a bearing of ninety degrees", () => {
    const east = sunDirectionMercator(Math.PI / 2);
    expect(east.x).toBeCloseTo(1, 12);
    expect(east.y).toBeCloseTo(0, 12);
  });

  it("points south for a bearing of 180 degrees", () => {
    const south = sunDirectionMercator(Math.PI);
    expect(south.y).toBeCloseTo(1, 12);
  });
});

describe("shadowLengthMeters", () => {
  it("matches the object height when the sun sits at 45 degrees", () => {
    expect(shadowLengthMeters(10, Math.PI / 4)).toBeCloseTo(10, 9);
  });

  it("lengthens as the sun drops", () => {
    expect(shadowLengthMeters(10, Math.PI / 12)).toBeGreaterThan(
      shadowLengthMeters(10, Math.PI / 4),
    );
  });

  it("is unbounded once the sun is on or below the horizon", () => {
    expect(shadowLengthMeters(10, 0)).toBe(Number.POSITIVE_INFINITY);
    expect(shadowLengthMeters(10, -0.1)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("shadowReachMeters", () => {
  it("derives the reach from relief and sun altitude", () => {
    expect(shadowReachMeters(Math.PI / 6, 1000, 50000)).toBeCloseTo(1732.05, 1);
  });

  it("caps the reach for a sun on the horizon", () => {
    expect(shadowReachMeters(0, 1000, 50000)).toBe(50000);
  });
});

describe("SOLAR_DISC_RADIUS_RAD", () => {
  it("is about a quarter of a degree", () => {
    expect(radToDeg(SOLAR_DISC_RADIUS_RAD)).toBeCloseTo(0.266, 2);
  });
});
