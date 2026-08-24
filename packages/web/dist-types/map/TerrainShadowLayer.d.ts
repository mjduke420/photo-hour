import type { CustomLayerInterface, Map as MapLibreMap } from "maplibre-gl";
import type { DemTexture } from "./demStitcher.js";
/**
 * Draft quality is used while a control is being dragged: a smaller raster and
 * fewer ray steps keep the scrubber responsive. Full quality is restored as
 * soon as the interaction ends.
 */
export type ShadowQuality = "draft" | "full";
export interface SunSettings {
    altitude: number;
    azimuth: number;
}
export interface ShadowAppearance {
    opacity: number;
    /** RGB in the range 0 to 1. */
    color: [number, number, number];
}
/**
 * Renders where terrain blocks direct sunlight, as a darkening overlay.
 *
 * The shadow raster is computed in mercator space and pinned to the elevation
 * tile grid rather than to the screen, so panning and zooming reuse it without
 * recomputing. It is rebuilt only when the terrain or the sun changes.
 */
export declare class TerrainShadowLayer implements CustomLayerInterface {
    readonly id = "photo-hour-terrain-shadow";
    readonly type: "custom";
    readonly renderingMode: "2d";
    private map;
    private computeProgram;
    private compositeProgram;
    private computeQuad;
    private compositeQuad;
    private demGlTexture;
    private shadowGlTexture;
    private framebuffer;
    private dem;
    private demUploaded;
    private rasterWidth;
    private rasterHeight;
    private sun;
    private appearance;
    private quality;
    private needsCompute;
    onAdd(map: MapLibreMap, gl: WebGLRenderingContext): void;
    onRemove(_map: MapLibreMap, gl: WebGLRenderingContext): void;
    setDem(dem: DemTexture | null): void;
    setSun(sun: SunSettings): void;
    setAppearance(appearance: ShadowAppearance): void;
    setQuality(quality: ShadowQuality): void;
    private invalidate;
    /** MapLibre calls this before the main pass, which is where the raster is built. */
    prerender(gl: WebGLRenderingContext): void;
    render(gl: WebGLRenderingContext, args: unknown): void;
    private uploadDem;
    private resizeRaster;
    private runComputePass;
}
//# sourceMappingURL=TerrainShadowLayer.d.ts.map