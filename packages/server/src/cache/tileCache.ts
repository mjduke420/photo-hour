import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export interface TileCache {
  read(z: number, x: number, y: number): Promise<Buffer | null>;
  write(z: number, x: number, y: number, data: Buffer): Promise<void>;
  /** Trims the cache down to the size limit, oldest entries first. */
  evict(): Promise<number>;
  readonly directory: string;
}

/** Writes go through a unique temp name so a crash cannot leave a partial tile. */
function tempName(): string {
  return `.tmp-${createHash("sha1").update(`${Date.now()}-${Math.random()}`).digest("hex").slice(0, 16)}`;
}

interface CacheEntry {
  file: string;
  size: number;
  modified: number;
}

async function collectEntries(directory: string): Promise<CacheEntry[]> {
  const entries: CacheEntry[] = [];

  async function walk(current: string): Promise<void> {
    const contents = await fs.readdir(current, { withFileTypes: true }).catch(() => []);
    for (const entry of contents) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!entry.name.endsWith(".png")) continue;
      const stat = await fs.stat(full).catch(() => null);
      if (stat) entries.push({ file: full, size: stat.size, modified: stat.mtimeMs });
    }
  }

  await walk(directory);
  return entries;
}

/**
 * A size-capped disk cache for elevation tiles.
 *
 * Tiles are immutable, so entries never expire on age; the only reason to
 * remove one is to stay under the configured size limit. Eviction runs on a
 * write counter rather than on every write, because it has to stat the tree.
 */
export function createTileCache(directory: string, maxBytes: number): TileCache {
  const evictEvery = 64;
  let writesSinceEvict = 0;
  let evicting: Promise<number> | null = null;

  const tilePath = (z: number, x: number, y: number): string =>
    path.join(directory, String(z), String(x), `${y}.png`);

  async function evict(): Promise<number> {
    if (maxBytes <= 0) return 0;
    const entries = await collectEntries(directory);
    let total = entries.reduce((sum, entry) => sum + entry.size, 0);
    if (total <= maxBytes) return 0;

    entries.sort((a, b) => a.modified - b.modified);
    let removed = 0;
    for (const entry of entries) {
      if (total <= maxBytes) break;
      const gone = await fs.unlink(entry.file).then(
        () => true,
        () => false,
      );
      if (!gone) continue;
      total -= entry.size;
      removed += 1;
    }
    return removed;
  }

  return {
    directory,

    async read(z, x, y) {
      const file = tilePath(z, x, y);
      const data = await fs.readFile(file).catch(() => null);
      if (!data) return null;
      // Refresh the timestamp so eviction approximates least-recently-used.
      const now = new Date();
      await fs.utimes(file, now, now).catch(() => undefined);
      return data;
    },

    async write(z, x, y, data) {
      const file = tilePath(z, x, y);
      const folder = path.dirname(file);
      await fs.mkdir(folder, { recursive: true });
      const staging = path.join(folder, tempName());
      await fs.writeFile(staging, data);
      await fs.rename(staging, file);

      writesSinceEvict += 1;
      if (writesSinceEvict >= evictEvery && !evicting) {
        writesSinceEvict = 0;
        evicting = evict().finally(() => {
          evicting = null;
        });
      }
    },

    evict,
  };
}
