import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchClientConfig, PlaceSearchError, searchPlaces } from "../src/api/client.js";

function stubFetch(response: Response | Promise<Response> | Error): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      if (response instanceof Error) throw response;
      return response;
    }),
  );
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchClientConfig", () => {
  it("returns what the server reports", async () => {
    stubFetch(json({ maptilerKey: "abc", demMaxZoom: 14, attribution: { elevation: "e", basemap: "b" } }));
    const config = await fetchClientConfig();
    expect(config.maptilerKey).toBe("abc");
    expect(config.demMaxZoom).toBe(14);
  });

  it("falls back to keyless defaults when the server cannot be reached", async () => {
    stubFetch(new Error("offline"));
    const config = await fetchClientConfig();
    expect(config.maptilerKey).toBeNull();
    expect(config.demMaxZoom).toBe(15);
  });

  it("falls back when the server replies with an error", async () => {
    stubFetch(json({ error: "boom" }, 500));
    expect((await fetchClientConfig()).maptilerKey).toBeNull();
  });

  it("ignores a malformed key rather than passing it to the map", async () => {
    stubFetch(json({ maptilerKey: 42 }));
    expect((await fetchClientConfig()).maptilerKey).toBeNull();
  });
});

describe("searchPlaces", () => {
  it("returns the result list", async () => {
    stubFetch(json({ results: [{ name: "Banff", lat: 51.1, lng: -115.5, kind: "town" }] }));
    const results = await searchPlaces("banff");
    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe("Banff");
  });

  it("returns an empty list when the server omits results", async () => {
    stubFetch(json({}));
    expect(await searchPlaces("banff")).toEqual([]);
  });

  it("explains a rate limit in words the user can act on", async () => {
    stubFetch(json({ error: "slow down" }, 429));
    await expect(searchPlaces("banff")).rejects.toThrow(/too many searches/i);
  });

  it("raises a typed error for other failures", async () => {
    stubFetch(json({ error: "boom" }, 502));
    await expect(searchPlaces("banff")).rejects.toBeInstanceOf(PlaceSearchError);
  });
});
