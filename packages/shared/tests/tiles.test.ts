import { describe, expect, it } from "vitest";
import {
  isValidTile,
  lngLatToTileFraction,
  tileRangeForBounds,
  tileRangeSize,
  tileToLngLat,
  tilesAtZoom,
  wrapTileX,
} from "../src/tiles.js";

describe("tilesAtZoom", () => {
  it("doubles per zoom level", () => {
    expect(tilesAtZoom(0)).toBe(1);
    expect(tilesAtZoom(10)).toBe(1024);
  });
});

describe("lngLatToTileFraction", () => {
  it("puts the null island at the meeting point of the four zoom-1 tiles", () => {
    const { x, y } = lngLatToTileFraction({ lng: 0, lat: 0 }, 1);
    expect(x).toBeCloseTo(1, 10);
    expect(y).toBeCloseTo(1, 10);
  });

  it("round-trips through tileToLngLat", () => {
    const original = { lng: -75.6972, lat: 45.4215 };
    const frac = lngLatToTileFraction(original, 12);
    const back = tileToLngLat(frac.x, frac.y, 12);
    expect(back.lng).toBeCloseTo(original.lng, 9);
    expect(back.lat).toBeCloseTo(original.lat, 9);
  });
});

describe("wrapTileX", () => {
  it("wraps across the antimeridian in both directions", () => {
    expect(wrapTileX(-1, 3)).toBe(7);
    expect(wrapTileX(8, 3)).toBe(0);
    expect(wrapTileX(3, 3)).toBe(3);
  });
});

describe("isValidTile", () => {
  it("accepts in-range integer coordinates", () => {
    expect(isValidTile({ z: 3, x: 0, y: 7 }, 15)).toBe(true);
  });

  it("rejects coordinates outside the pyramid", () => {
    expect(isValidTile({ z: 3, x: 8, y: 0 }, 15)).toBe(false);
    expect(isValidTile({ z: 3, x: 0, y: -1 }, 15)).toBe(false);
  });

  it("rejects zoom levels beyond the source maximum", () => {
    expect(isValidTile({ z: 16, x: 0, y: 0 }, 15)).toBe(false);
    expect(isValidTile({ z: -1, x: 0, y: 0 }, 15)).toBe(false);
  });

  it("rejects non-integer coordinates", () => {
    expect(isValidTile({ z: 3, x: 1.5, y: 0 }, 15)).toBe(false);
    expect(isValidTile({ z: 3, x: Number.NaN, y: 0 }, 15)).toBe(false);
  });
});

describe("tileRangeForBounds", () => {
  it("covers a bounding box with north-west first", () => {
    const range = tileRangeForBounds(
      { west: -76, south: 45, east: -75, north: 46 },
      10,
    );
    expect(range.minX).toBeLessThanOrEqual(range.maxX);
    expect(range.minY).toBeLessThanOrEqual(range.maxY);

    const northWest = lngLatToTileFraction({ lng: -76, lat: 46 }, 10);
    expect(range.minX).toBe(Math.floor(northWest.x));
    expect(range.minY).toBe(Math.floor(northWest.y));
  });

  it("reports the tile count for a range", () => {
    const size = tileRangeSize({ z: 5, minX: 2, maxX: 4, minY: 10, maxY: 11 });
    expect(size).toEqual({ width: 3, height: 2, count: 6 });
  });

  it("clamps rows to the tile pyramid near the poles", () => {
    const range = tileRangeForBounds(
      { west: -10, south: -89, east: 10, north: 89 },
      4,
    );
    expect(range.minY).toBeGreaterThanOrEqual(0);
    expect(range.maxY).toBeLessThanOrEqual(tilesAtZoom(4) - 1);
  });
});
