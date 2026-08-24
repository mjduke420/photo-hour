import type { JSX } from "react";
import type { SunPosition } from "@photo-hour/shared";
import { type DemTexture } from "./demStitcher.js";
import { type ShadowQuality } from "./TerrainShadowLayer.js";
export interface MapViewProps {
    lng: number;
    lat: number;
    zoom: number;
    basemapId: string;
    maptilerKey: string | null;
    sun: SunPosition;
    opacity: number;
    quality: ShadowQuality;
    onViewChange(view: {
        lng: number;
        lat: number;
        zoom: number;
    }): void;
    onTerrainChange(dem: DemTexture | null): void;
    onLoadingChange(loading: boolean): void;
}
export declare function MapView(props: MapViewProps): JSX.Element;
//# sourceMappingURL=MapView.d.ts.map