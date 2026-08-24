import { TERRARIUM_MAX_ZOOM } from "@photo-hour/shared";
import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";

export interface ClientConfig {
  /** Present only when the operator supplied a key; the app works without one. */
  maptilerKey: string | null;
  demMaxZoom: number;
  attribution: {
    elevation: string;
    basemap: string;
  };
}

/**
 * Bootstrap values the browser needs before it can build a map style.
 *
 * The MapTiler key is a public client credential scoped by allowed origin, not
 * a secret, so serving it here is the intended usage. Anything genuinely
 * sensitive stays on the server.
 */
export async function registerClientConfigRoutes(
  app: FastifyInstance,
  config: AppConfig,
): Promise<void> {
  const payload: ClientConfig = {
    maptilerKey: config.MAPTILER_KEY.length > 0 ? config.MAPTILER_KEY : null,
    demMaxZoom: TERRARIUM_MAX_ZOOM,
    attribution: {
      elevation: "Elevation: Mapzen terrain tiles via AWS Open Data",
      basemap: "Map data: OpenStreetMap contributors",
    },
  };

  app.get("/api/config", async (_request, reply) =>
    reply.header("cache-control", "no-store").send(payload),
  );
}
