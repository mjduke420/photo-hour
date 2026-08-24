import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DatePanel } from "../src/components/DatePanel.js";
import { LayerSwitcher } from "../src/components/LayerSwitcher.js";
import { ShadowControls } from "../src/components/ShadowControls.js";
import { SunCompass } from "../src/components/SunCompass.js";
import { availableBasemaps } from "../src/map/basemaps.js";

describe("DatePanel", () => {
  function setup() {
    const onDateChange = vi.fn();
    const onStepDays = vi.fn();
    const onJumpToNow = vi.fn();
    render(
      <DatePanel
        dateISO="2026-08-24"
        timeZone="America/Edmonton"
        timeZoneLabel="MDT"
        onDateChange={onDateChange}
        onStepDays={onStepDays}
        onJumpToNow={onJumpToNow}
      />,
    );
    return { onDateChange, onStepDays, onJumpToNow };
  }

  it("shows the selected date in a native picker", () => {
    setup();
    const input = screen.getByLabelText("Date of the shoot") as HTMLInputElement;
    expect(input.type).toBe("date");
    expect(input.value).toBe("2026-08-24");
  });

  it("reports a new date", () => {
    const { onDateChange } = setup();
    fireEvent.change(screen.getByLabelText("Date of the shoot"), {
      target: { value: "2026-12-21" },
    });
    expect(onDateChange).toHaveBeenCalledWith("2026-12-21");
  });

  it("keeps the last good date when the field is cleared mid-edit", () => {
    const { onDateChange } = setup();
    fireEvent.change(screen.getByLabelText("Date of the shoot"), { target: { value: "" } });
    expect(onDateChange).not.toHaveBeenCalled();
  });

  it("steps a day in each direction", () => {
    const { onStepDays } = setup();
    fireEvent.click(screen.getByLabelText("Next day"));
    expect(onStepDays).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByLabelText("Previous day"));
    expect(onStepDays).toHaveBeenCalledWith(-1);
  });

  it("jumps back to the present", () => {
    const { onJumpToNow } = setup();
    fireEvent.click(screen.getByText("Now"));
    expect(onJumpToNow).toHaveBeenCalledTimes(1);
  });

  it("names the time zone the clock is showing", () => {
    setup();
    expect(screen.getByText(/Local time: MDT/)).toBeTruthy();
  });
});

describe("ShadowControls", () => {
  function renderControls(props: Partial<Parameters<typeof ShadowControls>[0]> = {}) {
    const onOpacityChange = vi.fn();
    render(
      <ShadowControls
        opacity={0.55}
        onOpacityChange={onOpacityChange}
        light={{ shadow: 0, elevation: 1920 }}
        sunIsUp
        {...props}
      />,
    );
    return { onOpacityChange };
  }

  it("says a lit point is in direct sun", () => {
    renderControls();
    expect(screen.getByTestId("light-state").textContent).toBe("In direct sun");
  });

  it("says a blocked point is in terrain shadow", () => {
    renderControls({ light: { shadow: 1, elevation: 1200 } });
    expect(screen.getByTestId("light-state").textContent).toBe("In terrain shadow");
  });

  it("calls out the penumbra rather than forcing a yes or no", () => {
    renderControls({ light: { shadow: 0.5, elevation: 1200 } });
    expect(screen.getByTestId("light-state").textContent).toBe("On the shadow edge");
  });

  it("says so when the sun has set, whatever the terrain does", () => {
    renderControls({ sunIsUp: false, light: { shadow: 1, elevation: 1200 } });
    expect(screen.getByTestId("light-state").textContent).toMatch(/below the horizon/);
  });

  it("waits rather than guessing before terrain has loaded", () => {
    renderControls({ light: null });
    expect(screen.getByTestId("light-state").textContent).toBe("Waiting for terrain");
  });

  it("shows the ground elevation", () => {
    renderControls();
    expect(screen.getByText(/1920 m/)).toBeTruthy();
  });

  it("reports a new overlay strength as a fraction", () => {
    const { onOpacityChange } = renderControls();
    fireEvent.change(screen.getByLabelText("Shadow overlay strength"), {
      target: { value: "80" },
    });
    expect(onOpacityChange).toHaveBeenCalledWith(0.8);
  });
});

describe("SunCompass", () => {
  it("describes the sun position for a screen reader", () => {
    render(<SunCompass azimuthDeg={275} altitudeDeg={9.7} />);
    const label = screen.getByRole("img").getAttribute("aria-label");
    expect(label).toContain("275");
    expect(label).toContain("10");
  });

  it("marks the sun as up or down", () => {
    const { container, rerender } = render(<SunCompass azimuthDeg={180} altitudeDeg={45} />);
    expect(container.querySelector(".compass-sun-up")).not.toBeNull();

    rerender(<SunCompass azimuthDeg={180} altitudeDeg={-5} />);
    expect(container.querySelector(".compass-sun-down")).not.toBeNull();
  });
});

describe("LayerSwitcher", () => {
  it("marks the active basemap", () => {
    render(
      <LayerSwitcher options={availableBasemaps(null)} selected="dark" onSelect={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Dark" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Streets" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("reports a chosen basemap", () => {
    const onSelect = vi.fn();
    render(<LayerSwitcher options={availableBasemaps(null)} selected="muted" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Streets" }));
    expect(onSelect).toHaveBeenCalledWith("osm");
  });
});
