import { daylightBands, sunEvents } from "@photo-hour/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TimeScrubber } from "../src/components/TimeScrubber.js";
import { stubRect } from "./setup.js";

const BANDS = daylightBands("2026-08-24", 51.3217, -116.186, "America/Edmonton");
const EVENTS = sunEvents("2026-08-24", 51.3217, -116.186, "America/Edmonton");

function renderScrubber(overrides: Partial<Parameters<typeof TimeScrubber>[0]> = {}) {
  const onChange = vi.fn();
  const onScrubStart = vi.fn();
  const onScrubEnd = vi.fn();
  const onTogglePlay = vi.fn();

  render(
    <TimeScrubber
      minutes={720}
      bands={BANDS}
      events={EVENTS}
      timeZoneLabel="MDT"
      playing={false}
      onChange={onChange}
      onScrubStart={onScrubStart}
      onScrubEnd={onScrubEnd}
      onTogglePlay={onTogglePlay}
      {...overrides}
    />,
  );

  const track = screen.getByTestId("time-track");
  stubRect(track, { left: 0, width: 1000, top: 0, height: 34 });
  return { track, onChange, onScrubStart, onScrubEnd, onTogglePlay };
}

describe("TimeScrubber", () => {
  it("exposes itself as a slider carrying the readable time", () => {
    renderScrubber();
    const track = screen.getByTestId("time-track");
    expect(track.getAttribute("role")).toBe("slider");
    expect(track.getAttribute("aria-valuenow")).toBe("720");
    expect(track.getAttribute("aria-valuetext")).toBe("12:00 MDT");
  });

  it("draws a band for every phase of the day", () => {
    const { track } = renderScrubber();
    expect(track.querySelectorAll(".scrubber-band").length).toBe(BANDS.length);
  });

  it("marks sunrise, solar noon and sunset on the track", () => {
    const { track } = renderScrubber();
    expect(track.querySelectorAll(".scrubber-event").length).toBe(3);
  });

  it("shows the current time on the handle", () => {
    renderScrubber({ minutes: 1085 });
    expect(screen.getByText("18:05")).toBeTruthy();
  });

  it("converts a click position into a time", () => {
    const { track, onChange } = renderScrubber();
    // Three quarters across a 1000 pixel track is a quarter to six in the evening.
    fireEvent.pointerDown(track, { clientX: 750, pointerId: 1 });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toBeCloseTo(0.75 * 1439, 0);
  });

  it("reports the start and end of a drag so quality can be lowered in between", () => {
    const { track, onScrubStart, onScrubEnd, onChange } = renderScrubber();

    fireEvent.pointerDown(track, { clientX: 100, pointerId: 1 });
    expect(onScrubStart).toHaveBeenCalledTimes(1);
    expect(onScrubEnd).not.toHaveBeenCalled();

    fireEvent.pointerMove(track, { clientX: 400, pointerId: 1 });
    expect(onChange).toHaveBeenCalledTimes(2);

    fireEvent.pointerUp(track, { clientX: 400, pointerId: 1 });
    expect(onScrubEnd).toHaveBeenCalledTimes(1);
  });

  it("ignores pointer movement that is not part of a drag", () => {
    const { track, onChange } = renderScrubber();
    fireEvent.pointerMove(track, { clientX: 400, pointerId: 1 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clamps a click beyond either end of the track", () => {
    const { track, onChange } = renderScrubber();
    fireEvent.pointerDown(track, { clientX: -200, pointerId: 1 });
    expect(onChange.mock.calls[0]?.[0]).toBe(0);

    fireEvent.pointerDown(track, { clientX: 5000, pointerId: 2 });
    expect(onChange.mock.calls[1]?.[0]).toBe(1439);
  });

  it("steps by a minute with the arrow keys", () => {
    const { track, onChange } = renderScrubber();
    fireEvent.keyDown(track, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith(721);
    fireEvent.keyDown(track, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenCalledWith(719);
  });

  it("steps by a quarter hour vertically, and by an hour with shift", () => {
    const { track, onChange } = renderScrubber();
    fireEvent.keyDown(track, { key: "ArrowUp" });
    expect(onChange).toHaveBeenCalledWith(735);
    fireEvent.keyDown(track, { key: "ArrowUp", shiftKey: true });
    expect(onChange).toHaveBeenCalledWith(780);
  });

  it("jumps to the ends of the day with Home and End", () => {
    const { track, onChange } = renderScrubber();
    fireEvent.keyDown(track, { key: "Home" });
    expect(onChange).toHaveBeenCalledWith(0);
    fireEvent.keyDown(track, { key: "End" });
    expect(onChange).toHaveBeenCalledWith(1439);
  });

  it("does not step back past midnight", () => {
    const { track, onChange } = renderScrubber({ minutes: 0 });
    fireEvent.keyDown(track, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("does not step forward past the end of the day", () => {
    const { track, onChange } = renderScrubber({ minutes: 1439 });
    fireEvent.keyDown(track, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith(1439);
  });

  it("ignores keys that are not time controls", () => {
    const { track, onChange } = renderScrubber();
    fireEvent.keyDown(track, { key: "a" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("toggles playback and reports its state", () => {
    const { onTogglePlay } = renderScrubber({ playing: true });
    const button = screen.getByRole("button", { name: /pause/i });
    expect(button.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(button);
    expect(onTogglePlay).toHaveBeenCalledTimes(1);
  });
});
