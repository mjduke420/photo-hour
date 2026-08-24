import tzlookup from "tz-lookup";
import { clamp } from "./math.js";

export const MINUTES_PER_DAY = 1440;

/** IANA zone for a coordinate, falling back to UTC if the lookup fails. */
export function timeZoneForLocation(lat: number, lng: number): string {
  try {
    const wrappedLng = ((((lng + 180) % 360) + 360) % 360) - 180;
    return tzlookup(clamp(lat, -90, 90), wrappedLng);
  } catch {
    return "UTC";
  }
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

/** Breaks a UTC instant into the wall-clock fields observed in a time zone. */
export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = formatterFor(timeZone).formatToParts(date);
  const lookup: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") lookup[part.type] = Number(part.value);
  }
  return {
    year: lookup.year ?? 1970,
    month: lookup.month ?? 1,
    day: lookup.day ?? 1,
    hour: (lookup.hour ?? 0) % 24,
    minute: lookup.minute ?? 0,
    second: lookup.second ?? 0,
  };
}

/** Offset of a time zone from UTC, in milliseconds, at a given instant. */
export function zoneOffsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const flooredToSecond = Math.floor(date.getTime() / 1000) * 1000;
  return asIfUtc - flooredToSecond;
}

/**
 * Converts a wall-clock time in a zone to the corresponding UTC instant.
 *
 * The offset lookup runs twice: the first pass guesses using the offset that
 * applies at the naive timestamp, the second corrects it when that guess landed
 * on the wrong side of a daylight-saving transition.
 *
 * The result is then round-tripped back to wall-clock. A mismatch means the
 * requested time falls in a spring-forward gap and does not exist, in which
 * case the first-pass answer is used, shifting the time forward past the gap.
 * For ambiguous autumn times that occur twice, the earlier instant wins.
 */
export function zonedWallTimeToUtc(
  dateISO: string,
  minutesOfDay: number,
  timeZone: string,
): Date {
  const [year = 1970, month = 1, day = 1] = dateISO.split("-").map(Number);
  const totalSeconds = Math.round(clamp(minutesOfDay, 0, MINUTES_PER_DAY) * 60);
  const hour = Math.floor(totalSeconds / 3600);
  const minute = Math.floor((totalSeconds % 3600) / 60);
  const second = totalSeconds % 60;

  const naive = Date.UTC(year, month - 1, day, hour, minute, second);
  const firstPass = naive - zoneOffsetMs(new Date(naive), timeZone);
  const secondPass = naive - zoneOffsetMs(new Date(firstPass), timeZone);

  const check = zonedParts(new Date(secondPass), timeZone);
  const checkNaive = Date.UTC(
    check.year,
    check.month - 1,
    check.day,
    check.hour,
    check.minute,
    check.second,
  );
  return new Date(checkNaive === naive ? secondPass : firstPass);
}

/** Local calendar date in a zone, as YYYY-MM-DD. */
export function toDateISOInZone(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return [String(p.year).padStart(4, "0"), pad(p.month), pad(p.day)].join("-");
}

/** Minutes elapsed since local midnight in a zone. */
export function minutesOfDayInZone(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  return p.hour * 60 + p.minute + p.second / 60;
}

/** Formats a minutes-since-midnight value as HH:MM. */
export function formatMinutes(minutesOfDay: number): string {
  const total = Math.round(clamp(minutesOfDay, 0, MINUTES_PER_DAY - 1));
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return [String(hour).padStart(2, "0"), String(minute).padStart(2, "0")].join(":");
}

/** Short zone abbreviation such as PDT or CET, for display next to a clock. */
export function timeZoneAbbreviation(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "short",
  }).formatToParts(date);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? timeZone;
}
