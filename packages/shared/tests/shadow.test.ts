import { describe, expect, it } from "vitest";
import { degToRad } from "../src/math.js";
import { EARTH_CIRCUMFERENCE_M } from "../src/mercator.js";
import {
  createGridHeightField,
  DEFAULT_MARCH_OPTIONS,
  shadowFactor,
  type HeightField,
} from "../src/shadow.js";

/** Mercator origin at lng 0, lat 0, where one mercator unit is the full equator. */
const ORIGIN = { x: 0.5, y: 0.5 };
const COVERAGE = 0.01;

const EAST = degToRad(90);
const WEST = degToRad(270);

function inCoverage(x: number, y: number): boolean {
  return Math.abs(x - ORIGIN.x) <= COVERAGE && Math.abs(y - ORIGIN.y) <= COVERAGE;
}

/** Flat ground at sea level for as far as the ray can see. */
const FLAT: HeightField = {
  maxElevation: 0,
  sample: (x, y) => (inCoverage(x, y) ? 0 : null),
};

/** A vertical wall of terrain starting a fixed distance due east of the origin. */
function eastWall(startMeters: number, wallHeight: number): HeightField {
  return {
    maxElevation: wallHeight,
    sample(x, y) {
      if (!inCoverage(x, y)) return null;
      const eastMeters = (x - ORIGIN.x) * EARTH_CIRCUMFERENCE_M;
      return eastMeters >= startMeters ? wallHeight : 0;
    },
  };
}

describe("shadowFactor", () => {
  it("leaves flat ground fully lit", () => {
    expect(shadowFactor(FLAT, ORIGIN, { altitude: degToRad(30), azimuth: EAST })).toBe(0);
  });

  it("shadows everything once the sun is below the horizon", () => {
    expect(shadowFactor(FLAT, ORIGIN, { altitude: degToRad(-1), azimuth: EAST })).toBe(1);
  });

  it("returns lit for a point outside the elevation coverage", () => {
    const outside = { x: 0.9, y: 0.9 };
    expect(shadowFactor(FLAT, outside, { altitude: degToRad(30), azimuth: EAST })).toBe(0);
  });

  it("shadows a point when terrain towards the sun is steeper than the sun", () => {
    // A 100 m wall 1 km away subtends about 5.7 degrees.
    const field = eastWall(1000, 100);
    expect(shadowFactor(field, ORIGIN, { altitude: degToRad(3), azimuth: EAST })).toBe(1);
  });

  it("lights a point when the sun clears the terrain towards it", () => {
    const field = eastWall(1000, 100);
    expect(shadowFactor(field, ORIGIN, { altitude: degToRad(8), azimuth: EAST })).toBe(0);
  });

  it("ignores terrain that is not between the point and the sun", () => {
    // Same eastern wall, but the sun is now in the west.
    const field = eastWall(1000, 100);
    expect(shadowFactor(field, ORIGIN, { altitude: degToRad(3), azimuth: WEST })).toBe(0);
  });

  it("softens the shadow edge across the width of the solar disc", () => {
    const field = eastWall(1000, 100);
    const partials: number[] = [];
    for (let deg = 5; deg <= 6.5; deg += 0.02) {
      const factor = shadowFactor(field, ORIGIN, { altitude: degToRad(deg), azimuth: EAST });
      if (factor > 0 && factor < 1) partials.push(factor);
    }
    expect(partials.length).toBeGreaterThan(0);
  });

  it("never increases as the sun rises", () => {
    const field = eastWall(1000, 100);
    let previous = 1;
    for (let deg = 0.5; deg <= 20; deg += 0.25) {
      const factor = shadowFactor(field, ORIGIN, { altitude: degToRad(deg), azimuth: EAST });
      expect(factor).toBeLessThanOrEqual(previous + 1e-9);
      previous = factor;
    }
    expect(previous).toBe(0);
  });

  it("lets a distant mountain cast onto the point at a low sun", () => {
    // A 1000 m ridge 50 km east still subtends about 0.95 degrees after curvature.
    const field = eastWall(50000, 1000);
    expect(shadowFactor(field, ORIGIN, { altitude: degToRad(0.5), azimuth: EAST })).toBe(1);
    expect(shadowFactor(field, ORIGIN, { altitude: degToRad(2), azimuth: EAST })).toBe(0);
  });

  it("ignores distant terrain that is too low to reach the ray", () => {
    const field = eastWall(50000, 100);
    expect(shadowFactor(field, ORIGIN, { altitude: degToRad(0.5), azimuth: EAST })).toBe(0);
  });

  it("weakens a distant shadow because curvature drops the horizon away", () => {
    // A 1000 m ridge 50 km east subtends 1.15 degrees on a flat earth, but only
    // 0.95 degrees once the 168 m curvature drop is applied. At a sun altitude
    // of 1 degree that is the difference between mostly shadowed and mostly lit:
    // a flat-earth model would report well above 0.8 here.
    const field = eastWall(50000, 1000);
    const factor = shadowFactor(field, ORIGIN, { altitude: degToRad(1), azimuth: EAST });
    expect(factor).toBeGreaterThan(0.15);
    expect(factor).toBeLessThan(0.6);
  });

  it("stops marching at the configured maximum distance", () => {
    const field = eastWall(80000, 3000);
    const nearby = shadowFactor(field, ORIGIN, { altitude: degToRad(0.5), azimuth: EAST });
    const truncated = shadowFactor(
      field,
      ORIGIN,
      { altitude: degToRad(0.5), azimuth: EAST },
      { ...DEFAULT_MARCH_OPTIONS, maxDistanceMeters: 20000 },
    );
    expect(nearby).toBe(1);
    expect(truncated).toBe(0);
  });
});

describe("createGridHeightField", () => {
  const spec = {
    heights: Float32Array.from([0, 100, 200, 300]),
    width: 2,
    height: 2,
    originX: 0,
    originY: 0,
    spanX: 1,
    spanY: 1,
    maxElevation: 300,
  };

  it("returns exact values at the grid corners", () => {
    const field = createGridHeightField(spec);
    expect(field.sample(0, 0)).toBeCloseTo(0, 6);
    expect(field.sample(1, 0)).toBeCloseTo(100, 6);
    expect(field.sample(0, 1)).toBeCloseTo(200, 6);
    expect(field.sample(1, 1)).toBeCloseTo(300, 6);
  });

  it("interpolates between samples", () => {
    const field = createGridHeightField(spec);
    expect(field.sample(0.5, 0)).toBeCloseTo(50, 6);
    expect(field.sample(0.5, 0.5)).toBeCloseTo(150, 6);
  });

  it("reports null outside the covered extent", () => {
    const field = createGridHeightField(spec);
    expect(field.sample(-0.01, 0.5)).toBeNull();
    expect(field.sample(0.5, 1.01)).toBeNull();
  });

  it("exposes the maximum elevation for ray termination", () => {
    expect(createGridHeightField(spec).maxElevation).toBe(300);
  });
});
