import { type BoundsLngLat } from "@photo-hour/shared";
/** Stitched elevation raster, ready to upload as a WebGL texture. */
export interface DemTexture {
    /** Raw Terrarium RGBA bytes, decoded on the GPU rather than here. */
    pixels: Uint8Array;
    width: number;
    height: number;
    /** Mercator coordinate of the north-west corner. */
    originX: number;
    originY: number;
    spanX: number;
    spanY: number;
    maxElevation: number;
    zoom: number;
    /** Identity of the covered area, so callers can skip redundant reloads. */
    key: string;
}
export interface DemRequest {
    bounds: BoundsLngLat;
    mapZoom: number;
    /** Compass bearing of the sun in radians, used to bias the fetch margin. */
    sunAzimuth: number;
    sunAltitude: number;
}
export interface MercatorBox {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}
export declare function boundsToMercator(bounds: BoundsLngLat): MercatorBox;
/**
 * Grows the box towards the sun only.
 *
 * Blocking terrain always lies between a point and the sun, so widening the
 * fetch in every direction would quadruple the tile count for no benefit.
 */
export declare function expandTowardsSun(box: MercatorBox, sunAzimuth: number, sunAltitude: number): MercatorBox;
export interface TilePlan {
    zoom: number;
    minTileX: number;
    minTileY: number;
    columns: number;
    rows: number;
}
/** Picks the highest elevation zoom whose tile count stays within budget. */
export declare function planTiles(box: MercatorBox, mapZoom: number): TilePlan;
/**
 * Fetches the elevation tiles covering a view plus its sunward margin and
 * stitches them into one raster.
 */
export declare function loadDem(request: DemRequest, signal?: AbortSignal): Promise<DemTexture | null>;
//# sourceMappingURL=demStitcher.d.ts.map