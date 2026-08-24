import type { JSX } from "react";
import { type PlaceResult } from "../api/client.js";
export interface SearchBoxProps {
    onSelect(place: PlaceResult): void;
}
export declare function SearchBox(props: SearchBoxProps): JSX.Element;
//# sourceMappingURL=SearchBox.d.ts.map