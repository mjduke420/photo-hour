import { describe, expect, it } from "vitest";
import { clamp, lerp, normalizeDegrees, normalizeRadians, smoothstep } from "../src/math.js";

describe("clamp", () => {
  it("bounds a value on both sides", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

describe("normalizeRadians", () => {
  it("wraps negative angles into the positive range", () => {
    expect(normalizeRadians(-Math.PI / 2)).toBeCloseTo((3 * Math.PI) / 2, 10);
  });

  it("wraps angles beyond a full turn", () => {
    expect(normalizeRadians(Math.PI * 2 + 0.25)).toBeCloseTo(0.25, 10);
  });

  it("leaves in-range angles untouched", () => {
    expect(normalizeRadians(1)).toBeCloseTo(1, 10);
  });
});

describe("normalizeDegrees", () => {
  it("wraps into [0, 360)", () => {
    expect(normalizeDegrees(-90)).toBe(270);
    expect(normalizeDegrees(450)).toBe(90);
    expect(normalizeDegrees(0)).toBe(0);
  });
});

describe("smoothstep", () => {
  it("saturates outside the edges", () => {
    expect(smoothstep(0, 1, -0.5)).toBe(0);
    expect(smoothstep(0, 1, 1.5)).toBe(1);
  });

  it("returns one half at the midpoint", () => {
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 10);
  });

  it("degrades to a step when the edges coincide", () => {
    expect(smoothstep(2, 2, 1.9)).toBe(0);
    expect(smoothstep(2, 2, 2.1)).toBe(1);
  });
});

describe("lerp", () => {
  it("interpolates between endpoints", () => {
    expect(lerp(10, 20, 0.25)).toBeCloseTo(12.5, 10);
  });
});
