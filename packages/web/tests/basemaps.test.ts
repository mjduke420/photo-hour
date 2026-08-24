import { describe, expect, it } from "vitest";
import { availableBasemaps, DEFAULT_BASEMAP_ID, findBasemap } from "../src/map/basemaps.js";

describe("availableBasemaps", () => {
  it("offers only keyless styles when no key is configured", () => {
    const options = availableBasemaps(null);
    expect(options.length).toBeGreaterThan(0);
    expect(options.every((option) => !option.requiresKey)).toBe(true);
  });

  it("unlocks the imagery styles once a key is present", () => {
    const withKey = availableBasemaps("key-123");
    expect(withKey.length).toBeGreaterThan(availableBasemaps(null).length);
    expect(withKey.some((option) => option.id === "satellite")).toBe(true);
  });
});

describe("findBasemap", () => {
  it("returns the requested style", () => {
    expect(findBasemap("dark", null).id).toBe("dark");
  });

  it("falls back to the default for an unknown id", () => {
    expect(findBasemap("nonsense", null).id).toBe(DEFAULT_BASEMAP_ID);
  });

  it("falls back when a style is asked for that this deployment cannot load", () => {
    // A shared link may name satellite even though this instance has no key.
    expect(findBasemap("satellite", null).id).toBe(DEFAULT_BASEMAP_ID);
  });
});

describe("style resolution", () => {
  it("builds a raster style for the keyless options", () => {
    const style = findBasemap("osm", null).resolve(null);
    expect(typeof style).toBe("object");
    expect(style).toMatchObject({ version: 8 });
  });

  it("builds a MapTiler style url that carries the key", () => {
    const style = findBasemap("satellite", "key-123").resolve("key-123");
    expect(typeof style).toBe("string");
    expect(style).toContain("key=key-123");
  });

  it("resolves to nothing when a keyed style is asked for without a key", () => {
    const satellite = availableBasemaps("key-123").find((option) => option.id === "satellite");
    expect(satellite?.resolve(null)).toBeNull();
  });

  it("credits OpenStreetMap on every keyless style", () => {
    for (const option of availableBasemaps(null)) {
      const style = option.resolve(null) as { sources: Record<string, { attribution?: string }> };
      const attributions = Object.values(style.sources).map((source) => source.attribution ?? "");
      expect(attributions.join(" ")).toContain("OpenStreetMap");
    }
  });
});
