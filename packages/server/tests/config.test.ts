import { describe, expect, it } from "vitest";
import { demCacheMaxBytes, loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("applies defaults for an empty environment", () => {
    const config = loadConfig({});
    expect(config.PORT).toBe(8080);
    expect(config.HOST).toBe("0.0.0.0");
    expect(config.MAPTILER_KEY).toBe("");
    expect(config.STATIC_DIR).toBe("");
  });

  it("coerces a numeric port from a string", () => {
    expect(loadConfig({ PORT: "3000" }).PORT).toBe(3000);
  });

  it("rejects a port outside the valid range", () => {
    expect(() => loadConfig({ PORT: "70000" })).toThrow(/Invalid environment configuration/);
  });

  it("rejects a port that is not a number", () => {
    expect(() => loadConfig({ PORT: "http" })).toThrow(/Invalid environment configuration/);
  });

  it("rejects an unknown log level", () => {
    expect(() => loadConfig({ LOG_LEVEL: "chatty" })).toThrow(/LOG_LEVEL/);
  });

  it("trims whitespace around the MapTiler key", () => {
    expect(loadConfig({ MAPTILER_KEY: "  abc123  " }).MAPTILER_KEY).toBe("abc123");
  });

  it("returns a frozen object so config cannot drift at runtime", () => {
    expect(Object.isFrozen(loadConfig({}))).toBe(true);
  });
});

describe("demCacheMaxBytes", () => {
  it("converts megabytes to bytes", () => {
    expect(demCacheMaxBytes(loadConfig({ DEM_CACHE_MAX_MB: "2" }))).toBe(2 * 1024 * 1024);
  });

  it("supports an unlimited setting of zero", () => {
    expect(demCacheMaxBytes(loadConfig({ DEM_CACHE_MAX_MB: "0" }))).toBe(0);
  });
});
