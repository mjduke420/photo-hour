import type { DaylightPhase } from "@photo-hour/shared";

/** Colours for the twilight bands behind the time scrubber. */
export const PHASE_COLORS: Record<DaylightPhase, string> = {
  night: "#0a1020",
  astronomicalTwilight: "#141d3c",
  nauticalTwilight: "#20305f",
  blueHour: "#2e50a0",
  goldenHour: "#dd9b3c",
  day: "#9ccdf2",
};

export const PHASE_LABELS: Record<DaylightPhase, string> = {
  night: "Night",
  astronomicalTwilight: "Astronomical twilight",
  nauticalTwilight: "Nautical twilight",
  blueHour: "Blue hour",
  goldenHour: "Golden hour",
  day: "Daylight",
};

/** Phases worth calling out in a legend, brightest first. */
export const LEGEND_PHASES: DaylightPhase[] = [
  "day",
  "goldenHour",
  "blueHour",
  "nauticalTwilight",
  "night",
];
