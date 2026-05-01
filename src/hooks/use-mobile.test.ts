import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useIsMobile } from "./use-mobile";

interface MqlStub {
  matches: boolean;
  media: string;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}

let mql: MqlStub;
let captured: ((e?: Event) => void) | null;
const originalInnerWidth = window.innerWidth;

function setWidth(px: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: px });
}

beforeEach(() => {
  captured = null;
  mql = {
    matches: false,
    media: "",
    addEventListener: vi.fn((_event: string, fn: (e?: Event) => void) => {
      captured = fn;
    }),
    removeEventListener: vi.fn(),
  };
  window.matchMedia = ((query: string) => {
    mql.media = query;
    return mql;
  }) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  setWidth(originalInnerWidth);
});

describe("useIsMobile", () => {
  it("returns false on a desktop viewport", () => {
    setWidth(1024);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("returns true on a mobile viewport", () => {
    setWidth(500);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("uses a (max-width: 767px) media query", () => {
    setWidth(1024);
    renderHook(() => useIsMobile());
    expect(mql.media).toBe("(max-width: 767px)");
  });

  it("flips to true when the change handler fires after the viewport shrinks", () => {
    setWidth(1024);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    setWidth(500);
    act(() => { captured?.(); });

    expect(result.current).toBe(true);
  });

  it("768 → false, 767 → true at the breakpoint boundary", () => {
    setWidth(768);
    const { result, unmount } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
    unmount();

    setWidth(767);
    const { result: r2 } = renderHook(() => useIsMobile());
    expect(r2.current).toBe(true);
  });

  it("removeEventListener is called with the same handler on unmount", () => {
    setWidth(1024);
    const { unmount } = renderHook(() => useIsMobile());

    expect(mql.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    const handler = mql.addEventListener.mock.calls[0][1];

    unmount();
    expect(mql.removeEventListener).toHaveBeenCalledWith("change", handler);
  });
});
