import type { JSX } from "react";
export interface SunCompassProps {
  /** Compass bearing of the sun in degrees clockwise from north. */
  azimuthDeg: number;
  altitudeDeg: number;
}

const SIZE = 108;
const CENTRE = SIZE / 2;
const RADIUS = 44;

/**
 * A dial showing which way to face and how high the sun sits.
 *
 * Azimuth in degrees is precise but hard to picture; seeing the marker sitting
 * north-west tells you where to stand at a glance.
 */
export function SunCompass(props: SunCompassProps): JSX.Element {
  const radians = (props.azimuthDeg - 90) * (Math.PI / 180);
  const x = CENTRE + RADIUS * Math.cos(radians);
  const y = CENTRE + RADIUS * Math.sin(radians);
  const above = props.altitudeDeg > 0;

  return (
    <svg
      className="compass"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={`Sun at ${Math.round(props.azimuthDeg)} degrees, ${Math.round(
        props.altitudeDeg,
      )} degrees above the horizon`}
    >
      <circle cx={CENTRE} cy={CENTRE} r={RADIUS} className="compass-ring" />
      <line x1={CENTRE} y1={6} x2={CENTRE} y2={16} className="compass-tick" />
      <text x={CENTRE} y={SIZE - 3} className="compass-label" textAnchor="middle">
        S
      </text>
      <text x={CENTRE} y={13} className="compass-label" textAnchor="middle">
        N
      </text>
      <line x1={CENTRE} y1={CENTRE} x2={x} y2={y} className="compass-ray" />
      <circle
        cx={x}
        cy={y}
        r={7}
        className={above ? "compass-sun compass-sun-up" : "compass-sun compass-sun-down"}
      />
    </svg>
  );
}
