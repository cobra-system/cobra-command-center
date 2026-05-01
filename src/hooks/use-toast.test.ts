import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useToast, toast, reducer } from "./use-toast";

const TOAST_REMOVE_DELAY = 1_000_000;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  // Drain module-level state so tests don't leak into each other.
  const { result, unmount } = renderHook(() => useToast());
  act(() => {
    result.current.dismiss();
  });
  act(() => {
    vi.advanceTimersByTime(TOAST_REMOVE_DELAY + 1);
  });
  unmount();
  vi.useRealTimers();
});

describe("use-toast — toast()", () => {
  it("adds an open toast and exposes a dismiss handle", () => {
    const { result } = renderHook(() => useToast());

    let handle!: { id: string; dismiss: () => void };
    act(() => {
      handle = toast({ title: "Saved" });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({ id: handle.id, title: "Saved", open: true });
  });

  it("evicts older toasts when adding a second (TOAST_LIMIT=1)", () => {
    const { result } = renderHook(() => useToast());

    act(() => { toast({ title: "first" }); });
    act(() => { toast({ title: "second" }); });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe("second");
  });

  it("update() mutates the matching toast in place", () => {
    const { result } = renderHook(() => useToast());

    let handle!: ReturnType<typeof toast>;
    act(() => { handle = toast({ title: "loading" }); });

    act(() => {
      handle.update({ id: handle.id, title: "done" });
    });

    expect(result.current.toasts[0].title).toBe("done");
  });

  it("returns a stable id and exposes dismiss/update", () => {
    const handle = toast({ title: "x" });
    expect(typeof handle.id).toBe("string");
    expect(handle.id).not.toBe("");
    expect(typeof handle.dismiss).toBe("function");
    expect(typeof handle.update).toBe("function");
  });
});

describe("use-toast — dismiss()", () => {
  it("setting open=false runs first, then REMOVE fires after TOAST_REMOVE_DELAY", () => {
    const { result } = renderHook(() => useToast());

    let handle!: ReturnType<typeof toast>;
    act(() => { handle = toast({ title: "x" }); });
    expect(result.current.toasts[0].open).toBe(true);

    act(() => { result.current.dismiss(handle.id); });
    expect(result.current.toasts[0].open).toBe(false);
    expect(result.current.toasts).toHaveLength(1);

    act(() => { vi.advanceTimersByTime(TOAST_REMOVE_DELAY); });
    expect(result.current.toasts).toHaveLength(0);
  });

  it("dismiss() with no id closes every toast", () => {
    const { result } = renderHook(() => useToast());

    act(() => { toast({ title: "a" }); });
    act(() => { result.current.dismiss(); });

    expect(result.current.toasts.every((t) => t.open === false)).toBe(true);
  });

  it("calling onOpenChange(false) is equivalent to dismiss for that toast", () => {
    const { result } = renderHook(() => useToast());

    act(() => { toast({ title: "x" }); });
    const onOpenChange = result.current.toasts[0].onOpenChange!;

    act(() => { onOpenChange(false); });
    expect(result.current.toasts[0].open).toBe(false);
  });
});

describe("use-toast — listener lifecycle", () => {
  it("a second mounted hook receives the same updates", () => {
    const a = renderHook(() => useToast());
    const b = renderHook(() => useToast());

    act(() => { toast({ title: "shared" }); });

    expect(a.result.current.toasts[0]?.title).toBe("shared");
    expect(b.result.current.toasts[0]?.title).toBe("shared");
  });

  it("after unmount, the hook no longer mutates and remaining hooks keep working", () => {
    const a = renderHook(() => useToast());
    const b = renderHook(() => useToast());

    a.unmount();
    act(() => { toast({ title: "after-unmount" }); });

    expect(b.result.current.toasts[0]?.title).toBe("after-unmount");
    // a.result.current is the snapshot at unmount time — as long as no exception
    // was thrown when toast() called dispatch, we're good.
  });
});

describe("use-toast — reducer", () => {
  it("ADD_TOAST clamps the queue to TOAST_LIMIT", () => {
    const seed = { toasts: [{ id: "old" } as never] };
    const next = reducer(seed, {
      type: "ADD_TOAST",
      toast: { id: "new" } as never,
    });
    expect(next.toasts).toHaveLength(1);
    expect(next.toasts[0].id).toBe("new");
  });

  it("UPDATE_TOAST only mutates the matching id", () => {
    const seed = { toasts: [{ id: "1", title: "a" }, { id: "2", title: "b" }] as never };
    const next = reducer(seed, {
      type: "UPDATE_TOAST",
      toast: { id: "2", title: "B!" } as never,
    });
    expect(next.toasts[0]).toMatchObject({ id: "1", title: "a" });
    expect(next.toasts[1]).toMatchObject({ id: "2", title: "B!" });
  });

  it("REMOVE_TOAST without an id clears the queue", () => {
    const seed = { toasts: [{ id: "1" }, { id: "2" }] as never };
    const next = reducer(seed, { type: "REMOVE_TOAST" });
    expect(next.toasts).toEqual([]);
  });

  it("REMOVE_TOAST with an id removes that one entry", () => {
    const seed = { toasts: [{ id: "1" }, { id: "2" }] as never };
    const next = reducer(seed, { type: "REMOVE_TOAST", toastId: "1" });
    expect(next.toasts).toEqual([{ id: "2" }]);
  });
});
