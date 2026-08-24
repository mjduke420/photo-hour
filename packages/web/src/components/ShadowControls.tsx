import type { JSX } from "react";
import type { PointLight } from "../map/pinShadow.js";

export interface ShadowControlsProps {
  opacity: number;
  onOpacityChange(opacity: number): void;
  light: PointLight | null;
  sunIsUp: boolean;
}

function describe(light: PointLight | null, sunIsUp: boolean): string {
  if (!sunIsUp) return "The sun is below the horizon";
  if (!light) return "Waiting for terrain";
  if (light.shadow >= 0.85) return "In terrain shadow";
  if (light.shadow >= 0.15) return "On the shadow edge";
  return "In direct sun";
}

/**
 * Overlay strength, plus a direct answer for the centre of the map.
 *
 * The overlay shows the whole scene at once, but when scouting one specific
 * spot the useful question is simply whether that spot is lit, so it gets
 * stated in words rather than left to be read off a colour.
 */
export function ShadowControls(props: ShadowControlsProps): JSX.Element {
  const state = describe(props.light, props.sunIsUp);
  const lit = props.sunIsUp && props.light !== null && props.light.shadow < 0.15;

  return (
    <section className="panel-section" aria-labelledby="shadow-heading">
      <h2 id="shadow-heading" className="panel-heading">
        Shadows
      </h2>

      <p className={`light-state ${lit ? "light-state-lit" : "light-state-shaded"}`}>
        <span className="light-dot" aria-hidden="true" />
        <span data-testid="light-state">{state}</span>
      </p>

      {props.light?.elevation !== null && props.light !== null ? (
        <p className="muted">Ground elevation {Math.round(props.light.elevation)} m</p>
      ) : null}

      <label className="slider-row">
        <span>Overlay strength</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(props.opacity * 100)}
          onChange={(event) => props.onOpacityChange(Number(event.target.value) / 100)}
          aria-label="Shadow overlay strength"
        />
        <span className="slider-value">{Math.round(props.opacity * 100)}%</span>
      </label>
    </section>
  );
}
