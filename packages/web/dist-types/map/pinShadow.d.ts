import { type HeightField, type SunVector } from "@photo-hour/shared";
import type { DemTexture } from "./demStitcher.js";
/**
 * Reads elevation straight out of the packed tile bytes.
 *
 * A point query touches four texels, so decoding the whole raster into floats
 * first would waste several megabytes and a full pass over it for one answer.
 */
export declare function heightFieldFromDem(dem: DemTexture): HeightField;
export interface PointLight {
    /** 0 in full sun, 1 fully shadowed, in between during the penumbra. */
    shadow: number;
    elevation: number | null;
}
/**
 * Whether one specific spot is lit, answered on the CPU.
 *
 * The overlay already shades the whole view, but a photographer standing at a
 * chosen spot wants a straight answer about that spot, and the GPU raster is
 * not readable without an expensive pixel read-back.
 */
export declare function lightAtPoint(dem: DemTexture | null, point: {
    lng: number;
    lat: number;
}, sun: SunVector): PointLight | null;
//# sourceMappingURL=pinShadow.d.ts.map