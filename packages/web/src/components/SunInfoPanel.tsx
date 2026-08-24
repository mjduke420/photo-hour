import type { JSX } from "react";
import { formatMinutes, type SunEvent, type SunPosition } from "@photo-hour/shared";
import { LEGEND_PHASES, PHASE_COLORS, PHASE_LABELS } from "./phaseStyle.js";
import { SunCompass } from "./SunCompass.js";

export interface SunInfoPanelProps {
  sun: SunPosition;
  events: SunEvent[];
  lat: number;
  lng: number;
}

function compassPoint(azimuthDeg: number): string {
  const points = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const index = Math.round(azimuthDeg / 22.5) % 16;
  return points[index] ?? "N";
}

export function SunInfoPanel(props: SunInfoPanelProps): JSX.Element {
  return (
    <section className="panel-section" aria-labelledby="sun-heading">
      <h2 id="sun-heading" className="panel-heading">
        Sun
      </h2>

      <div className="sun-row">
        <SunCompass azimuthDeg={props.sun.azimuthDeg} altitudeDeg={props.sun.altitudeDeg} />
        <dl className="sun-figures">
          <div>
            <dt>Direction</dt>
            <dd data-testid="sun-azimuth">
              {Math.round(props.sun.azimuthDeg)}&deg; {compassPoint(props.sun.azimuthDeg)}
            </dd>
          </div>
          <div>
            <dt>Altitude</dt>
            <dd data-testid="sun-altitude">{props.sun.altitudeDeg.toFixed(1)}&deg;</dd>
          </div>
          <div>
            <dt>Position</dt>
            <dd>
              {props.lat.toFixed(4)}, {props.lng.toFixed(4)}
            </dd>
          </div>
        </dl>
      </div>

      <ul className="event-list">
        {props.events.map((event) => (
          <li key={event.key}>
            <span>{event.label}</span>
            <span className="event-time">
              {event.minutes === null ? "does not occur" : formatMinutes(event.minutes)}
              {event.otherDay && event.minutes !== null ? " (next day)" : ""}
            </span>
          </li>
        ))}
      </ul>

      <ul className="legend" aria-label="Daylight phases">
        {LEGEND_PHASES.map((phase) => (
          <li key={phase}>
            <span className="legend-swatch" style={{ background: PHASE_COLORS[phase] }} />
            {PHASE_LABELS[phase]}
          </li>
        ))}
      </ul>
    </section>
  );
}
