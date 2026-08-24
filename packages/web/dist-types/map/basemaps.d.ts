import type { StyleSpecification } from "maplibre-gl";
export interface BasemapOption {
    id: string;
    label: string;
    description: string;
    /** MapTiler styles need a key; the OSM and Carto rasters do not. */
    requiresKey: boolean;
    resolve(maptilerKey: string | null): StyleSpecification | string | null;
}
/**
 * Ordered by usefulness for scouting: the muted styles are first because a
 * loud basemap fights with the shadow overlay for attention.
 */
export declare const BASEMAPS: BasemapOption[];
export declare const DEFAULT_BASEMAP_ID = "muted";
/** Only the styles this deployment can actually load. */
export declare function availableBasemaps(maptilerKey: string | null): BasemapOption[];
export declare function findBasemap(id: string, maptilerKey: string | null): BasemapOption;
//# sourceMappingURL=basemaps.d.ts.map