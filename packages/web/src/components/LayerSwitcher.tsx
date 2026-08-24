import type { JSX } from "react";
import type { BasemapOption } from "../map/basemaps.js";

export interface LayerSwitcherProps {
  options: BasemapOption[];
  selected: string;
  onSelect(id: string): void;
}

export function LayerSwitcher(props: LayerSwitcherProps): JSX.Element {
  return (
    <div className="layer-switcher" role="group" aria-label="Basemap">
      {props.options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={option.id === props.selected ? "chip chip-active" : "chip"}
          aria-pressed={option.id === props.selected}
          title={option.description}
          onClick={() => props.onSelect(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
