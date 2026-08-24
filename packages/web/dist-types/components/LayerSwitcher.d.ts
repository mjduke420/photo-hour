import type { JSX } from "react";
import type { BasemapOption } from "../map/basemaps.js";
export interface LayerSwitcherProps {
    options: BasemapOption[];
    selected: string;
    onSelect(id: string): void;
}
export declare function LayerSwitcher(props: LayerSwitcherProps): JSX.Element;
//# sourceMappingURL=LayerSwitcher.d.ts.map