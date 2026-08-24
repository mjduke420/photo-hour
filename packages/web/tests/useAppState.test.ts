import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useAppState } from "../src/state/useAppState.js";

function setHash(hash: string): void {
  window.history.replaceState(null, "", hash === "" ? window.location.pathname : hash);
}

beforeEach(() => {
  setHash("");
});

describe("useAppState initial state", () => {
  it("starts at a location with terrain worth looking at", () => {
    const { result } = renderHook(() => useAppState());
    const [state] = result.current;
    expect(state.lat).toBeCloseTo(51.3217, 4);
    expect(state.lng).toBeCloseTo(-116.186, 3);
    expect(state.basemap).toBe("muted");
  });

  it("restores a shared plan from the URL", () => {
    setHash("#map=10/45.4215/-75.6972&d=2026-09-14&t=1065&b=dark");
    const { result } = renderHook(() => useAppState());
    const [state] = result.current;

    expect(state.zoom).toBe(10);
    expect(state.lat).toBeCloseTo(45.4215, 4);
    expect(state.dateISO).toBe("2026-09-14");
    expect(state.minutes).toBe(1065);
    expect(state.basemap).toBe("dark");
  });

  it("falls back for the parts of a damaged hash it cannot read", () => {
    setHash("#map=rubbish&d=2026-09-14");
    const { result } = renderHook(() => useAppState());
    const [state] = result.current;

    expect(state.dateISO).toBe("2026-09-14");
    expect(state.lat).toBeCloseTo(51.3217, 4);
  });
});

describe("useAppState derived values", () => {
  it("uses the time zone of the mapped location, not of the browser", () => {
    setHash("#map=10/51.3217/-116.186&d=2026-08-24&t=720");
    const { result } = renderHook(() => useAppState());
    expect(result.current[2].timeZone).toBe("America/Edmonton");
  });

  it("turns the local wall time into the right instant", () => {
    setHash("#map=10/51.3217/-116.186&d=2026-08-24&t=720");
    const { result } = renderHook(() => useAppState());
    // Noon in Banff during daylight saving is 18:00 UTC.
    expect(result.current[2].instant.toISOString()).toBe("2026-08-24T18:00:00.000Z");
  });

  it("moves the sun when the clock moves", () => {
    setHash("#map=10/51.3217/-116.186&d=2026-08-24&t=720");
    const { result } = renderHook(() => useAppState());
    const middaySun = result.current[2].sun.altitudeDeg;

    act(() => result.current[1].setMinutes(1200));
    expect(result.current[2].sun.altitudeDeg).toBeLessThan(middaySun);
  });

  it("provides bands and events covering the whole day", () => {
    const { result } = renderHook(() => useAppState());
    const [, , derived] = result.current;
    expect(derived.bands[0]?.startMinutes).toBe(0);
    expect(derived.bands[derived.bands.length - 1]?.endMinutes).toBe(1440);
    expect(derived.events.length).toBeGreaterThan(0);
  });
});

describe("useAppState actions", () => {
  it("clamps the clock to a single day", () => {
    const { result } = renderHook(() => useAppState());

    act(() => result.current[1].setMinutes(-30));
    expect(result.current[0].minutes).toBe(0);

    act(() => result.current[1].setMinutes(99999));
    expect(result.current[0].minutes).toBe(1439);
  });

  it("steps across a month boundary", () => {
    setHash("#d=2026-08-31&t=720");
    const { result } = renderHook(() => useAppState());

    act(() => result.current[1].stepDays(1));
    expect(result.current[0].dateISO).toBe("2026-09-01");

    act(() => result.current[1].stepDays(-1));
    expect(result.current[0].dateISO).toBe("2026-08-31");
  });

  it("steps across a year boundary", () => {
    setHash("#d=2026-12-31&t=720");
    const { result } = renderHook(() => useAppState());
    act(() => result.current[1].stepDays(1));
    expect(result.current[0].dateISO).toBe("2027-01-01");
  });

  it("steps across a leap day", () => {
    setHash("#d=2028-02-28&t=720");
    const { result } = renderHook(() => useAppState());
    act(() => result.current[1].stepDays(1));
    expect(result.current[0].dateISO).toBe("2028-02-29");
  });

  it("follows the map to a new time zone", () => {
    const { result } = renderHook(() => useAppState());
    act(() => result.current[1].setView({ lat: 45.4215, lng: -75.6972, zoom: 11 }));
    expect(result.current[2].timeZone).toBe("America/Toronto");
  });

  it("moves to a searched place", () => {
    const { result } = renderHook(() => useAppState());
    act(() => result.current[1].goToPlace({ lat: 46.5, lng: -121.5 }));
    expect(result.current[0].lat).toBe(46.5);
    expect(result.current[0].lng).toBe(-121.5);
  });

  it("clamps the overlay strength", () => {
    const { result } = renderHook(() => useAppState());
    act(() => result.current[1].setOpacity(5));
    expect(result.current[0].opacity).toBe(1);
    act(() => result.current[1].setOpacity(-1));
    expect(result.current[0].opacity).toBe(0);
  });

  it("stops playback when jumping back to the present", () => {
    setHash("#d=2020-01-01&t=0");
    const { result } = renderHook(() => useAppState());

    act(() => result.current[1].setPlaying(true));
    expect(result.current[0].playing).toBe(true);

    act(() => result.current[1].jumpToNow());
    expect(result.current[0].playing).toBe(false);
    expect(result.current[0].dateISO).not.toBe("2020-01-01");
  });

  it("changes the basemap", () => {
    const { result } = renderHook(() => useAppState());
    act(() => result.current[1].setBasemap("satellite"));
    expect(result.current[0].basemap).toBe("satellite");
  });
});

describe("useAppState url sync", () => {
  it("writes the plan back to the hash so it can be shared", async () => {
    const { result } = renderHook(() => useAppState());
    act(() => result.current[1].setMinutes(1065));

    await waitFor(
      () => {
        expect(decodeURIComponent(window.location.hash)).toContain("t=1065");
      },
      { timeout: 2000 },
    );
  });

  it("replaces the entry rather than growing the history", async () => {
    const before = window.history.length;
    const { result } = renderHook(() => useAppState());

    act(() => result.current[1].setMinutes(600));
    await waitFor(() => {
      expect(decodeURIComponent(window.location.hash)).toContain("t=600");
    });

    expect(window.history.length).toBe(before);
  });
});
