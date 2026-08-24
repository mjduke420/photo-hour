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
export function DatePanel(props: DatePanelProps): JSX.Element {
  return (
    <section className="panel-section" aria-labelledby="date-heading">
      <h2 id="date-heading" className="panel-heading">
        Date
      </h2>

      <div className="date-row">
        <button
          type="button"
          className="ghost-button"
          onClick={() => props.onStepDays(-1)}
          aria-label="Previous day"
        >
          &#8592;
        </button>

        <input
          type="date"
          className="date-input"
          value={props.dateISO}
          onChange={(event) => {
            // An empty value means the field was cleared mid-edit; keep the
            // last good date rather than pushing an invalid one into state.
            if (event.target.value) props.onDateChange(event.target.value);
          }}
          aria-label="Date of the shoot"
        />

        <button
          type="button"
          className="ghost-button"
          onClick={() => props.onStepDays(1)}
          aria-label="Next day"
        >
          &#8594;
        </button>
      </div>

      <div className="date-footer">
        <span className="muted" title={props.timeZone}>
          Local time: {props.timeZoneLabel}
        </span>
        <button type="button" className="link-button" onClick={props.onJumpToNow}>
          Now
        </button>
      </div>
    </section>
  );
}
