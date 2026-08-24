import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTileCache } from "../src/cache/tileCache.js";

let directory = "";

beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "photo-hour-cache-"));
});

afterEach(async () => {
  await fs.rm(directory, { recursive: true, force: true }).catch(() => undefined);
});

describe("createTileCache", () => {
  it("returns null for a tile it has never seen", async () => {
    const cache = createTileCache(directory, 1024 * 1024);
    expect(await cache.read(10, 1, 2)).toBeNull();
  });

  it("round-trips a tile through disk", async () => {
    const cache = createTileCache(directory, 1024 * 1024);
    const payload = Buffer.from([1, 2, 3, 4]);
    await cache.write(10, 1, 2, payload);
    expect(await cache.read(10, 1, 2)).toEqual(payload);
  });

  it("keeps tiles at different coordinates separate", async () => {
    const cache = createTileCache(directory, 1024 * 1024);
    await cache.write(10, 1, 2, Buffer.from("a"));
    await cache.write(10, 2, 1, Buffer.from("b"));
    expect((await cache.read(10, 1, 2))?.toString()).toBe("a");
    expect((await cache.read(10, 2, 1))?.toString()).toBe("b");
  });

  it("leaves no staging files behind after a write", async () => {
    const cache = createTileCache(directory, 1024 * 1024);
    await cache.write(7, 3, 4, Buffer.from("payload"));
    const folder = path.join(directory, "7", "3");
    expect(await fs.readdir(folder)).toEqual(["4.png"]);
  });

  it("evicts the oldest tiles when over the size limit", async () => {
    const cache = createTileCache(directory, 100);
    const chunk = Buffer.alloc(60, 7);

    await cache.write(1, 0, 0, chunk);
    // Force a measurable gap so modification time ordering is unambiguous.
    await new Promise((resolve) => setTimeout(resolve, 25));
    await cache.write(1, 0, 1, chunk);

    const removed = await cache.evict();
    expect(removed).toBe(1);
    expect(await cache.read(1, 0, 0)).toBeNull();
    expect(await cache.read(1, 0, 1)).not.toBeNull();
  });

  it("does not evict while inside the size limit", async () => {
    const cache = createTileCache(directory, 1024 * 1024);
    await cache.write(1, 0, 0, Buffer.alloc(60, 7));
    expect(await cache.evict()).toBe(0);
  });

  it("treats a zero limit as unlimited rather than evicting everything", async () => {
    const cache = createTileCache(directory, 0);
    await cache.write(1, 0, 0, Buffer.alloc(60, 7));
    expect(await cache.evict()).toBe(0);
    expect(await cache.read(1, 0, 0)).not.toBeNull();
  });

  it("refreshes the timestamp on read so eviction approximates least-recently-used", async () => {
    const cache = createTileCache(directory, 1024 * 1024);
    const file = path.join(directory, "5", "1", "1.png");
    await cache.write(5, 1, 1, Buffer.from("x"));
    const before = (await fs.stat(file)).mtimeMs;

    await new Promise((resolve) => setTimeout(resolve, 25));
    await cache.read(5, 1, 1);

    expect((await fs.stat(file)).mtimeMs).toBeGreaterThan(before);
  });
});
