import { promises as fs } from "node:fs";
import path from "node:path";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import { createTileCache, type TileCache } from "./cache/tileCache.js";
import { demCacheMaxBytes, type AppConfig } from "./config.js";
import { registerClientConfigRoutes } from "./routes/clientConfig.js";
import { registerDemRoutes } from "./routes/dem.js";
import { registerGeocodeRoutes } from "./routes/geocode.js";
import { registerHealthRoutes } from "./routes/health.js";

export interface BuildAppOverrides {
  /** Supplied by tests so no network or disk access is needed. */
  cache?: TileCache;
  fetchImpl?: typeof fetch;
  demUpstream?: string;
  geocodeUpstream?: string;
}

/**
 * Hosts the map depends on. MapLibre also needs blob workers, which is why
 * worker-src and child-src are widened rather than left at the helmet default.
 */
const TILE_HOSTS = [
  "https://tile.openstreetmap.org",
  "https://*.tile.openstreetmap.org",
  "https://*.basemaps.cartocdn.com",
  "https://api.maptiler.com",
];

export async function buildApp(
  config: AppConfig,
  overrides: BuildAppOverrides = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: config.LOG_LEVEL },
    trustProxy: true,
    bodyLimit: 64 * 1024,
  });

  // useDefaults is off on purpose. Left on, helmet merges its own defaults in,
  // and those include upgrade-insecure-requests, which makes a browser rewrite
  // every asset request on a plain-HTTP deployment to https and fail to load
  // the page. Every directive this app needs is therefore listed in full.
  const directives: Record<string, string[]> = {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    fontSrc: ["'self'", "data:"],
    formAction: ["'self'"],
    frameAncestors: ["'self'"],
    objectSrc: ["'none'"],
    scriptSrc: ["'self'"],
    scriptSrcAttr: ["'none'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "blob:", ...TILE_HOSTS],
    connectSrc: ["'self'", ...TILE_HOSTS],
    workerSrc: ["'self'", "blob:"],
    childSrc: ["'self'", "blob:"],
  };

  if (config.FORCE_HTTPS) {
    directives.upgradeInsecureRequests = [];
  }

  await app.register(helmet, {
    contentSecurityPolicy: { useDefaults: false, directives },
    // Announcing HSTS from a plain-HTTP origin is at best ignored and at worst
    // misleading, so it is only sent when TLS is actually in front.
    hsts: config.FORCE_HTTPS ? { maxAge: 31536000, includeSubDomains: true } : false,
    crossOriginEmbedderPolicy: false,
  });

  await app.register(rateLimit, {
    max: 600,
    timeWindow: "1 minute",
    // Elevation tiles are static and heavily cached; a shoot-planning session
    // legitimately pulls a few hundred in a burst while panning.
    allowList: [],
  });

  const cache =
    overrides.cache ?? createTileCache(config.DEM_CACHE_DIR, demCacheMaxBytes(config));

  await registerHealthRoutes(app);
  await registerClientConfigRoutes(app, config);
  await registerDemRoutes(app, {
    cache,
    ...(overrides.fetchImpl ? { fetchImpl: overrides.fetchImpl } : {}),
    ...(overrides.demUpstream ? { upstream: overrides.demUpstream } : {}),
  });
  await registerGeocodeRoutes(app, {
    userAgent: config.NOMINATIM_USER_AGENT,
    ...(overrides.fetchImpl ? { fetchImpl: overrides.fetchImpl } : {}),
    ...(overrides.geocodeUpstream ? { upstream: overrides.geocodeUpstream } : {}),
  });

  if (config.STATIC_DIR) {
    const root = path.resolve(config.STATIC_DIR);
    const indexFile = path.join(root, "index.html");
    // Directory requests must resolve to the shell. Disabling the index would
    // make the site root answer 403 instead of falling through to the handler
    // below, because a refused directory listing never reaches the not-found
    // path that serves the single-page app.
    await app.register(fastifyStatic, { root, index: "index.html" });

    // Single-page app: anything that is not an API call and not a real file
    // falls back to the shell so deep links keep working after a refresh.
    app.setNotFoundHandler(async (request, reply) => {
      if (request.method !== "GET" || request.url.startsWith("/api/")) {
        return reply.code(404).send({ error: "Not found" });
      }
      const shell = await fs.readFile(indexFile, "utf8").catch(() => null);
      if (shell === null) return reply.code(404).send({ error: "Not found" });
      return reply.type("text/html").send(shell);
    });
  }

  return app;
}
