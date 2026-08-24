import { describe, expect, it } from "vitest";
import { decodeUrlState, encodeUrlState, type UrlState } from "../src/urlState.js";

const STATE: UrlState = {
  zoom: 12.5,
  lat: 45.4215,
  lng: -75.6972,
  dateISO: "2026-08-24",
  minutes: 845,
  basemap: "osm",
};

describe("encodeUrlState", () => {
  it("starts with a hash", () => {
    expect(encodeUrlState(STATE).startsWith("#")).toBe(true);
  });

  it("rounds coordinates to a sensible precision", () => {
    const encoded = encodeUrlState({ ...STATE, lat: 45.42151234567, zoom: 12.4999 });
    expect(decodeURIComponent(encoded)).toContain("12.5/45.42151/-75.6972");
  });
});

describe("decodeUrlState", () => {
  it("round-trips a full state", () => {
    expect(decodeUrlState(encodeUrlState(STATE))).toEqual(STATE);
  });

  it("accepts a hash without the leading marker", () => {
    const encoded = encodeUrlState(STATE).slice(1);
    expect(decodeUrlState(encoded).dateISO).toBe("2026-08-24");
  });

  it("returns nothing for an empty hash", () => {
    expect(decodeUrlState("")).toEqual({});
    expect(decodeUrlState("#")).toEqual({});
  });

  it("drops a malformed map segment", () => {
    expect(decodeUrlState("#map=not/a/number")).toEqual({});
    expect(decodeUrlState("#map=12.5/45.4")).toEqual({});
  });

  it("drops a malformed date", () => {
    expect(decodeUrlState("#d=24-08-2026")).toEqual({});
    expect(decodeUrlState("#d=2026-13-45")).toEqual({});
  });

  it("keeps valid fields alongside invalid ones", () => {
    const decoded = decodeUrlState("#map=bad&d=2026-08-24&t=600");
    expect(decoded).toEqual({ dateISO: "2026-08-24", minutes: 600 });
  });

  it("clamps out-of-range values instead of rejecting them", () => {
    const decoded = decodeUrlState("#map=99/95/-500&t=99999");
    expect(decoded.zoom).toBe(22);
    expect(decoded.lat).toBeCloseTo(85.051129, 6);
    expect(decoded.lng).toBe(-180);
    expect(decoded.minutes).toBe(1439);
  });

  it("rejects a basemap id that is not a plain slug", () => {
    expect(decodeUrlState("#b=<script>").basemap).toBeUndefined();
    expect(decodeUrlState("#b=satellite").basemap).toBe("satellite");
  });

  it("ignores a non-numeric time", () => {
    expect(decodeUrlState("#t=abc")).toEqual({});
  });
});
