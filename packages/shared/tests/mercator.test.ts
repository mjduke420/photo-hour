import { describe, expect, it } from "vitest";
import {
  clampLatitude,
  curvatureDropMeters,
  EARTH_CIRCUMFERENCE_M,
  lngLatToMercator,
  MAX_MERCATOR_LATITUDE,
  mercatorToLngLat,
  mercatorUnitsToMeters,
  metersPerPixel,
  metersToMercatorUnits,
} from "../src/mercator.js";

describe("lngLatToMercator", () => {
  it("places the null island at the centre of the unit square", () => {
    expect(lngLatToMercator({ lng: 0, lat: 0 })).toEqual({ x: 0.5, y: 0.5 });
  });

  it("places the antimeridian at the left and right edges", () => {
    expect(lngLatToMercator({ lng: -180, lat: 0 }).x).toBeCloseTo(0, 12);
    expect(lngLatToMercator({ lng: 180, lat: 0 }).x).toBeCloseTo(1, 12);
  });

  it("increases y towards the south", () => {
    const north = lngLatToMercator({ lng: 0, lat: 45 });
    const south = lngLatToMercator({ lng: 0, lat: -45 });
    expect(north.y).toBeLessThan(0.5);
    expect(south.y).toBeGreaterThan(0.5);
  });

  it("clamps beyond the mercator latitude limit", () => {
    const beyond = lngLatToMercator({ lng: 0, lat: 89 });
    const atLimit = lngLatToMercator({ lng: 0, lat: MAX_MERCATOR_LATITUDE });
    expect(beyond.y).toBeCloseTo(atLimit.y, 12);
  });
});

describe("mercatorToLngLat", () => {
  it("round-trips a range of coordinates", () => {
    for (const lat of [-80, -45, -0.001, 0, 12.34, 45, 80]) {
      for (const lng of [-179, -75.6972, 0, 8.5417, 174]) {
        const back = mercatorToLngLat(lngLatToMercator({ lng, lat }));
        expect(back.lng).toBeCloseTo(lng, 9);
        expect(back.lat).toBeCloseTo(lat, 9);
      }
    }
  });
});

describe("clampLatitude", () => {
  it("limits to the mercator extent", () => {
    expect(clampLatitude(90)).toBe(MAX_MERCATOR_LATITUDE);
    expect(clampLatitude(-90)).toBe(-MAX_MERCATOR_LATITUDE);
    expect(clampLatitude(10)).toBe(10);
  });
});

describe("mercatorUnitsToMeters", () => {
  it("maps one full unit to the equator length at the equator", () => {
    expect(mercatorUnitsToMeters(1, 0)).toBeCloseTo(EARTH_CIRCUMFERENCE_M, 6);
  });

  it("shrinks by cos(lat) towards the poles", () => {
    expect(mercatorUnitsToMeters(1, 60)).toBeCloseTo(EARTH_CIRCUMFERENCE_M / 2, 3);
  });

  it("inverts cleanly", () => {
    const meters = 1234.5;
    expect(mercatorUnitsToMeters(metersToMercatorUnits(meters, 51.5), 51.5)).toBeCloseTo(
      meters,
      6,
    );
  });
});

describe("metersPerPixel", () => {
  it("matches the known zoom 0 equator resolution", () => {
    expect(metersPerPixel(0, 0)).toBeCloseTo(156543.03, 2);
  });

  it("halves with each zoom level", () => {
    expect(metersPerPixel(45, 11)).toBeCloseTo(metersPerPixel(45, 10) / 2, 9);
  });
});

describe("curvatureDropMeters", () => {
  it("matches the standard refraction-corrected drop at ten kilometres", () => {
    expect(curvatureDropMeters(10000)).toBeCloseTo(6.73, 2);
  });

  it("grows with the square of distance", () => {
    expect(curvatureDropMeters(20000)).toBeCloseTo(curvatureDropMeters(10000) * 4, 6);
  });
});
