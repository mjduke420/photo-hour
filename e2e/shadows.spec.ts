import { expect, test } from "@playwright/test";
import { MAP_REGION, openPlan, regionBrightness, waitForTerrain } from "./helpers.js";

test.describe("terrain shadow overlay", () => {
  test("loads terrain and reports the ground elevation at the centre", async ({ page }) => {
    await openPlan(page, { minutes: 13 * 60 + 30 });
    await waitForTerrain(page);

    // Moraine Lake sits at roughly 1885 m, with the surrounding valley higher.
    const elevation = await page.getByText(/Ground elevation/).textContent();
    const metres = Number(/(\d+)/.exec(elevation ?? "")?.[1]);
    expect(metres).toBeGreaterThan(1500);
    expect(metres).toBeLessThan(3000);
  });

  test("darkens the map as the sun drops towards the horizon", async ({ page }) => {
    await openPlan(page, { minutes: 13 * 60 + 30 });
    await waitForTerrain(page);
    const midday = await regionBrightness(page, MAP_REGION);

    await openPlan(page, { minutes: 20 * 60 + 25 });
    await waitForTerrain(page);
    const nearSunset = await regionBrightness(page, MAP_REGION);

    // With the sun a couple of degrees up, the ridges either side of the valley
    // put most of the visible ground into shadow.
    expect(nearSunset).toBeLessThan(midday);
    expect(midday - nearSunset).toBeGreaterThan(6);
  });

  test("shades the whole scene once the sun is below the horizon", async ({ page }) => {
    await openPlan(page, { minutes: 13 * 60 + 30 });
    await waitForTerrain(page);
    const midday = await regionBrightness(page, MAP_REGION);

    await openPlan(page, { minutes: 1 * 60 });
    await waitForTerrain(page);
    const night = await regionBrightness(page, MAP_REGION);

    expect(night).toBeLessThan(midday);
    await expect(page.getByTestId("light-state")).toHaveText(/below the horizon/i);
  });

  test("overlay strength changes how dark the shadows are", async ({ page }) => {
    await openPlan(page, { minutes: 20 * 60 + 25 });
    await waitForTerrain(page);
    const atDefault = await regionBrightness(page, MAP_REGION);

    await page.getByLabel("Shadow overlay strength").fill("0");
    await page.waitForTimeout(1500);
    const atZero = await regionBrightness(page, MAP_REGION);

    expect(atZero).toBeGreaterThan(atDefault);
  });
});

test.describe("time and date controls", () => {
  test("dragging the scrubber changes the clock", async ({ page }) => {
    await openPlan(page, { minutes: 12 * 60 });
    await page.waitForSelector('[data-testid="time-track"]');
    await expect(page.getByTestId("clock-time")).toHaveText("12:00");

    const track = page.getByTestId("time-track");
    const box = await track.boundingBox();
    expect(box).not.toBeNull();
    const area = box as NonNullable<typeof box>;

    // Three quarters of the way across the day is 18:00.
    await page.mouse.move(area.x + area.width * 0.25, area.y + area.height / 2);
    await page.mouse.down();
    await page.mouse.move(area.x + area.width * 0.75, area.y + area.height / 2, { steps: 12 });
    await page.mouse.up();

    await expect(page.getByTestId("clock-time")).toHaveText(/^1[78]:/);
  });

  test("the scrubber is operable from the keyboard", async ({ page }) => {
    await openPlan(page, { minutes: 12 * 60 });
    await page.getByTestId("time-track").focus();

    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("clock-time")).toHaveText("12:01");

    await page.keyboard.press("ArrowUp");
    await expect(page.getByTestId("clock-time")).toHaveText("12:16");

    await page.keyboard.press("Home");
    await expect(page.getByTestId("clock-time")).toHaveText("00:00");

    await page.keyboard.press("End");
    await expect(page.getByTestId("clock-time")).toHaveText("23:59");
  });

  test("changing the date moves sunrise", async ({ page }) => {
    await openPlan(page, { date: "2026-06-21", minutes: 12 * 60 });
    await page.waitForSelector('[data-testid="light-state"]');
    const summerSunrise = await page.getByText("Sunrise").locator("..").textContent();

    await page.getByLabel("Date of the shoot").fill("2026-12-21");
    await page.waitForTimeout(1000);
    const winterSunrise = await page.getByText("Sunrise").locator("..").textContent();

    expect(summerSunrise).not.toEqual(winterSunrise);
    // Midsummer sunrise is before six; midwinter sunrise is well after seven.
    expect(summerSunrise).toMatch(/0[45]:/);
    expect(winterSunrise).toMatch(/0[78]:/);
  });

  test("the plan survives a reload through the URL", async ({ page }) => {
    await openPlan(page, { minutes: 17 * 60 + 45, date: "2026-09-14" });
    await expect(page.getByTestId("clock-time")).toHaveText("17:45");

    await page.reload();
    await expect(page.getByTestId("clock-time")).toHaveText("17:45");
    await expect(page.getByLabel("Date of the shoot")).toHaveValue("2026-09-14");
  });
});
