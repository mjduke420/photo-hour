import type { FastifyInstance } from "fastify";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  // Kept dependency-free so a container healthcheck reports the process itself,
  // not the availability of the upstream elevation service.
  app.get("/api/health", async () => ({
    status: "ok",
    uptimeSeconds: Math.round(process.uptime()),
  }));
}
