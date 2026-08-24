import { formatMinutes, timeZoneAbbreviation } from "@photo-hour/shared";
import { useEffect, useMemo, useState, type JSX } from "react";
import { fetchClientConfig, type ClientConfig } from "./api/client.js";
import { DatePanel } from "./components/DatePanel.js";
import { LayerSwitcher } from "./components/LayerSwitcher.js";
import { SearchBox } from "./components/SearchBox.js";
import { ShadowControls } from "./components/ShadowControls.js";
import { SunInfoPanel } from "./components/SunInfoPanel.js";
import { TimeScrubber } from "./components/TimeScrubber.js";
import { availableBasemaps } from "./map/basemaps.js";
import type { DemTexture } from "./map/demStitcher.js";
import { MapView } from "./map/MapView.js";
import { lightAtPoint } from "./map/pinShadow.js";
import { useAppState } from "./state/useAppState.js";

export function App(): JSX.Element {
  const [state, actions, derived] = useAppState();
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [dem, setDem] = useState<DemTexture | null>(null);
  const [loadingTerrain, setLoadingTerrain] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  useEffect(() => {
    let live = true;
    void fetchClientConfig().then((loaded) => {
      if (live) setConfig(loaded);
    });
    return () => {
      live = false;
    };
  }, []);

  // Drop to the cheaper shadow model whenever the time is moving, so dragging
  // the scrubber stays smooth, and go back to full detail once it settles.
  const quality = scrubbing || state.playing ? "draft" : "full";

  const light = useMemo(
    () => lightAtPoint(dem, { lat: state.lat, lng: state.lng }, derived.sun),
    [dem, state.lat, state.lng, derived.sun],
  );

  const basemaps = useMemo(
    () => availableBasemaps(config?.maptilerKey ?? null),
    [config?.maptilerKey],
  );

  const zoneLabel = timeZoneAbbreviation(derived.instant, derived.timeZone);

  return (
    <div className="app">
      <MapView
        lng={state.lng}
        lat={state.lat}
        zoom={state.zoom}
        basemapId={state.basemap}
        maptilerKey={config?.maptilerKey ?? null}
        sun={derived.sun}
        opacity={state.opacity}
        quality={quality}
        onViewChange={actions.setView}
        onTerrainChange={setDem}
        onLoadingChange={setLoadingTerrain}
      />

      <div className="crosshair" aria-hidden="true" />

      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">Photo Hour</span>
        </div>

        <SearchBox onSelect={actions.goToPlace} />

        <div className="topbar-right">
          <LayerSwitcher
            options={basemaps}
            selected={state.basemap}
            onSelect={actions.setBasemap}
          />
          <button
            type="button"
            className="ghost-button panel-toggle"
            aria-expanded={panelOpen}
            onClick={() => setPanelOpen((open) => !open)}
          >
            {panelOpen ? "Hide panel" : "Show panel"}
          </button>
        </div>
      </header>

      {panelOpen ? (
        <aside className="panel" aria-label="Shoot planning">
          <div className="clock">
            <span className="clock-time" data-testid="clock-time">
              {formatMinutes(state.minutes)}
            </span>
            <span className="clock-zone">{zoneLabel}</span>
          </div>

          {/* The light state answers the question being asked and changes with
              every scrub, so it sits above the fold; the date and the event
              times are set once and can be scrolled to. */}
          <ShadowControls
            opacity={state.opacity}
            onOpacityChange={actions.setOpacity}
            light={light}
            sunIsUp={derived.sun.isUp}
          />

          <DatePanel
            dateISO={state.dateISO}
            timeZone={derived.timeZone}
            timeZoneLabel={zoneLabel}
            onDateChange={actions.setDateISO}
            onStepDays={actions.stepDays}
            onJumpToNow={actions.jumpToNow}
          />

          <SunInfoPanel
            sun={derived.sun}
            events={derived.events}
            lat={state.lat}
            lng={state.lng}
          />

          <p className="attribution-note">
            {config?.attribution.elevation ?? "Elevation: Mapzen terrain tiles via AWS Open Data"}
          </p>
        </aside>
      ) : null}

      <footer className="dock">
        {loadingTerrain ? (
          <span className="terrain-status" role="status">
            Loading terrain
          </span>
        ) : null}

        <TimeScrubber
          minutes={state.minutes}
          bands={derived.bands}
          events={derived.events}
          timeZoneLabel={zoneLabel}
          playing={state.playing}
          onChange={actions.setMinutes}
          onScrubStart={() => setScrubbing(true)}
          onScrubEnd={() => setScrubbing(false)}
          onTogglePlay={() => actions.setPlaying(!state.playing)}
        />
      </footer>
    </div>
  );
}
