import type { JSX } from "react";
import {
  clamp,
  formatMinutes,
  MINUTES_PER_DAY,
  type DaylightBand,
  type SunEvent,
} from "@photo-hour/shared";
import { useCallback, useRef, useState } from "react";
import { PHASE_COLORS, PHASE_LABELS } from "./phaseStyle.js";

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

const LAST_MINUTE = MINUTES_PER_DAY - 1;
const HOUR_TICKS = [0, 3, 6, 9, 12, 15, 18, 21];

/** Events worth marking on the track; the rest would just crowd it. */
const MARKED_EVENTS = new Set(["sunrise", "solarNoon", "sunset"]);

function percent(minutes: number): string {
  return `${(minutes / MINUTES_PER_DAY) * 100}%`;
}

/**
 * The draggable time-of-day control.
 *
 * The track doubles as a chart of the day: each band is coloured by the
 * photographic phase the sun is in, so golden hour is something you aim the
 * handle at rather than a number you have to look up.
 */
export function TimeScrubber(props: TimeScrubberProps): JSX.Element {
  const track = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const minutesAt = useCallback((clientX: number): number => {
    const element = track.current;
    if (!element) return 0;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0) return 0;
    return clamp((clientX - rect.left) / rect.width, 0, 1) * LAST_MINUTE;
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    props.onScrubStart();
    props.onChange(minutesAt(event.clientX));
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    props.onChange(minutesAt(event.clientX));
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
    props.onScrubEnd();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const coarse = event.shiftKey ? 60 : 15;
    const moves: Record<string, number | undefined> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowDown: -coarse,
      ArrowUp: coarse,
      PageDown: -60,
      PageUp: 60,
    };

    if (event.key === "Home") {
      event.preventDefault();
      props.onChange(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      props.onChange(LAST_MINUTE);
      return;
    }

    const delta = moves[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    props.onChange(clamp(props.minutes + delta, 0, LAST_MINUTE));
  };

  return (
    <div className="scrubber">
      <button
        type="button"
        className="scrubber-play"
        onClick={props.onTogglePlay}
        aria-pressed={props.playing}
        aria-label={props.playing ? "Pause the day" : "Play through the day"}
      >
        {props.playing ? "Pause" : "Play"}
      </button>

      <div className="scrubber-main">
        <div
          className="scrubber-track"
          ref={track}
          role="slider"
          tabIndex={0}
          aria-label="Time of day"
          aria-valuemin={0}
          aria-valuemax={LAST_MINUTE}
          aria-valuenow={Math.round(props.minutes)}
          aria-valuetext={`${formatMinutes(props.minutes)} ${props.timeZoneLabel}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={handleKeyDown}
          data-testid="time-track"
        >
          {props.bands.map((band) => (
            <span
              key={`${band.phase}-${band.startMinutes}`}
              className="scrubber-band"
              title={PHASE_LABELS[band.phase]}
              style={{
                left: percent(band.startMinutes),
                width: percent(band.endMinutes - band.startMinutes),
                background: PHASE_COLORS[band.phase],
              }}
            />
          ))}

          {props.events
            .filter((event) => event.minutes !== null && !event.otherDay)
            .filter((event) => MARKED_EVENTS.has(event.key))
            .map((event) => (
              <span
                key={event.key}
                className="scrubber-event"
                style={{ left: percent(event.minutes as number) }}
                title={`${event.label} ${formatMinutes(event.minutes as number)}`}
              />
            ))}

          <span
            className="scrubber-handle"
            style={{ left: percent(props.minutes) }}
            data-testid="time-handle"
          >
            <span className="scrubber-readout">{formatMinutes(props.minutes)}</span>
          </span>
        </div>

        <div className="scrubber-hours" aria-hidden="true">
          {HOUR_TICKS.map((hour) => (
            <span key={hour} style={{ left: percent(hour * 60) }}>
              {String(hour).padStart(2, "0")}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
