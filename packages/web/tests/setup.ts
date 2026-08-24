import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// jsdom implements neither the pointer capture API nor PointerEvent, both of
// which the time scrubber relies on for dragging.
if (!("setPointerCapture" in Element.prototype)) {
  Element.prototype.setPointerCapture = function setPointerCapture(): void {};
  Element.prototype.releasePointerCapture = function releasePointerCapture(): void {};
  Element.prototype.hasPointerCapture = function hasPointerCapture(): boolean {
    return true;
  };
}

if (typeof window.PointerEvent === "undefined") {
  class StubPointerEvent extends MouseEvent {
    readonly pointerId: number;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 1;
    }
  }
  window.PointerEvent = StubPointerEvent as unknown as typeof PointerEvent;
}

/**
 * Gives an element a real size, because jsdom reports every box as zero and the
 * scrubber converts a pointer position into a time using the track width.
 */
export function stubRect(element: Element, rect: Partial<DOMRect>): void {
  const full: DOMRect = {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect;
  element.getBoundingClientRect = () => full;
}
