export interface ClientConfig {
    maptilerKey: string | null;
    demMaxZoom: number;
    attribution: {
        elevation: string;
        basemap: string;
    };
}
export interface PlaceResult {
    name: string;
    lat: number;
    lng: number;
    kind: string;
}
/**
 * Bootstrap values from the server. A failure here is not fatal: the app falls
 * back to the keyless basemaps rather than refusing to start.
 */
export declare function fetchClientConfig(): Promise<ClientConfig>;
export declare class PlaceSearchError extends Error {
}
export declare function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceResult[]>;
//# sourceMappingURL=client.d.ts.map