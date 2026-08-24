import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

const here = path.dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const base = loadConfig();
  // In the container the built web assets sit next to the server bundle.
  const config = base.STATIC_DIR
    ? base
    : Object.freeze({ ...base, STATIC_DIR: path.resolve(here, "../../web/dist") });

  const app = await buildApp(config);

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      app.log.info({ signal }, "shutting down");
      void app.close().then(() => process.exit(0));
    });
  }

  await app.listen({ port: config.PORT, host: config.HOST });
}

main().catch((error: unknown) => {
  console.error("Failed to start Photo Hour:", error);
  process.exitCode = 1;
});
