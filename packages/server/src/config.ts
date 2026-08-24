import { z } from "zod";

/**
 * Every knob the container exposes. Parsed once at boot so a bad value fails
 * immediately with a clear message rather than surfacing as a runtime error.
 */
/**
 * Environment values arrive as strings, and z.coerce.boolean would read the
 * string "false" as true, so the accepted spellings are listed explicitly.
 */
const booleanFromEnv = z
  .union([z.boolean(), z.string()])
  .default(false)
  .transform((value) =>
    value === true || value === "true" || value === "1" || value === "yes",
  );

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  HOST: z.string().min(1).default("0.0.0.0"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  /**
   * Public MapTiler key. Left empty the app still works on keyless OSM raster
   * tiles; set it and the satellite and vector styles appear in the switcher.
   * This value is served to the browser, so it must be a domain-restricted
   * client key rather than a secret.
   */
  MAPTILER_KEY: z.string().trim().default(""),

  DEM_CACHE_DIR: z.string().min(1).default("./data/dem-cache"),
  DEM_CACHE_MAX_MB: z.coerce.number().int().min(0).default(2048),

  /** Nominatim requires a contact string identifying the deployment. */
  NOMINATIM_USER_AGENT: z
    .string()
    .min(1)
    .default("photo-hour/1.0 (https://github.com/mjduke420/photo-hour)"),

  /** Directory of built web assets. Empty disables static serving, for tests. */
  STATIC_DIR: z.string().default(""),

  /**
   * Set this only when the app is actually reachable over HTTPS, typically
   * behind a TLS reverse proxy.
   *
   * It turns on HSTS and the upgrade-insecure-requests policy. Left off, as it
   * is by default, the app works over plain HTTP on a LAN address. Turned on
   * without TLS in front, the browser rewrites every asset request to https
   * and the page fails to load at all.
   */
  FORCE_HTTPS: booleanFromEnv,
});

export type AppConfig = Readonly<z.infer<typeof schema>>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${detail}`);
  }
  return Object.freeze(parsed.data);
}

export function demCacheMaxBytes(config: AppConfig): number {
  return config.DEM_CACHE_MAX_MB * 1024 * 1024;
}
