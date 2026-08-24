import { describe, expect, it } from "vitest";
import {
  formatMinutes,
  minutesOfDayInZone,
  timeZoneAbbreviation,
  timeZoneForLocation,
  toDateISOInZone,
  zonedParts,
  zoneOffsetMs,
  zonedWallTimeToUtc,
} from "../src/time.js";

const TORONTO = "America/Toronto";
const HOUR_MS = 3600000;

describe("timeZoneForLocation", () => {
  it("resolves eastern Canada", () => {
    expect(timeZoneForLocation(45.4215, -75.6972)).toBe(TORONTO);
  });

  it("resolves the southern hemisphere", () => {
    expect(timeZoneForLocation(-33.87, 151.21)).toBe("Australia/Sydney");
  });

  it("falls back rather than throwing on an out-of-range coordinate", () => {
    expect(typeof timeZoneForLocation(Number.NaN, Number.NaN)).toBe("string");
  });

  it("wraps longitudes past the antimeridian", () => {
    expect(timeZoneForLocation(45.4215, -75.6972 + 360)).toBe(TORONTO);
  });
});

describe("zoneOffsetMs", () => {
  it("reports daylight time in summer", () => {
    expect(zoneOffsetMs(new Date("2026-08-24T18:00:00Z"), TORONTO)).toBe(-4 * HOUR_MS);
  });

  it("reports standard time in winter", () => {
    expect(zoneOffsetMs(new Date("2026-01-15T18:00:00Z"), TORONTO)).toBe(-5 * HOUR_MS);
  });

  it("reports zero for UTC", () => {
    expect(zoneOffsetMs(new Date("2026-08-24T18:00:00Z"), "UTC")).toBe(0);
  });
});

describe("zonedWallTimeToUtc", () => {
  it("converts a summer afternoon in eastern daylight time", () => {
    const utc = zonedWallTimeToUtc("2026-08-24", 14 * 60, TORONTO);
    expect(utc.toISOString()).toBe("2026-08-24T18:00:00.000Z");
  });

  it("converts a winter afternoon in eastern standard time", () => {
    const utc = zonedWallTimeToUtc("2026-01-15", 14 * 60, TORONTO);
    expect(utc.toISOString()).toBe("2026-01-15T19:00:00.000Z");
  });

  it("handles a zone ahead of UTC", () => {
    const utc = zonedWallTimeToUtc("2026-08-24", 9 * 60, "Australia/Sydney");
    expect(utc.toISOString()).toBe("2026-08-23T23:00:00.000Z");
  });

  it("handles a half-hour offset zone", () => {
    const utc = zonedWallTimeToUtc("2026-08-24", 12 * 60, "Asia/Kolkata");
    expect(utc.toISOString()).toBe("2026-08-24T06:30:00.000Z");
  });

  it("shifts a nonexistent spring-forward time past the gap", () => {
    // 02:30 does not exist in Toronto on 2026-03-08; it becomes 03:30 EDT.
    const utc = zonedWallTimeToUtc("2026-03-08", 2 * 60 + 30, TORONTO);
    expect(zonedParts(utc, TORONTO).hour).toBe(3);
    expect(zonedParts(utc, TORONTO).minute).toBe(30);
  });

  it("picks the earlier instant for an ambiguous autumn time", () => {
    // 01:30 happens twice in Toronto on 2026-11-01; the daylight one comes first.
    const utc = zonedWallTimeToUtc("2026-11-01", 90, TORONTO);
    expect(utc.toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });

  it("round-trips through minutesOfDayInZone for every hour of a normal day", () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const utc = zonedWallTimeToUtc("2026-08-24", hour * 60, TORONTO);
      expect(minutesOfDayInZone(utc, TORONTO)).toBeCloseTo(hour * 60, 6);
      expect(toDateISOInZone(utc, TORONTO)).toBe("2026-08-24");
    }
  });

  it("clamps a minute value beyond the end of the day", () => {
    const utc = zonedWallTimeToUtc("2026-08-24", 99999, TORONTO);
    expect(toDateISOInZone(utc, TORONTO)).toBe("2026-08-25");
  });
});

describe("zonedParts", () => {
  it("reports midnight as hour zero rather than 24", () => {
    const midnight = zonedWallTimeToUtc("2026-08-24", 0, TORONTO);
    expect(zonedParts(midnight, TORONTO).hour).toBe(0);
  });
});

describe("formatMinutes", () => {
  it("pads to a fixed width clock", () => {
    expect(formatMinutes(0)).toBe("00:00");
    expect(formatMinutes(870)).toBe("14:30");
    expect(formatMinutes(1439)).toBe("23:59");
  });

  it("clamps out-of-range values", () => {
    expect(formatMinutes(-10)).toBe("00:00");
    expect(formatMinutes(5000)).toBe("23:59");
  });
});

describe("timeZoneAbbreviation", () => {
  it("returns the seasonal abbreviation", () => {
    expect(timeZoneAbbreviation(new Date("2026-08-24T18:00:00Z"), TORONTO)).toBe("EDT");
    expect(timeZoneAbbreviation(new Date("2026-01-15T18:00:00Z"), TORONTO)).toBe("EST");
  });
});
