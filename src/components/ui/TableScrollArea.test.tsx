import { describe, expect, it, beforeAll, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { TableScrollArea } from "./TableScrollArea";

// jsdom has no layout engine, so fake just enough of it for the measurement.
function stubLayout({ top, viewport }: { top: number; viewport: number }) {
  window.innerHeight = viewport;
  Object.defineProperty(HTMLElement.prototype, "offsetParent", {
    configurable: true,
    get() { return document.body; },
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    top, bottom: top, left: 0, right: 0, width: 0, height: 0, x: 0, y: top, toJSON: () => ({}),
  } as DOMRect);
}

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("TableScrollArea", () => {
  it("caps its height at the space left below it in the viewport", () => {
    stubLayout({ top: 200, viewport: 900 });
    render(<TableScrollArea data-testid="box">content</TableScrollArea>);
    // 900 viewport - 200 top - 24 default gap
    expect(screen.getByTestId("box")).toHaveStyle({ maxHeight: "676px" });
  });

  it("honours a custom bottomGap", () => {
    stubLayout({ top: 200, viewport: 900 });
    render(<TableScrollArea data-testid="box" bottomGap={96}>content</TableScrollArea>);
    expect(screen.getByTestId("box")).toHaveStyle({ maxHeight: "604px" });
  });

  it("never shrinks below minHeight on a short viewport", () => {
    stubLayout({ top: 500, viewport: 600 });
    render(<TableScrollArea data-testid="box" minHeight={260}>content</TableScrollArea>);
    expect(screen.getByTestId("box")).toHaveStyle({ maxHeight: "260px" });
  });

  it("keeps the caller's classes alongside the scroll behaviour", () => {
    stubLayout({ top: 100, viewport: 800 });
    render(<TableScrollArea data-testid="box" className="bg-card rounded-xl">content</TableScrollArea>);
    const box = screen.getByTestId("box");
    expect(box).toHaveClass("overflow-auto", "bg-card", "rounded-xl");
  });
});
