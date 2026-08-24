import type { JSX } from "react";
import { type SunEvent, type SunPosition } from "@photo-hour/shared";
export interface SunInfoPanelProps {
    sun: SunPosition;
    events: SunEvent[];
    lat: number;
    lng: number;
}
export declare function SunInfoPanel(props: SunInfoPanelProps): JSX.Element;
//# sourceMappingURL=SunInfoPanel.d.ts.map