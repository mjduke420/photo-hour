import type { JSX } from "react";
import type { PointLight } from "../map/pinShadow.js";
export interface ShadowControlsProps {
    opacity: number;
    onOpacityChange(opacity: number): void;
    light: PointLight | null;
    sunIsUp: boolean;
}
/**
 * Overlay strength, plus a direct answer for the centre of the map.
 *
 * The overlay shows the whole scene at once, but when scouting one specific
 * spot the useful question is simply whether that spot is lit, so it gets
 * stated in words rather than left to be read off a colour.
 */
export declare function ShadowControls(props: ShadowControlsProps): JSX.Element;
//# sourceMappingURL=ShadowControls.d.ts.map