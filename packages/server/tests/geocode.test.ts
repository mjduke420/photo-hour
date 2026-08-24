import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createMemoryCache, createStubFetch, jsonResponse } from "./helpers.js";

const UPSTREAM_HITS = [
  {
    display_name: "Gatineau Park, Quebec, Canada",
    lat: "45.5000",
    lon: "-75.8500",
    type: "park",
  },
  {
    display_name: "Broken entry with no usable position",
    lat: "not-a-number",
    lon: "-75.0",
    type: "hamlet",
  },
];

let app: FastifyInstance | null = null;

afterEach(async () => {
  await app?.close();
  app = null;
});

async function makeApp(responder: (url: string) => Response, userAgent?: string) {
  const fetchImpl = createStubFetch(responder);
  app = await buildApp(
    loadConfig({
      LOG_LEVEL: "silent",
      ...(userAgent ? { NOMINATIM_USER_AGENT: userAgent } : {}),
    }),
    { cache: createMemoryCache(), fetchImpl },
  );
  return { app, fetchImpl };
}

describe("GET /api/geocode", () => {
  it("maps upstream hits onto a narrow result shape", async () => {
    const { app: instance } = await makeApp(() => jsonResponse(UPSTREAM_HITS));

    const response = await instance.inject("/api/geocode?q=gatineau%20park");

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      results: [
        {
          name: "Gatineau Park, Quebec, Canada",
          lat: 45.5,
          lng: -75.85,
          kind: "park",
        },
      ],
    });
  });

  it("forwards the search text and a result limit to the geocoder", async () => {
    const { app: instance, fetchImpl } = await makeApp(() => jsonResponse([]));

    await instance.inject("/api/geocode?q=mount%20rainier");

    const called = new URL(fetchImpl.calls[0]?.url ?? "");
    expect(called.origin + called.pathname).toBe("https://nominatim.openstreetmap.org/search");
    expect(called.searchParams.get("q")).toBe("mount rainier");
    expect(called.searchParams.get("limit")).toBe("6");
    expect(called.searchParams.get("format")).toBe("jsonv2");
  });

  it("identifies this deployment to the geocoder as its policy requires", async () => {
    const { app: instance, fetchImpl } = await makeApp(
      () => jsonResponse([]),
      "photo-hour-test/1.0 (https://example.invalid)",
    );

    await instance.inject("/api/geocode?q=banff");

    const headers = fetchImpl.calls[0]?.init?.headers as Record<string, string>;
    expect(headers["user-agent"]).toBe("photo-hour-test/1.0 (https://example.invalid)");
  });

  it("rejects a search that is too short to be useful", async () => {
    const { app: instance, fetchImpl } = await makeApp(() => jsonResponse([]));
    expect((await instance.inject("/api/geocode?q=a")).statusCode).toBe(400);
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it("rejects a missing search parameter", async () => {
    const { app: instance } = await makeApp(() => jsonResponse([]));
    expect((await instance.inject("/api/geocode")).statusCode).toBe(400);
  });

  it("rejects an overlong search string", async () => {
    const { app: instance, fetchImpl } = await makeApp(() => jsonResponse([]));
    const response = await instance.inject(`/api/geocode?q=${"x".repeat(200)}`);
    expect(response.statusCode).toBe(400);
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it("reports a bad gateway when the geocoder errors", async () => {
    const { app: instance } = await makeApp(() => jsonResponse({ error: "nope" }, 503));
    expect((await instance.inject("/api/geocode?q=banff")).statusCode).toBe(502);
  });

  it("reports a bad gateway when the geocoder is unreachable", async () => {
    const fetchImpl = createStubFetch(() => {
      throw new Error("dns failure");
    });
    app = await buildApp(loadConfig({ LOG_LEVEL: "silent" }), {
      cache: createMemoryCache(),
      fetchImpl,
    });
    expect((await app.inject("/api/geocode?q=banff")).statusCode).toBe(502);
  });

  it("reports a bad gateway when the geocoder returns an unexpected shape", async () => {
    const { app: instance } = await makeApp(() => jsonResponse({ unexpected: true }));
    expect((await instance.inject("/api/geocode?q=banff")).statusCode).toBe(502);
  });
});
