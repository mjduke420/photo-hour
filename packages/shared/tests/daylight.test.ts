import { describe, expect, it } from "vitest";
import {
  brightestBand,
  daylightBands,
  phaseForAltitude,
  sunEvents,
  type DaylightPhase,
} from "../src/daylight.js";
import { MINUTES_PER_DAY } from "../src/time.js";

const OTTAWA = { lat: 45.4215, lng: -75.6972, zone: "America/Toronto" };
const SVALBARD = { lat: 78.22, lng: 15.63, zone: "Arctic/Longyearbyen" };

function phases(bands: { phase: DaylightPhase }[]): Set<DaylightPhase> {
  return new Set(bands.map((band) => band.phase));
}

describe("phaseForAltitude", () => {
  it("classifies each threshold", () => {
    expect(phaseForAltitude(45)).toBe("day");
    expect(phaseForAltitude(6)).toBe("day");
    expect(phaseForAltitude(5.9)).toBe("goldenHour");
    expect(phaseForAltitude(-4)).toBe("goldenHour");
    expect(phaseForAltitude(-4.1)).toBe("blueHour");
    expect(phaseForAltitude(-6)).toBe("blueHour");
    expect(phaseForAltitude(-6.1)).toBe("nauticalTwilight");
    expect(phaseForAltitude(-12.1)).toBe("astronomicalTwilight");
    expect(phaseForAltitude(-18.1)).toBe("night");
  });
});

describe("daylightBands", () => {
  it("covers the whole day with contiguous bands", () => {
    const bands = daylightBands("2026-08-24", OTTAWA.lat, OTTAWA.lng, OTTAWA.zone);
    expect(bands[0]?.startMinutes).toBe(0);
    expect(bands[bands.length - 1]?.endMinutes).toBe(MINUTES_PER_DAY);
    for (let i = 1; i < bands.length; i += 1) {
      expect(bands[i]?.startMinutes).toBe(bands[i - 1]?.endMinutes);
    }
  });

  it("produces every photographic phase on a mid-latitude summer day", () => {
    const found = phases(daylightBands("2026-06-21", OTTAWA.lat, OTTAWA.lng, OTTAWA.zone));
    expect(found).toContain("day");
    expect(found).toContain("goldenHour");
    expect(found).toContain("blueHour");
  });

  it("puts the middle of the day inside the day band", () => {
    const bands = daylightBands("2026-06-21", OTTAWA.lat, OTTAWA.lng, OTTAWA.zone);
    const noon = bands.find((b) => b.startMinutes <= 780 && b.endMinutes > 780);
    expect(noon?.phase).toBe("day");
  });

  it("reports a single day band through the arctic midnight sun", () => {
    const bands = daylightBands("2026-06-21", SVALBARD.lat, SVALBARD.lng, SVALBARD.zone);
    expect(bands).toHaveLength(1);
    expect(bands[0]?.phase).toBe("day");
  });

  it("never reaches daylight during the arctic polar night", () => {
    const found = phases(daylightBands("2026-12-21", SVALBARD.lat, SVALBARD.lng, SVALBARD.zone));
    expect(found.has("day")).toBe(false);
    expect(found.has("goldenHour")).toBe(false);
    expect(found.has("blueHour")).toBe(false);
    expect(found.has("night")).toBe(true);
  });

  it("honours a coarser sampling interval", () => {
    const coarse = daylightBands("2026-08-24", OTTAWA.lat, OTTAWA.lng, OTTAWA.zone, 60);
    expect(coarse[0]?.startMinutes).toBe(0);
    expect(coarse[coarse.length - 1]?.endMinutes).toBe(MINUTES_PER_DAY);
  });
});

describe("sunEvents", () => {
  it("returns sunrise before solar noon before sunset", () => {
    const events = sunEvents("2026-06-21", OTTAWA.lat, OTTAWA.lng, OTTAWA.zone);
    const byKey = new Map(events.map((event) => [event.key, event]));
    const sunrise = byKey.get("sunrise")?.minutes;
    const noon = byKey.get("solarNoon")?.minutes;
    const sunset = byKey.get("sunset")?.minutes;

    expect(sunrise).toBeGreaterThan(0);
    expect(sunrise as number).toBeLessThan(noon as number);
    expect(noon as number).toBeLessThan(sunset as number);
  });

  it("puts the June solstice sunrise in eastern Canada shortly after five in the morning", () => {
    const events = sunEvents("2026-06-21", OTTAWA.lat, OTTAWA.lng, OTTAWA.zone);
    const sunrise = events.find((event) => event.key === "sunrise");
    expect(sunrise?.minutes).toBeGreaterThan(5 * 60);
    expect(sunrise?.minutes).toBeLessThan(5 * 60 + 45);
  });

  it("reports no sunrise during the polar night", () => {
    const events = sunEvents("2026-12-21", SVALBARD.lat, SVALBARD.lng, SVALBARD.zone);
    const sunrise = events.find((event) => event.key === "sunrise");
    expect(sunrise?.minutes).toBeNull();
    expect(sunrise?.instant).toBeNull();
  });
});

describe("brightestBand", () => {
  it("returns the longest daylight stretch", () => {
    const bands = daylightBands("2026-06-21", OTTAWA.lat, OTTAWA.lng, OTTAWA.zone);
    const best = brightestBand(bands);
    expect(best?.phase).toBe("day");
  });

  it("returns null when there is no daylight at all", () => {
    const bands = daylightBands("2026-12-21", SVALBARD.lat, SVALBARD.lng, SVALBARD.zone);
    expect(brightestBand(bands)).toBeNull();
  });
});
