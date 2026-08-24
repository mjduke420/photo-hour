import { describe, expect, it } from "vitest";
import {
  decodeTerrarium,
  decodeTerrariumBuffer,
  maxElevation,
  TERRARIUM_OFFSET,
} from "../src/terrarium.js";

describe("decodeTerrarium", () => {
  it("decodes sea level", () => {
    expect(decodeTerrarium(128, 0, 0)).toBe(0);
  });

  it("decodes a fractional elevation", () => {
    expect(decodeTerrarium(128, 10, 128)).toBeCloseTo(10.5, 10);
  });

  it("decodes below sea level", () => {
    expect(decodeTerrarium(127, 255, 255)).toBeCloseTo(-0.00390625, 10);
  });

  it("decodes the extremes of the encoding range", () => {
    expect(decodeTerrarium(0, 0, 0)).toBe(-TERRARIUM_OFFSET);
    expect(decodeTerrarium(255, 255, 255)).toBeCloseTo(32767.996, 3);
  });

  it("decodes a plausible summit height", () => {
    expect(decodeTerrarium(162, 89, 0)).toBe(8793);
  });
});

describe("decodeTerrariumBuffer", () => {
  it("decodes every pixel in an RGBA buffer", () => {
    const rgba = new Uint8ClampedArray([128, 100, 0, 255, 128, 200, 128, 255]);
    const heights = decodeTerrariumBuffer(rgba);
    expect(Array.from(heights)).toEqual([100, 200.5]);
  });

  it("treats fully transparent pixels as sea level", () => {
    const rgba = new Uint8ClampedArray([200, 200, 200, 0]);
    expect(decodeTerrariumBuffer(rgba)[0]).toBe(0);
  });

  it("ignores a trailing partial pixel", () => {
    const rgba = new Uint8Array([128, 5, 0, 255, 128, 5]);
    expect(decodeTerrariumBuffer(rgba)).toHaveLength(1);
  });
});

describe("maxElevation", () => {
  it("finds the highest sample", () => {
    expect(maxElevation(Float32Array.from([10, 4000, 25]))).toBe(4000);
  });

  it("never reports below sea level", () => {
    expect(maxElevation(Float32Array.from([-100, -20]))).toBe(0);
  });

  it("handles an empty field", () => {
    expect(maxElevation(new Float32Array(0))).toBe(0);
  });
});
