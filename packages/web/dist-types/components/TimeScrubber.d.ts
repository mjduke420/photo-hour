import type { JSX } from "react";
import { type DaylightBand, type SunEvent } from "@photo-hour/shared";
export interface TimeScrubberProps {
    minutes: number;
    bands: DaylightBand[];
    events: SunEvent[];
    timeZoneLabel: string;
    playing: boolean;
    onChange(minutes: number): void;
    onScrubStart(): void;
    onScrubEnd(): void;
    onTogglePlay(): void;
}
/**
 * The draggable time-of-day control.
 *
 * The track doubles as a chart of the day: each band is coloured by the
 * photographic phase the sun is in, so golden hour is something you aim the
 * handle at rather than a number you have to look up.
 */
export declare function TimeScrubber(props: TimeScrubberProps): JSX.Element;
//# sourceMappingURL=TimeScrubber.d.ts.map