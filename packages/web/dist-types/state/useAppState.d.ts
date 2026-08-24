import { type DaylightBand, type SunEvent, type SunPosition } from "@photo-hour/shared";
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
    setView(view: {
        lng: number;
        lat: number;
        zoom: number;
    }): void;
    setDateISO(dateISO: string): void;
    stepDays(delta: number): void;
    setMinutes(minutes: number): void;
    setBasemap(id: string): void;
    setOpacity(opacity: number): void;
    setPlaying(playing: boolean): void;
    goToPlace(place: {
        lat: number;
        lng: number;
    }): void;
    jumpToNow(): void;
}
/**
 * Single source of truth for what the map is showing.
 *
 * Time is held as a local calendar date plus minutes since local midnight
 * rather than as an instant, because that is what a photographer plans around:
 * "quarter past six on the fourteenth", in the time zone of the location, not
 * of whoever is looking at the screen.
 */
export declare function useAppState(): [AppState, AppActions, DerivedState];
//# sourceMappingURL=useAppState.d.ts.map