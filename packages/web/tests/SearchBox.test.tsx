import { sunEvents, sunPosition } from "@photo-hour/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchBox } from "../src/components/SearchBox.js";
import { SunInfoPanel } from "../src/components/SunInfoPanel.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SearchBox", () => {
  it("lists matches and reports the chosen one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          results: [{ name: "Banff, Alberta, Canada", lat: 51.17, lng: -115.57, kind: "town" }],
        }),
      ),
    );
    const onSelect = vi.fn();
    render(<SearchBox onSelect={onSelect} />);

    fireEvent.change(screen.getByLabelText("Find a location"), { target: { value: "banff" } });
    fireEvent.submit(screen.getByRole("search"));

    const result = await screen.findByText("Banff");
    fireEvent.click(result);

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ lat: 51.17, lng: -115.57 }),
    );
  });

  it("refuses a search too short to be useful without calling the server", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<SearchBox onSelect={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Find a location"), { target: { value: "b" } });
    fireEvent.submit(screen.getByRole("search"));

    expect(screen.getByText(/at least two characters/i)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says so when nothing matched", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ results: [] })));
    render(<SearchBox onSelect={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Find a location"), { target: { value: "zzzzzz" } });
    fireEvent.submit(screen.getByRole("search"));

    expect(await screen.findByText(/no matching places/i)).toBeTruthy();
  });

  it("surfaces a search failure instead of failing silently", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "boom" }, 502)));
    render(<SearchBox onSelect={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Find a location"), { target: { value: "banff" } });
    fireEvent.submit(screen.getByRole("search"));

    expect(await screen.findByText(/unavailable/i)).toBeTruthy();
  });

  it("clears the result list once a place is chosen", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ results: [{ name: "Banff, Canada", lat: 51.17, lng: -115.57, kind: "town" }] }),
      ),
    );
    render(<SearchBox onSelect={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Find a location"), { target: { value: "banff" } });
    fireEvent.submit(screen.getByRole("search"));
    fireEvent.click(await screen.findByText("Banff"));

    await waitFor(() => {
      expect(screen.queryByText("Banff")).toBeNull();
    });
  });
});

describe("SunInfoPanel", () => {
  const instant = new Date("2026-08-24T02:00:00Z");
  const sun = sunPosition(instant, 51.3217, -116.186);
  const events = sunEvents("2026-08-24", 51.3217, -116.186, "America/Edmonton");

  it("shows the sun direction as degrees and a compass point", () => {
    render(<SunInfoPanel sun={sun} events={events} lat={51.3217} lng={-116.186} />);
    const direction = screen.getByTestId("sun-azimuth").textContent ?? "";
    expect(direction).toMatch(/^\d+°\s[NESW]+$/);
  });

  it("shows the altitude to one decimal", () => {
    render(<SunInfoPanel sun={sun} events={events} lat={51.3217} lng={-116.186} />);
    expect(screen.getByTestId("sun-altitude").textContent).toMatch(/^-?\d+\.\d°$/);
  });

  it("lists every solar event for the day", () => {
    render(<SunInfoPanel sun={sun} events={events} lat={51.3217} lng={-116.186} />);
    expect(screen.getByText("Sunrise")).toBeTruthy();
    expect(screen.getByText("Sunset")).toBeTruthy();
    expect(screen.getByText("Solar noon")).toBeTruthy();
  });

  it("says plainly when an event does not happen at all", () => {
    const polar = sunEvents("2026-12-21", 78.22, 15.63, "Arctic/Longyearbyen");
    render(<SunInfoPanel sun={sun} events={polar} lat={78.22} lng={15.63} />);
    expect(screen.getAllByText("does not occur").length).toBeGreaterThan(0);
  });

  it("shows the position being planned", () => {
    render(<SunInfoPanel sun={sun} events={events} lat={51.3217} lng={-116.186} />);
    expect(screen.getByText("51.3217, -116.1860")).toBeTruthy();
  });
});
