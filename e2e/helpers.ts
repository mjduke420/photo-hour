import type { Page } from "@playwright/test";
import { PNG } from "pngjs";

export const BANFF = "12.2/51.3217/-116.186";
export const TEST_DATE = "2026-08-24";

export interface PlanOptions {
  place?: string;
  date?: string;
  minutes: number;
  basemap?: string;
}

export function planUrl(options: PlanOptions): string {
  const place = options.place ?? BANFF;
  const date = options.date ?? TEST_DATE;
  const basemap = options.basemap ?? "muted";
  return `/#map=${place}&d=${date}&t=${options.minutes}&b=${basemap}`;
}

/**
 * Opens a plan from scratch.
 *
 * The app reads the hash once at start-up, so navigating between two plans that
 * differ only in the hash would leave the previous state in place. Clearing the
 * page first forces a real load.
 */
export async function openPlan(page: Page, options: PlanOptions): Promise<void> {
  await page.goto("about:blank");
  await page.goto(planUrl(options));
}

/**
 * Waits until the elevation fetch has finished and the overlay has had a chance
 * to render. The terrain badge is the app reporting a fetch in progress.
 */
export async function waitForTerrain(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="light-state"]');
  await page
    .waitForSelector("text=Loading terrain", { state: "detached", timeout: 60_000 })
    .catch(() => undefined);
  await page.waitForTimeout(3000);
}

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Mean brightness of a region of a screenshot, 0 to 255.
 *
 * Measured from a real screenshot rather than by reading the WebGL canvas in
 * the page, because MapLibre does not preserve its drawing buffer and a
 * read-back there would come out empty.
 */
export async function regionBrightness(page: Page, region: Region): Promise<number> {
  const buffer = await page.screenshot({ type: "png" });
  const image = PNG.sync.read(buffer);

  let total = 0;
  let counted = 0;
  for (let y = region.y; y < region.y + region.height && y < image.height; y += 1) {
    for (let x = region.x; x < region.x + region.width && x < image.width; x += 1) {
      const offset = (image.width * y + x) << 2;
      const red = image.data[offset] ?? 0;
      const green = image.data[offset + 1] ?? 0;
      const blue = image.data[offset + 2] ?? 0;
      total += (red + green + blue) / 3;
      counted += 1;
    }
  }
  return counted === 0 ? 0 : total / counted;
}

/** Map area clear of the top bar, the side panel and the bottom dock. */
export const MAP_REGION: Region = { x: 40, y: 120, width: 780, height: 480 };

/**
 * Brightness of each cell of a grid laid over a region.
 *
 * Used to tell a real terrain shadow from a flat wash: shading that follows the
 * ground varies from cell to cell, whereas a uniform dimming does not.
 */
export async function regionGrid(
  page: Page,
  region: Region,
  divisions: number,
): Promise<number[]> {
  const buffer = await page.screenshot({ type: "png" });
  const image = PNG.sync.read(buffer);

  const cellWidth = Math.floor(region.width / divisions);
  const cellHeight = Math.floor(region.height / divisions);
  const cells: number[] = [];

  for (let row = 0; row < divisions; row += 1) {
    for (let column = 0; column < divisions; column += 1) {
      let total = 0;
      let counted = 0;
      for (let y = 0; y < cellHeight; y += 1) {
        for (let x = 0; x < cellWidth; x += 1) {
          const pixelX = region.x + column * cellWidth + x;
          const pixelY = region.y + row * cellHeight + y;
          if (pixelX >= image.width || pixelY >= image.height) continue;
          const offset = (image.width * pixelY + pixelX) << 2;
          const red = image.data[offset] ?? 0;
          const green = image.data[offset + 1] ?? 0;
          const blue = image.data[offset + 2] ?? 0;
          total += (red + green + blue) / 3;
          counted += 1;
        }
      }
      cells.push(counted === 0 ? 0 : total / counted);
    }
  }
  return cells;
}

export function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
