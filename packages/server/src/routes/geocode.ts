import type { FastifyInstance } from "fastify";
import { z } from "zod";

export const NOMINATIM_UPSTREAM = "https://nominatim.openstreetmap.org/search";

const UPSTREAM_TIMEOUT_MS = 8000;
const MAX_RESULTS = 6;

const querySchema = z.object({
  q: z.string().trim().min(2).max(120),
});

/** Shape returned to the browser. Deliberately narrower than the upstream payload. */
export interface GeocodeResult {
  name: string;
  lat: number;
  lng: number;
  kind: string;
}

const upstreamSchema = z.array(
  z.object({
    display_name: z.string(),
    lat: z.string(),
    lon: z.string(),
    type: z.string().optional(),
    category: z.string().optional(),
  }),
);

export interface GeocodeRouteOptions {
  userAgent: string;
  fetchImpl?: typeof fetch;
  upstream?: string;
}

/**
 * Location search for jumping the map to a place by name.
 *
 * Proxied rather than called from the browser so the deployment identifies
 * itself with a single contact string, as the Nominatim usage policy requires,
 * and so the rate limit is enforced for all users of this instance at once.
 */
export async function registerGeocodeRoutes(
  app: FastifyInstance,
  options: GeocodeRouteOptions,
): Promise<void> {
  const doFetch = options.fetchImpl ?? fetch;
  const upstream = options.upstream ?? NOMINATIM_UPSTREAM;

  app.get(
    "/api/geocode",
    {
      config: {
        rateLimit: { max: 12, timeWindow: "1 minute" },
      },
    },
    async (request, reply) => {
      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Search text must be 2 to 120 characters" });
      }

      const url = new URL(upstream);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", String(MAX_RESULTS));
      url.searchParams.set("q", parsed.data.q);

      let response: Response;
      try {
        response = await doFetch(url, {
          signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
          headers: {
            accept: "application/json",
            "user-agent": options.userAgent,
          },
        });
      } catch (error) {
        request.log.warn({ err: error }, "geocoder unreachable");
        return reply.code(502).send({ error: "Location search is unavailable" });
      }

      if (!response.ok) {
        request.log.warn({ status: response.status }, "geocoder error");
        return reply.code(502).send({ error: "Location search is unavailable" });
      }

      const payload = upstreamSchema.safeParse(await response.json().catch(() => null));
      if (!payload.success) {
        return reply.code(502).send({ error: "Location search returned an unexpected reply" });
      }

      const results: GeocodeResult[] = payload.data
        .map((item) => ({
          name: item.display_name,
          lat: Number(item.lat),
          lng: Number(item.lon),
          kind: item.type ?? item.category ?? "place",
        }))
        .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));

      return reply.header("cache-control", "public, max-age=600").send({ results });
    },
  );
}
