import { degToRad, mercatorToLngLat } from "@photo-hour/shared";
import { describe, expect, it } from "vitest";
import type { DemTexture } from "../src/map/demStitcher.js";
import { heightFieldFromDem, lightAtPoint } from "../src/map/pinShadow.js";

/** Packs metres into the Terrarium RGB encoding the tiles use. */
function encode(metres: number): [number, number, number] {
  const raw = metres + 32768;
  const red = Math.floor(raw / 256);
  const remainder = raw - red * 256;
  const green = Math.floor(remainder);
  const blue = Math.round((remainder - green) * 256);
  return [red, green, blue];
}

const ORIGIN_X = 0.5;
const ORIGIN_Y = 0.5;
const SPAN = 0.0002;

function makeDem(heights: number[][], alpha = 255): DemTexture {
  const height = heights.length;
  const width = heights[0]?.length ?? 0;
  const pixels = new Uint8Array(width * height * 4);

  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const [red, green, blue] = encode(heights[row]?.[column] ?? 0);
      const offset = (row * width + column) * 4;
      pixels[offset] = red;
      pixels[offset + 1] = green;
      pixels[offset + 2] = blue;
      pixels[offset + 3] = alpha;
    }
  }

  return {
    pixels,
    width,
    height,
    originX: ORIGIN_X,
    originY: ORIGIN_Y,
    spanX: SPAN,
    spanY: SPAN,
    maxElevation: Math.max(...heights.flat(), 0),
    zoom: 13,
    key: "test",
  };
}

/** A point at a fractional position inside the synthetic tile. */
function pointAt(u: number, v: number) {
  return mercatorToLngLat({ x: ORIGIN_X + SPAN * u, y: ORIGIN_Y + SPAN * v });
}

describe("heightFieldFromDem", () => {
  it("decodes elevations straight out of the packed bytes", () => {
    const field = heightFieldFromDem(makeDem([[0, 1000], [2000, 3000]]));
    expect(field.sample(ORIGIN_X, ORIGIN_Y)).toBeCloseTo(0, 2);
    expect(field.sample(ORIGIN_X + SPAN, ORIGIN_Y)).toBeCloseTo(1000, 2);
    expect(field.sample(ORIGIN_X, ORIGIN_Y + SPAN)).toBeCloseTo(2000, 2);
  });

  it("interpolates between samples", () => {
    const field = heightFieldFromDem(makeDem([[0, 1000], [0, 1000]]));
    expect(field.sample(ORIGIN_X + SPAN / 2, ORIGIN_Y)).toBeCloseTo(500, 1);
  });

  it("reports null outside the covered tile", () => {
    const field = heightFieldFromDem(makeDem([[0, 0], [0, 0]]));
    expect(field.sample(ORIGIN_X - 0.001, ORIGIN_Y)).toBeNull();
  });

  it("treats a fully transparent pixel as sea level", () => {
    const field = heightFieldFromDem(makeDem([[4000, 4000], [4000, 4000]], 0));
    expect(field.sample(ORIGIN_X, ORIGIN_Y)).toBe(0);
  });
});

describe("lightAtPoint", () => {
  const flat = makeDem([
    [100, 100, 100, 100],
    [100, 100, 100, 100],
    [100, 100, 100, 100],
    [100, 100, 100, 100],
  ]);

  it("returns nothing before any terrain has loaded", () => {
    expect(lightAtPoint(null, pointAt(0.5, 0.5), { altitude: 1, azimuth: 1 })).toBeNull();
  });

  it("returns nothing for a point outside the loaded terrain", () => {
    const outside = mercatorToLngLat({ x: ORIGIN_X - 0.01, y: ORIGIN_Y });
    expect(lightAtPoint(flat, outside, { altitude: 1, azimuth: 1 })).toBeNull();
  });

  it("reports flat ground under a high sun as lit", () => {
    const light = lightAtPoint(flat, pointAt(0.5, 0.5), {
      altitude: degToRad(45),
      azimuth: degToRad(180),
    });
    expect(light?.shadow).toBe(0);
    expect(light?.elevation).toBeCloseTo(100, 1);
  });

  it("reports everything as shadowed once the sun has set", () => {
    const light = lightAtPoint(flat, pointAt(0.5, 0.5), {
      altitude: degToRad(-5),
      azimuth: degToRad(270),
    });
    expect(light?.shadow).toBe(1);
  });

  it("shadows a low point that has high ground towards the sun", () => {
    // A wall along the eastern edge, with the query point in the west.
    const ridge = makeDem([
      [0, 0, 0, 3000],
      [0, 0, 0, 3000],
      [0, 0, 0, 3000],
      [0, 0, 0, 3000],
    ]);
    const east = { altitude: degToRad(4), azimuth: degToRad(90) };
    const west = { altitude: degToRad(4), azimuth: degToRad(270) };

    expect(lightAtPoint(ridge, pointAt(0.1, 0.5), east)?.shadow).toBe(1);
    // The same ridge cannot shade anything when the sun is behind the viewer.
    expect(lightAtPoint(ridge, pointAt(0.1, 0.5), west)?.shadow).toBe(0);
  });
});
