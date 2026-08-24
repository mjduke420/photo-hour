import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createMemoryCache, createStubFetch, pngResponse } from "./helpers.js";

let app: FastifyInstance | null = null;

afterEach(async () => {
  await app?.close();
  app = null;
});

async function headersFor(env: Record<string, string> = {}) {
  app = await buildApp(loadConfig({ LOG_LEVEL: "silent", ...env }), {
    cache: createMemoryCache(),
    fetchImpl: createStubFetch(() => pngResponse([])),
  });
  const response = await app.inject("/api/health");
  return {
    csp: String(response.headers["content-security-policy"] ?? ""),
    hsts: response.headers["strict-transport-security"],
  };
}

describe("security headers over plain HTTP", () => {
  it("does not ask the browser to upgrade requests to https", async () => {
    // Sending this on a plain-HTTP deployment makes the browser rewrite every
    // asset request to https, which fails and leaves a blank page.
    const { csp } = await headersFor();
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("does not announce HSTS from an origin that is not served over TLS", async () => {
    const { hsts } = await headersFor();
    expect(hsts).toBeUndefined();
  });

  it("keeps helmet from merging its own defaults back in", async () => {
    // The merged defaults are where upgrade-insecure-requests came from, so
    // pin a directive that only the explicit list sets.
    const { csp } = await headersFor();
    expect(csp).toContain("script-src-attr 'none'");
    expect(csp).toContain("form-action 'self'");
  });
});

describe("security headers behind TLS", () => {
  it("upgrades insecure requests when told the origin is https", async () => {
    const { csp } = await headersFor({ FORCE_HTTPS: "true" });
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("announces HSTS when told the origin is https", async () => {
    const { hsts } = await headersFor({ FORCE_HTTPS: "true" });
    expect(hsts).toContain("max-age=31536000");
  });
});

describe("content security policy contents", () => {
  it("allows the basemap tile hosts to be fetched and drawn", async () => {
    const { csp } = await headersFor();
    for (const host of ["tile.openstreetmap.org", "basemaps.cartocdn.com", "api.maptiler.com"]) {
      expect(csp).toContain(host);
    }
    expect(csp).toMatch(/img-src[^;]*blob:/);
    expect(csp).toMatch(/connect-src[^;]*'self'/);
  });

  it("allows the blob workers MapLibre spawns", async () => {
    const { csp } = await headersFor();
    expect(csp).toMatch(/worker-src[^;]*blob:/);
    expect(csp).toMatch(/child-src[^;]*blob:/);
  });

  it("still locks down the things that matter", async () => {
    const { csp } = await headersFor();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("base-uri 'self'");
  });
});

describe("FORCE_HTTPS parsing", () => {
  it("is off unless set", () => {
    expect(loadConfig({}).FORCE_HTTPS).toBe(false);
  });

  it("accepts the usual spellings for on", () => {
    for (const value of ["true", "1", "yes"]) {
      expect(loadConfig({ FORCE_HTTPS: value }).FORCE_HTTPS).toBe(true);
    }
  });

  it("reads the string false as off rather than as a non-empty string", () => {
    expect(loadConfig({ FORCE_HTTPS: "false" }).FORCE_HTTPS).toBe(false);
    expect(loadConfig({ FORCE_HTTPS: "0" }).FORCE_HTTPS).toBe(false);
  });
});
