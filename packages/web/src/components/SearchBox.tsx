import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import { searchPlaces, type PlaceResult } from "../api/client.js";

export interface SearchBoxProps {
  onSelect(place: PlaceResult): void;
}

export function SearchBox(props: SearchBoxProps): JSX.Element {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);

  // Abandon any in-flight search when the component goes away, so a slow
  // response cannot resolve into an unmounted component.
  useEffect(() => () => request.current?.abort(), []);

  async function runSearch(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setMessage("Type at least two characters");
      return;
    }

    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;

    setBusy(true);
    setMessage(null);
    try {
      const found = await searchPlaces(trimmed, controller.signal);
      if (controller.signal.aborted) return;
      setResults(found);
      setMessage(found.length === 0 ? "No matching places" : null);
    } catch (error) {
      if (controller.signal.aborted) return;
      setResults([]);
      setMessage(error instanceof Error ? error.message : "Location search failed");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  function choose(place: PlaceResult): void {
    props.onSelect(place);
    setResults([]);
    setQuery(place.name.split(",")[0] ?? place.name);
  }

  return (
    <div className="search">
      <form onSubmit={runSearch} role="search">
        <input
          type="search"
          className="search-input"
          placeholder="Find a location"
          aria-label="Find a location"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit" className="ghost-button" disabled={busy}>
          {busy ? "..." : "Go"}
        </button>
      </form>

      {message ? <p className="search-message">{message}</p> : null}

      {results.length > 0 ? (
        <ul className="search-results">
          {results.map((place) => (
            <li key={`${place.lat},${place.lng},${place.name}`}>
              <button type="button" onClick={() => choose(place)}>
                <strong>{place.name.split(",")[0]}</strong>
                <span className="muted">{place.name.split(",").slice(1).join(",").trim()}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
