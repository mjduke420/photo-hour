import { isValidTile, TERRARIUM_MAX_ZOOM } from "@photo-hour/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { TileCache } from "../cache/tileCache.js";

/**
 * Mapzen terrain tiles, hosted by AWS as part of the Registry of Open Data.
 * Public, keyless, and licensed for reuse with attribution.
 */
export const TERRARIUM_UPSTREAM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium";

const UPSTREAM_TIMEOUT_MS = 12000;

const paramsSchema = z.object({
  z: z.coerce.number().int(),
  x: z.coerce.number().int(),
  y: z.coerce.number().int(),
});

export interface DemRouteOptions {
  cache: TileCache;
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  upstream?: string;
}

/**
 * Proxies and caches elevation tiles.
 *
 * Going through the server rather than fetching straight from the browser buys
 * three things: a persistent cache so repeated planning sessions do not re-pull
 * the same terrain, freedom from third-party CORS behaviour, and a single place
 * to swap the elevation source later.
 */
export async function registerDemRoutes(
  app: FastifyInstance,
  options: DemRouteOptions,
): Promise<void> {
  const { cache } = options;
  const doFetch = options.fetchImpl ?? fetch;
  const upstream = options.upstream ?? TERRARIUM_UPSTREAM;

  app.get("/api/dem/:z/:x/:y.png", async (request, reply) => {
    const parsed = paramsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Tile coordinates must be integers" });
    }

    const { z, x, y } = parsed.data;
    // The coordinates are only ever used as integers from here on, so neither
    // the cache path nor the upstream URL can be steered by the request.
    if (!isValidTile({ z, x, y }, TERRARIUM_MAX_ZOOM)) {
      return reply.code(400).send({ error: "Tile coordinates out of range" });
    }

    const cached = await cache.read(z, x, y);
    if (cached) {
      return reply
        .header("content-type", "image/png")
        .header("cache-control", "public, max-age=31536000, immutable")
        .header("x-photo-hour-cache", "hit")
        .send(cached);
    }

    let response: Response;
    try {
      response = await doFetch(`${upstream}/${z}/${x}/${y}.png`, {
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        headers: { accept: "image/png" },
      });
    } catch (error) {
      request.log.warn({ err: error, z, x, y }, "elevation upstream unreachable");
      return reply.code(502).send({ error: "Elevation source unreachable" });
    }

    if (response.status === 404) {
      return reply.code(404).send({ error: "No elevation data for this tile" });
    }
    if (!response.ok) {
      request.log.warn({ status: response.status, z, x, y }, "elevation upstream error");
      return reply.code(502).send({ error: "Elevation source returned an error" });
    }

    const body = Buffer.from(await response.arrayBuffer());
    await cache.write(z, x, y, body).catch((error: unknown) => {
      request.log.warn({ err: error }, "could not cache elevation tile");
    });

    return reply
      .header("content-type", "image/png")
      .header("cache-control", "public, max-age=31536000, immutable")
      .header("x-photo-hour-cache", "miss")
      .send(body);
  });
}
