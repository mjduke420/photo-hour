import {
  clamp,
  daylightBands,
  decodeUrlState,
  encodeUrlState,
  MINUTES_PER_DAY,
  minutesOfDayInZone,
  sunEvents,
  sunPosition,
  timeZoneForLocation,
  toDateISOInZone,
  zonedWallTimeToUtc,
  type DaylightBand,
  type SunEvent,
  type SunPosition,
} from "@photo-hour/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_BASEMAP_ID } from "../map/basemaps.js";

/**
 * Moraine Lake in Banff. A deliberately dramatic default: on flat ground the
 * overlay has almost nothing to draw, so the first view should be somewhere the
 * terrain obviously shapes the light.
 */
const DEFAULT_VIEW = { lng: -116.186, lat: 51.3217, zoom: 12.5 };

/** Simulated minutes advanced per animation frame while playing. */
const PLAY_MINUTES_PER_FRAME = 2;

export interface AppState {
  lng: number;
  lat: number;
  zoom: number;
  /** Calendar date in the local time zone of the mapped location. */
  dateISO: string;
  /** Minutes since local midnight. Fractional while scrubbing. */
  minutes: number;
  basemap: string;
  opacity: number;
  playing: boolean;
}

export interface DerivedState {
  timeZone: string;
  instant: Date;
  sun: SunPosition;
  bands: DaylightBand[];
  events: SunEvent[];
}

export interface AppActions {
  setView(view: { lng: number; lat: number; zoom: number }): void;
  setDateISO(dateISO: string): void;
  stepDays(delta: number): void;
  setMinutes(minutes: number): void;
  setBasemap(id: string): void;
  setOpacity(opacity: number): void;
  setPlaying(playing: boolean): void;
  goToPlace(place: { lat: number; lng: number }): void;
  jumpToNow(): void;
}

function initialState(): AppState {
  const fromUrl = typeof window === "undefined" ? {} : decodeUrlState(window.location.hash);

  const lat = fromUrl.lat ?? DEFAULT_VIEW.lat;
  const lng = fromUrl.lng ?? DEFAULT_VIEW.lng;
  const zone = timeZoneForLocation(lat, lng);
  const now = new Date();

  return {
    lat,
    lng,
    zoom: fromUrl.zoom ?? DEFAULT_VIEW.zoom,
    dateISO: fromUrl.dateISO ?? toDateISOInZone(now, zone),
    minutes: fromUrl.minutes ?? Math.round(minutesOfDayInZone(now, zone)),
    basemap: fromUrl.basemap ?? DEFAULT_BASEMAP_ID,
    opacity: 0.55,
    playing: false,
  };
}

function shiftDate(dateISO: string, days: number): string {
  const [year = 1970, month = 1, day = 1] = dateISO.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    String(shifted.getUTCFullYear()).padStart(4, "0"),
    pad(shifted.getUTCMonth() + 1),
    pad(shifted.getUTCDate()),
  ].join("-");
}

/**
 * Single source of truth for what the map is showing.
 *
 * Time is held as a local calendar date plus minutes since local midnight
 * rather than as an instant, because that is what a photographer plans around:
 * "quarter past six on the fourteenth", in the time zone of the location, not
 * of whoever is looking at the screen.
 */
export function useAppState(): [AppState, AppActions, DerivedState] {
  const [state, setState] = useState<AppState>(initialState);

  const timeZone = useMemo(
    () => timeZoneForLocation(state.lat, state.lng),
    [state.lat, state.lng],
  );

  const instant = useMemo(
    () => zonedWallTimeToUtc(state.dateISO, state.minutes, timeZone),
    [state.dateISO, state.minutes, timeZone],
  );

  const sun = useMemo(
    () => sunPosition(instant, state.lat, state.lng),
    [instant, state.lat, state.lng],
  );

  // The phase bands and event times barely move over a few kilometres, so they
  // are recomputed on a coarse grid instead of on every pixel of panning.
  const coarseLat = Math.round(state.lat * 20) / 20;
  const coarseLng = Math.round(state.lng * 20) / 20;

  const bands = useMemo(
    () => daylightBands(state.dateISO, coarseLat, coarseLng, timeZone),
    [state.dateISO, coarseLat, coarseLng, timeZone],
  );

  const events = useMemo(
    () => sunEvents(state.dateISO, coarseLat, coarseLng, timeZone),
    [state.dateISO, coarseLat, coarseLng, timeZone],
  );

  const setView = useCallback((view: { lng: number; lat: number; zoom: number }) => {
    setState((current) => ({ ...current, ...view }));
  }, []);

  const setDateISO = useCallback((dateISO: string) => {
    setState((current) => ({ ...current, dateISO }));
  }, []);

  const stepDays = useCallback((delta: number) => {
    setState((current) => ({ ...current, dateISO: shiftDate(current.dateISO, delta) }));
  }, []);

  const setMinutes = useCallback((minutes: number) => {
    setState((current) => ({
      ...current,
      minutes: clamp(minutes, 0, MINUTES_PER_DAY - 1),
    }));
  }, []);

  const setBasemap = useCallback((basemap: string) => {
    setState((current) => ({ ...current, basemap }));
  }, []);

  const setOpacity = useCallback((opacity: number) => {
    setState((current) => ({ ...current, opacity: clamp(opacity, 0, 1) }));
  }, []);

  const setPlaying = useCallback((playing: boolean) => {
    setState((current) => ({ ...current, playing }));
  }, []);

  const goToPlace = useCallback((place: { lat: number; lng: number }) => {
    setState((current) => ({ ...current, lat: place.lat, lng: place.lng }));
  }, []);

  const jumpToNow = useCallback(() => {
    setState((current) => {
      const zone = timeZoneForLocation(current.lat, current.lng);
      const now = new Date();
      return {
        ...current,
        dateISO: toDateISOInZone(now, zone),
        minutes: Math.round(minutesOfDayInZone(now, zone)),
        playing: false,
      };
    });
  }, []);

  useAnimatedTime(state.playing, setState);
  useUrlSync(state);

  const actions = useMemo<AppActions>(
    () => ({
      setView,
      setDateISO,
      stepDays,
      setMinutes,
      setBasemap,
      setOpacity,
      setPlaying,
      goToPlace,
      jumpToNow,
    }),
    [
      setView,
      setDateISO,
      stepDays,
      setMinutes,
      setBasemap,
      setOpacity,
      setPlaying,
      goToPlace,
      jumpToNow,
    ],
  );

  return [state, actions, { timeZone, instant, sun, bands, events }];
}

/** Sweeps the clock forward while playing, wrapping at midnight. */
function useAnimatedTime(
  playing: boolean,
  setState: React.Dispatch<React.SetStateAction<AppState>>,
): void {
  const frame = useRef(0);

  useEffect(() => {
    if (!playing) return undefined;

    const tick = () => {
      setState((current) => ({
        ...current,
        minutes: (current.minutes + PLAY_MINUTES_PER_FRAME) % MINUTES_PER_DAY,
      }));
      frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [playing, setState]);
}

/** Mirrors the shareable state into the URL hash without growing history. */
function useUrlSync(state: AppState): void {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handle = window.setTimeout(() => {
      const hash = encodeUrlState({
        zoom: state.zoom,
        lat: state.lat,
        lng: state.lng,
        dateISO: state.dateISO,
        minutes: state.minutes,
        basemap: state.basemap,
      });
      window.history.replaceState(null, "", hash);
    }, 250);

    return () => window.clearTimeout(handle);
  }, [state.zoom, state.lat, state.lng, state.dateISO, state.minutes, state.basemap]);
}
