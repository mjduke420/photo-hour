import type { TileCache } from "../src/cache/tileCache.js";

/** In-memory stand-in for the disk cache, so route tests never touch the disk. */
export function createMemoryCache(): TileCache & { store: Map<string, Buffer> } {
  const store = new Map<string, Buffer>();
  const key = (z: number, x: number, y: number) => `${z}/${x}/${y}`;

  return {
    store,
    directory: "(memory)",
    async read(z, x, y) {
      return store.get(key(z, x, y)) ?? null;
    },
    async write(z, x, y, data) {
      store.set(key(z, x, y), data);
    },
    async evict() {
      return 0;
    },
  };
}

export interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

/** Records every outgoing request and replies with a scripted response. */
export function createStubFetch(
  responder: (url: string) => Response | Promise<Response>,
): typeof fetch & { calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const impl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });
    return responder(url);
  };
  return Object.assign(impl as unknown as typeof fetch, { calls });
}

export function pngResponse(bytes: number[], status = 200): Response {
  return new Response(new Uint8Array(bytes), {
    status,
    headers: { "content-type": "image/png" },
  });
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
