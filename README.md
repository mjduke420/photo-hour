# Photo Hour

Plan a location shoot by seeing exactly where the light and the shadows will be,
on any date, at any time of day.

Pan and zoom a map, drag the time scrubber along the bottom, pick a date, and a
darkening overlay shows where the terrain blocks direct sunlight. The overlay is
computed from real elevation data and the real position of the sun, so it shows
where shadows will actually fall rather than an artistic impression.

Built to be self-hosted with Docker. It works out of the box with no API keys.

## What it does

- **A real shadow model.** Every point on screen fires a ray towards the sun and
  walks the terrain along it, looking for ground high enough to block the light.
  Earth curvature and atmospheric refraction are accounted for, so a ridge fifty
  kilometres away shades you only if it genuinely still would.
- **Soft shadow edges.** The sun is a disc about half a degree wide, not a point,
  so shadow edges are feathered across that angle instead of being a hard line.
- **A day you can read at a glance.** The scrubber is coloured by photographic
  phase, so golden hour and blue hour are bands you aim the handle at.
- **The local time of the location**, not of your laptop. Time zones, daylight
  saving transitions and polar days are all handled.
- **A straight answer for one spot.** The crosshair at the centre of the map
  reports whether that exact point is in sun or in shadow, and its elevation.
- **Shareable plans.** The map position, date, time and basemap all live in the
  URL, so a plan can be bookmarked or sent to someone else.

## Quick start

```bash
docker compose up -d --build
```

Then open <http://localhost:1830>.

To run it on a different port, or to unlock the satellite and topographic
basemaps, copy `.env.example` to `.env` and set what you need:

```bash
cp .env.example .env
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `PHOTO_HOUR_PORT` | `1830` | Host port published by compose |
| `MAPTILER_KEY` | empty | Optional. Unlocks satellite and topo basemaps |
| `DEM_CACHE_MAX_MB` | `2048` | Size cap for the cached elevation tiles |
| `NOMINATIM_USER_AGENT` | `photo-hour/1.0 (self-hosted)` | Contact string sent to the geocoder |
| `LOG_LEVEL` | `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent` |
| `FORCE_HTTPS` | `false` | Enable HSTS and https upgrading. Only set this behind TLS |

Deploying through Portainer instead of the command line? Set these under the
stack's **Environment variables** rather than in a `.env` file. `PHOTO_HOUR_PORT`
is the one to reach for if the stack fails with `port is already allocated`:
only the host side of the mapping changes, so nothing inside the container is
affected.

`MAPTILER_KEY` is served to the browser, because that is how MapTiler client
keys work. Use a key restricted to your own origin, and never a secret one. The
app is fully usable without it.

Elevation tiles are cached in a named Docker volume. They never change, so the
cache makes revisiting a location instant and takes load off the upstream
service.

## How the shadow model works

1. The browser asks the server for the elevation tiles covering the current view
   plus a margin extending **towards the sun** — that is the only direction
   blocking terrain can be in, so widening the fetch elsewhere would just cost
   bandwidth.
2. The server proxies those tiles from the AWS Terrain Tiles open dataset and
   caches them on disk.
3. The tiles are stitched into one raster and uploaded to the GPU as a texture,
   still in their packed encoding. Decoding happens in the shader.
4. A fragment shader ray-marches each pixel towards the sun in geometrically
   growing steps, tracking the steepest angle any terrain subtends along the
   way, and compares that against the sun altitude across the width of the solar
   disc.
5. The result is rendered to an offscreen raster pinned to the elevation grid in
   mercator space, then composited over the map each frame.

That last point is what makes it usable. The raster is tied to geography rather
than to the screen, so panning and zooming reuse it for free; it is only rebuilt
when the terrain or the sun changes. While the scrubber is being dragged the
model drops to a smaller raster with fewer ray steps, and returns to full detail
as soon as you let go.

The same algorithm exists twice: once in GLSL for the overlay, and once in
TypeScript in `packages/shared/src/shadow.ts`. The TypeScript version is what
answers the crosshair readout, and it is what the unit tests exercise against
synthetic terrain — a shader alone could not be tested that way.

## Limitations, honestly

- **Terrain only.** Buildings, trees and other structures are not modelled, so
  in a city the overlay will show a valley full of sunlight that a row of tower
  blocks would actually shade. It is built for landscape and outdoor locations.
- **Elevation resolution.** The source data is roughly 30 m per sample at best,
  and coarser when zoomed out. Narrow gullies and cliff edges are approximate.
- **Direct light only.** The overlay shows where the sun is blocked. It does not
  model skylight, bounced light, or how bright the shadow will actually look.
- **Flat camera.** The map does not tilt, because the model is a plan view of
  the ground and a tilted camera would suggest a three-dimensional result the
  overlay does not produce.

## Development

Requires Node 22 or newer.

```bash
npm install
npm run build
node packages/server/dist/index.js
```

That serves the built client and the API together on port 8080, which is the
same thing the container does.

For a live-reloading client, run the API on 8080 and Vite on 5173 in two
terminals. Vite proxies `/api` through to the server:

```bash
npm run build -w @photo-hour/shared && node packages/server/dist/index.js
```

```bash
npm run dev -w @photo-hour/web
```

### Layout

| Path | What lives there |
| --- | --- |
| `packages/shared` | Solar position, mercator maths, time zones, daylight phases, the reference shadow model |
| `packages/server` | Fastify API: elevation proxy and cache, geocoder proxy, static hosting |
| `packages/web` | React client, MapLibre map, the WebGL shadow layer |
| `e2e` | Playwright tests that drive the real app in a browser |

### Testing

```bash
npm test
```

```bash
npm run test:coverage
```

```bash
npm run test:e2e
```

The end-to-end suite starts the server itself. To point it at an already running
instance instead, set `PHOTO_HOUR_URL`.

The end-to-end tests do more than click around: they measure the brightness of
the rendered map from real screenshots, and assert that a low sun both darkens
the scene and increases the variation across it. A uniform wash would pass the
first check and fail the second, which is what makes it a test of the shadow
model rather than of the overlay being switched on.

## Data sources

Photo Hour is a client of three open services. If you run it publicly, respect
their usage policies.

| Data | Source | Notes |
| --- | --- | --- |
| Elevation | [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) | Mapzen terrain tiles, public domain to CC-BY depending on the underlying source |
| Basemaps | [OpenStreetMap](https://www.openstreetmap.org/copyright), [CARTO](https://carto.com/attribution/) | ODbL. The OSM tile service is a volunteer resource with a [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) |
| Place search | [Nominatim](https://nominatim.org/) | Rate limited to one request per second; the server enforces a shared limit and sends a contact string |

Set `NOMINATIM_USER_AGENT` to something that identifies your deployment before
exposing it beyond your own network.

## Licence

MIT. See [LICENSE](LICENSE).
