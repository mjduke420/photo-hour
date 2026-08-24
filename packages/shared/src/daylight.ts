import SunCalc from "suncalc";
import { sunPosition } from "./sun.js";
import { MINUTES_PER_DAY, minutesOfDayInZone, toDateISOInZone, zonedWallTimeToUtc } from "./time.js";

/**
 * Photographic phases of the day, ordered from darkest to brightest. Boundaries
 * are expressed as solar altitude rather than clock times so that polar days,
 * polar nights and daylight-saving transitions all fall out for free.
 */
export type DaylightPhase =
  | "night"
  | "astronomicalTwilight"
  | "nauticalTwilight"
  | "blueHour"
  | "goldenHour"
  | "day";

/** Lower altitude bound of each phase, in degrees above the horizon. */
export const PHASE_MIN_ALTITUDE_DEG: Record<DaylightPhase, number> = {
  day: 6,
  goldenHour: -4,
  blueHour: -6,
  nauticalTwilight: -12,
  astronomicalTwilight: -18,
  night: Number.NEGATIVE_INFINITY,
};

export function phaseForAltitude(altitudeDeg: number): DaylightPhase {
  if (altitudeDeg >= PHASE_MIN_ALTITUDE_DEG.day) return "day";
  if (altitudeDeg >= PHASE_MIN_ALTITUDE_DEG.goldenHour) return "goldenHour";
  if (altitudeDeg >= PHASE_MIN_ALTITUDE_DEG.blueHour) return "blueHour";
  if (altitudeDeg >= PHASE_MIN_ALTITUDE_DEG.nauticalTwilight) return "nauticalTwilight";
  if (altitudeDeg >= PHASE_MIN_ALTITUDE_DEG.astronomicalTwilight) return "astronomicalTwilight";
  return "night";
}

export interface DaylightBand {
  phase: DaylightPhase;
  /** Minutes since local midnight. */
  startMinutes: number;
  endMinutes: number;
}

/**
 * Splits a local calendar day into contiguous phase bands by sampling the solar
 * altitude. Sampling beats reading SunCalc event times directly because event
 * times are undefined at high latitudes, whereas altitude is always defined.
 */
export function daylightBands(
  dateISO: string,
  lat: number,
  lng: number,
  timeZone: string,
  sampleMinutes = 2,
): DaylightBand[] {
  const step = Math.max(1, sampleMinutes);
  const bands: DaylightBand[] = [];

  for (let minutes = 0; minutes <= MINUTES_PER_DAY; minutes += step) {
    const at = Math.min(minutes, MINUTES_PER_DAY);
    const instant = zonedWallTimeToUtc(dateISO, at, timeZone);
    const phase = phaseForAltitude(sunPosition(instant, lat, lng).altitudeDeg);
    const previous = bands[bands.length - 1];

    if (previous && previous.phase === phase) {
      previous.endMinutes = at;
    } else {
      if (previous) previous.endMinutes = at;
      bands.push({ phase, startMinutes: at, endMinutes: at });
    }
  }

  const last = bands[bands.length - 1];
  if (last) last.endMinutes = MINUTES_PER_DAY;
  return bands;
}

export interface SunEvent {
  key: string;
  label: string;
  /** Null when the event does not occur on this date, e.g. during polar night. */
  minutes: number | null;
  instant: Date | null;
  /** True when the event lands on a different local calendar day. */
  otherDay: boolean;
}

const EVENT_LABELS: ReadonlyArray<readonly [keyof SunCalc.GetTimesResult, string]> = [
  ["dawn", "Civil dawn"],
  ["sunrise", "Sunrise"],
  ["goldenHourEnd", "Golden hour ends"],
  ["solarNoon", "Solar noon"],
  ["goldenHour", "Golden hour starts"],
  ["sunset", "Sunset"],
  ["dusk", "Civil dusk"],
];

/** Key solar events for a local calendar day, ready for display in a panel. */
export function sunEvents(
  dateISO: string,
  lat: number,
  lng: number,
  timeZone: string,
): SunEvent[] {
  const localNoon = zonedWallTimeToUtc(dateISO, MINUTES_PER_DAY / 2, timeZone);
  const times = SunCalc.getTimes(localNoon, lat, lng);

  return EVENT_LABELS.map(([key, label]) => {
    const instant = times[key];
    if (!(instant instanceof Date) || Number.isNaN(instant.getTime())) {
      return { key, label, minutes: null, instant: null, otherDay: false };
    }
    return {
      key,
      label,
      minutes: minutesOfDayInZone(instant, timeZone),
      instant,
      otherDay: toDateISOInZone(instant, timeZone) !== dateISO,
    };
  });
}

/** Longest stretch of full daylight in a set of bands, useful as a scrubber default. */
export function brightestBand(bands: DaylightBand[]): DaylightBand | null {
  let best: DaylightBand | null = null;
  for (const band of bands) {
    if (band.phase !== "day") continue;
    const span = band.endMinutes - band.startMinutes;
    if (!best || span > best.endMinutes - best.startMinutes) best = band;
  }
  return best;
}
