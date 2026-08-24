import { degToRad, lngLatToMercator } from "@photo-hour/shared";
import { describe, expect, it } from "vitest";
import { boundsToMercator, expandTowardsSun, planTiles } from "../src/map/demStitcher.js";

const VIEW = { west: -116.3, south: 51.25, east: -116.05, north: 51.4 };

describe("boundsToMercator", () => {
  it("orders the box with the north-west corner at the minimum", () => {
    const box = boundsToMercator(VIEW);
    expect(box.minX).toBeLessThan(box.maxX);
    // Mercator y grows southward, so the northern edge is the smaller value.
    expect(box.minY).toBeLessThan(box.maxY);
    expect(box.minY).toBeCloseTo(lngLatToMercator({ lng: VIEW.west, lat: VIEW.north }).y, 12);
  });
});

describe("expandTowardsSun", () => {
  const box = boundsToMercator(VIEW);
  const lowSun = degToRad(5);

  it("extends only eastward for a sun in the east", () => {
    const grown = expandTowardsSun(box, degToRad(90), lowSun);
    expect(grown.maxX).toBeGreaterThan(box.maxX);
    expect(grown.minX).toBeCloseTo(box.minX, 12);
    expect(grown.minY).toBeCloseTo(box.minY, 12);
    expect(grown.maxY).toBeCloseTo(box.maxY, 12);
  });

  it("extends only westward for a sun in the west", () => {
    const grown = expandTowardsSun(box, degToRad(270), lowSun);
    expect(grown.minX).toBeLessThan(box.minX);
    expect(grown.maxX).toBeCloseTo(box.maxX, 12);
  });

  it("extends the northern edge for a sun in the north", () => {
    const grown = expandTowardsSun(box, degToRad(0), lowSun);
    expect(grown.minY).toBeLessThan(box.minY);
    expect(grown.maxY).toBeCloseTo(box.maxY, 12);
  });

  it("extends the southern edge for a sun in the south", () => {
    const grown = expandTowardsSun(box, degToRad(180), lowSun);
    expect(grown.maxY).toBeGreaterThan(box.maxY);
    expect(grown.minY).toBeCloseTo(box.minY, 12);
  });

  it("reaches further for a lower sun", () => {
    const low = expandTowardsSun(box, degToRad(90), degToRad(2));
    const high = expandTowardsSun(box, degToRad(90), degToRad(60));
    expect(low.maxX - box.maxX).toBeGreaterThan(high.maxX - box.maxX);
  });

  it("caps the reach so a sun on the horizon does not demand the whole world", () => {
    const grown = expandTowardsSun(box, degToRad(90), degToRad(0.01));
    // The cap is 60 km, which is well under one degree of longitude here.
    expect(grown.maxX - box.maxX).toBeLessThan(0.01);
  });
});

describe("planTiles", () => {
  it("keeps the tile count within budget", () => {
    const box = expandTowardsSun(boundsToMercator(VIEW), degToRad(90), degToRad(3));
    const plan = planTiles(box, 13);
    expect(plan.columns * plan.rows).toBeLessThanOrEqual(100);
  });

  it("drops the zoom rather than exceeding the budget on a wide view", () => {
    const wide = boundsToMercator({ west: -130, south: 30, east: -70, north: 60 });
    const plan = planTiles(wide, 13);
    expect(plan.zoom).toBeLessThan(13);
    expect(plan.columns * plan.rows).toBeLessThanOrEqual(100);
  });

  it("never asks for a zoom the elevation source does not publish", () => {
    const box = boundsToMercator(VIEW);
    expect(planTiles(box, 20).zoom).toBeLessThanOrEqual(13);
    expect(planTiles(box, 1).zoom).toBeGreaterThanOrEqual(2);
  });

  it("stays inside the tile pyramid at the poles", () => {
    const polar = boundsToMercator({ west: -10, south: 84, east: 10, north: 85 });
    const plan = planTiles(polar, 8);
    expect(plan.minTileY).toBeGreaterThanOrEqual(0);
    expect(plan.minTileY + plan.rows).toBeLessThanOrEqual(2 ** plan.zoom);
  });

  it("always covers at least one tile", () => {
    const tiny = boundsToMercator({ west: 0, south: 0, east: 0.0001, north: 0.0001 });
    const plan = planTiles(tiny, 13);
    expect(plan.columns).toBeGreaterThanOrEqual(1);
    expect(plan.rows).toBeGreaterThanOrEqual(1);
  });
});
