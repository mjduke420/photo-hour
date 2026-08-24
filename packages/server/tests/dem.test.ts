import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createMemoryCache, createStubFetch, pngResponse } from "./helpers.js";

const TILE_BYTES = [137, 80, 78, 71, 13, 10, 26, 10];

let app: FastifyInstance | null = null;

afterEach(async () => {
  await app?.close();
  app = null;
});

async function makeApp(responder: (url: string) => Response) {
  const cache = createMemoryCache();
  const fetchImpl = createStubFetch(responder);
  app = await buildApp(loadConfig({ LOG_LEVEL: "silent" }), { cache, fetchImpl });
  return { app, cache, fetchImpl };
}

describe("GET /api/dem/:z/:x/:y.png", () => {
  it("fetches a tile from upstream and reports a cache miss", async () => {
    const { app: instance, fetchImpl } = await makeApp(() => pngResponse(TILE_BYTES));

    const response = await instance.inject("/api/dem/10/300/400.png");

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("image/png");
    expect(response.headers["x-photo-hour-cache"]).toBe("miss");
    expect(Array.from(response.rawPayload)).toEqual(TILE_BYTES);
    expect(fetchImpl.calls[0]?.url).toBe(
      "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/10/300/400.png",
    );
  });

  it("stores the tile and serves the second request from cache", async () => {
    const { app: instance, cache, fetchImpl } = await makeApp(() => pngResponse(TILE_BYTES));

    await instance.inject("/api/dem/10/300/400.png");
    const second = await instance.inject("/api/dem/10/300/400.png");

    expect(second.headers["x-photo-hour-cache"]).toBe("hit");
    expect(fetchImpl.calls).toHaveLength(1);
    expect(cache.store.has("10/300/400")).toBe(true);
  });

  it("marks elevation tiles as immutable so browsers stop re-asking", async () => {
    const { app: instance } = await makeApp(() => pngResponse(TILE_BYTES));
    const response = await instance.inject("/api/dem/10/300/400.png");
    expect(response.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
  });

  it("rejects a zoom level the elevation source does not publish", async () => {
    const { app: instance, fetchImpl } = await makeApp(() => pngResponse(TILE_BYTES));
    const response = await instance.inject("/api/dem/16/0/0.png");
    expect(response.statusCode).toBe(400);
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it("rejects coordinates outside the tile pyramid", async () => {
    const { app: instance, fetchImpl } = await makeApp(() => pngResponse(TILE_BYTES));
    expect((await instance.inject("/api/dem/2/9/0.png")).statusCode).toBe(400);
    expect((await instance.inject("/api/dem/10/-1/0.png")).statusCode).toBe(400);
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it("rejects non-numeric coordinates without contacting upstream", async () => {
    const { app: instance, fetchImpl } = await makeApp(() => pngResponse(TILE_BYTES));
    const response = await instance.inject("/api/dem/abc/0/0.png");
    expect(response.statusCode).toBe(400);
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it("passes an upstream 404 through as a 404", async () => {
    const { app: instance } = await makeApp(() => pngResponse([], 404));
    const response = await instance.inject("/api/dem/12/100/100.png");
    expect(response.statusCode).toBe(404);
  });

  it("reports a bad gateway when upstream errors", async () => {
    const { app: instance } = await makeApp(() => pngResponse([], 500));
    const response = await instance.inject("/api/dem/12/100/100.png");
    expect(response.statusCode).toBe(502);
  });

  it("reports a bad gateway when upstream is unreachable", async () => {
    const cache = createMemoryCache();
    const fetchImpl = createStubFetch(() => {
      throw new Error("connection refused");
    });
    app = await buildApp(loadConfig({ LOG_LEVEL: "silent" }), { cache, fetchImpl });

    const response = await app.inject("/api/dem/12/100/100.png");
    expect(response.statusCode).toBe(502);
  });

  it("still serves the tile when caching it fails", async () => {
    const cache = createMemoryCache();
    cache.write = async () => {
      throw new Error("disk full");
    };
    const fetchImpl = createStubFetch(() => pngResponse(TILE_BYTES));
    app = await buildApp(loadConfig({ LOG_LEVEL: "silent" }), { cache, fetchImpl });

    const response = await app.inject("/api/dem/10/300/400.png");
    expect(response.statusCode).toBe(200);
  });
});

describe("GET /api/health", () => {
  it("reports process health without touching upstream", async () => {
    const { app: instance, fetchImpl } = await makeApp(() => pngResponse(TILE_BYTES));
    const response = await instance.inject("/api/health");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok" });
    expect(fetchImpl.calls).toHaveLength(0);
  });
});

describe("GET /api/config", () => {
  it("reports no MapTiler key by default", async () => {
    const { app: instance } = await makeApp(() => pngResponse(TILE_BYTES));
    expect((await instance.inject("/api/config")).json()).toMatchObject({
      maptilerKey: null,
      demMaxZoom: 15,
    });
  });

  it("passes a configured MapTiler key to the browser", async () => {
    app = await buildApp(loadConfig({ LOG_LEVEL: "silent", MAPTILER_KEY: "key-123" }), {
      cache: createMemoryCache(),
      fetchImpl: createStubFetch(() => pngResponse(TILE_BYTES)),
    });
    expect((await app.inject("/api/config")).json()).toMatchObject({ maptilerKey: "key-123" });
  });
});
