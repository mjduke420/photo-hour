import type { JSX } from "react";
export interface DatePanelProps {
    dateISO: string;
    timeZone: string;
    timeZoneLabel: string;
    onDateChange(dateISO: string): void;
    onStepDays(delta: number): void;
    onJumpToNow(): void;
}
/**
 * Date selection for the plan.
 *
 * A native date input is used deliberately: it brings a real calendar picker,
 * keyboard entry and localised formatting on every platform, which a
 * hand-rolled calendar would have to reimplement badly.
 */
export declare function DatePanel(props: DatePanelProps): JSX.Element;
//# sourceMappingURL=DatePanel.d.ts.map