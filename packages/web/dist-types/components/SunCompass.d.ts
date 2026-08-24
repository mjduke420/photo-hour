import type { JSX } from "react";
export interface SunCompassProps {
    /** Compass bearing of the sun in degrees clockwise from north. */
    azimuthDeg: number;
    altitudeDeg: number;
}
/**
 * A dial showing which way to face and how high the sun sits.
 *
 * Azimuth in degrees is precise but hard to picture; seeing the marker sitting
 * north-west tells you where to stand at a glance.
 */
export declare function SunCompass(props: SunCompassProps): JSX.Element;
//# sourceMappingURL=SunCompass.d.ts.map