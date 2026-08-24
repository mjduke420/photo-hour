import { expect, test } from "@playwright/test";
import {
  MAP_REGION,
  openPlan,
  regionGrid,
  standardDeviation,
  waitForTerrain,
} from "./helpers.js";

test("shadows follow the terrain rather than dimming the map uniformly", async ({
  page,
}, testInfo) => {
  await openPlan(page, { minutes: 13 * 60 + 30 });
  await waitForTerrain(page);
  const middayGrid = await regionGrid(page, MAP_REGION, 8);
  await page.screenshot({ path: testInfo.outputPath("midday.png") });

  await openPlan(page, { minutes: 19 * 60 + 40 });
  await waitForTerrain(page);
  const eveningGrid = await regionGrid(page, MAP_REGION, 8);
  await page.screenshot({ path: testInfo.outputPath("evening.png") });

  const middaySpread = standardDeviation(middayGrid);
  const eveningSpread = standardDeviation(eveningGrid);

  // A uniform wash would leave the spread across cells unchanged. Terrain
  // shadow puts some cells deep in shade while ridges stay lit, so the spread
  // has to grow once the sun is low.
  expect(eveningSpread).toBeGreaterThan(middaySpread * 1.5);

  // And the darkest cell has to be genuinely dark, not merely tinted.
  const darkest = Math.min(...eveningGrid);
  const brightest = Math.max(...eveningGrid);
  expect(brightest - darkest).toBeGreaterThan(30);
});
