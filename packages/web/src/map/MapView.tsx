import type { JSX } from "react";
import type { SunPosition } from "@photo-hour/shared";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef } from "react";
import { findBasemap } from "./basemaps.js";
import { loadDem, type DemTexture } from "./demStitcher.js";
import { TerrainShadowLayer, type ShadowQuality } from "./TerrainShadowLayer.js";

export interface MapViewProps {
  lng: number;
  lat: number;
  zoom: number;
  basemapId: string;
  maptilerKey: string | null;
  sun: SunPosition;
  opacity: number;
  quality: ShadowQuality;
  onViewChange(view: { lng: number; lat: number; zoom: number }): void;
  onTerrainChange(dem: DemTexture | null): void;
  onLoadingChange(loading: boolean): void;
}

const DEM_RELOAD_DELAY_MS = 250;
const SHADOW_COLOR: [number, number, number] = [0.04, 0.06, 0.14];

export function MapView(props: MapViewProps): JSX.Element {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<MapLibreMap | null>(null);
  const layer = useRef<TerrainShadowLayer | null>(null);
  const loadedKey = useRef<string | null>(null);
  const inFlight = useRef<AbortController | null>(null);

  // Props the imperative map callbacks need without re-subscribing every render.
  const latest = useRef(props);
  latest.current = props;

  // Create the map once. Subsequent prop changes are applied imperatively,
  // because MapLibre owns the view state and re-creating it would lose it.
  useEffect(() => {
    if (!container.current || map.current) return undefined;

    const shadowLayer = new TerrainShadowLayer();
    layer.current = shadowLayer;

    const instance = new maplibregl.Map({
      container: container.current,
      style: resolveStyle(latest.current) ?? undefined,
      center: [latest.current.lng, latest.current.lat],
      zoom: latest.current.zoom,
      // Attribution is added explicitly below so it can share the left side
      // with the other controls, clear of the planning panel.
      attributionControl: false,
      // The shadow model is a plan view of the ground, so tilting the camera
      // would imply a three-dimensional result the overlay does not produce.
      maxPitch: 0,
      dragRotate: false,
    });
    map.current = instance;

    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-left");
    instance.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    instance.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

    const attachLayer = () => {
      if (!instance.getLayer(shadowLayer.id)) instance.addLayer(shadowLayer);
      shadowLayer.setSun(latest.current.sun);
      shadowLayer.setAppearance({ opacity: latest.current.opacity, color: SHADOW_COLOR });
    };

    const publishView = () => {
      const centre = instance.getCenter();
      latest.current.onViewChange({
        lng: centre.lng,
        lat: centre.lat,
        zoom: instance.getZoom(),
      });
    };

    instance.on("load", attachLayer);
    // A style change discards custom layers, so it has to be re-attached.
    instance.on("styledata", attachLayer);
    instance.on("moveend", publishView);

    return () => {
      inFlight.current?.abort();
      instance.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);

  // Keep the camera in step when state changes from outside the map, such as a
  // search result, without fighting the user mid-gesture.
  useEffect(() => {
    const instance = map.current;
    if (!instance || instance.isMoving()) return;
    const centre = instance.getCenter();
    const moved =
      Math.abs(centre.lng - props.lng) > 1e-6 || Math.abs(centre.lat - props.lat) > 1e-6;
    if (moved) instance.easeTo({ center: [props.lng, props.lat], duration: 600 });
  }, [props.lng, props.lat]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const style = resolveStyle(props);
    if (style) instance.setStyle(style as never, { diff: false });
  }, [props.basemapId, props.maptilerKey]);

  useEffect(() => {
    layer.current?.setSun({ altitude: props.sun.altitude, azimuth: props.sun.azimuth });
  }, [props.sun.altitude, props.sun.azimuth]);

  useEffect(() => {
    layer.current?.setAppearance({ opacity: props.opacity, color: SHADOW_COLOR });
  }, [props.opacity]);

  useEffect(() => {
    layer.current?.setQuality(props.quality);
  }, [props.quality]);

  // Reload terrain when the view or the sun direction moves the required
  // coverage. Held off while a control is being dragged, so scrubbing through
  // the day never blocks on a network fetch.
  useEffect(() => {
    if (props.quality === "draft") return undefined;

    const handle = window.setTimeout(() => {
      void refreshTerrain();
    }, DEM_RELOAD_DELAY_MS);

    return () => window.clearTimeout(handle);
  }, [props.lng, props.lat, props.zoom, props.sun.azimuth, props.sun.altitude, props.quality]);

  async function refreshTerrain(): Promise<void> {
    const instance = map.current;
    const shadowLayer = layer.current;
    if (!instance || !shadowLayer) return;

    const bounds = instance.getBounds();
    const request = {
      bounds: {
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
      },
      mapZoom: instance.getZoom(),
      sunAzimuth: latest.current.sun.azimuth,
      sunAltitude: latest.current.sun.altitude,
    };

    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    latest.current.onLoadingChange(true);
    const dem = await loadDem(request, controller.signal).catch(() => null);
    if (controller.signal.aborted) return;
    latest.current.onLoadingChange(false);

    if (!dem || dem.key === loadedKey.current) return;
    loadedKey.current = dem.key;
    shadowLayer.setDem(dem);
    latest.current.onTerrainChange(dem);
  }

  return <div className="map-canvas" ref={container} data-testid="map-canvas" />;
}

function resolveStyle(props: Pick<MapViewProps, "basemapId" | "maptilerKey">) {
  return findBasemap(props.basemapId, props.maptilerKey).resolve(props.maptilerKey);
}
