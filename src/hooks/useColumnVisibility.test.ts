import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useColumnVisibility, type ColDef } from "./useColumnVisibility";

const COLUMNS: readonly ColDef[] = [
  { id: "name", label: "Name", sortField: "name" },
  { id: "sku", label: "SKU", sortField: "sku" },
  { id: "qty", label: "Qty" },
];

const KEY = "test-table:hidden-columns";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useColumnVisibility", () => {
  it("starts with all columns visible by default", () => {
    const { result } = renderHook(() => useColumnVisibility(KEY, COLUMNS));

    expect(result.current.isVisible("name")).toBe(true);
    expect(result.current.isVisible("sku")).toBe(true);
    expect(result.current.isVisible("qty")).toBe(true);
    expect(result.current.visibleCount).toBe(3);
    expect(result.current.hiddenCols).toEqual([]);
  });

  it("respects defaultHidden on first visit", () => {
    const { result } = renderHook(() =>
      useColumnVisibility(KEY, COLUMNS, ["sku"])
    );

    expect(result.current.isVisible("sku")).toBe(false);
    expect(result.current.visibleCount).toBe(2);
    expect(result.current.hiddenCols.map((c) => c.id)).toEqual(["sku"]);
  });

  it("hide() persists to localStorage and updates derived state", () => {
    const { result } = renderHook(() => useColumnVisibility(KEY, COLUMNS));

    act(() => result.current.hide("qty"));

    expect(result.current.isVisible("qty")).toBe(false);
    expect(result.current.visibleCount).toBe(2);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(["qty"]);
  });

  it("show() removes a hidden column and persists", () => {
    localStorage.setItem(KEY, JSON.stringify(["sku", "qty"]));
    const { result } = renderHook(() => useColumnVisibility(KEY, COLUMNS));

    act(() => result.current.show("sku"));

    expect(result.current.isVisible("sku")).toBe(true);
    expect(result.current.isVisible("qty")).toBe(false);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(["qty"]);
  });

  it("loads hidden columns from localStorage on mount, ignoring defaultHidden", () => {
    localStorage.setItem(KEY, JSON.stringify(["name"]));

    const { result } = renderHook(() =>
      useColumnVisibility(KEY, COLUMNS, ["sku"])
    );

    expect(result.current.isVisible("name")).toBe(false);
    expect(result.current.isVisible("sku")).toBe(true);
  });

  it("filters out stored ids that no longer exist in COLUMNS", () => {
    localStorage.setItem(KEY, JSON.stringify(["name", "removed_old_col"]));

    const { result } = renderHook(() => useColumnVisibility(KEY, COLUMNS));

    expect(result.current.isVisible("name")).toBe(false);
    expect(result.current.hiddenCols.map((c) => c.id)).toEqual(["name"]);
  });

  it("recovers from corrupted localStorage payloads by falling back to defaults", () => {
    localStorage.setItem(KEY, "not-json");

    const { result } = renderHook(() =>
      useColumnVisibility(KEY, COLUMNS, ["sku"])
    );

    expect(result.current.isVisible("sku")).toBe(false);
    expect(result.current.visibleCount).toBe(2);
  });

  it("hiding the same id twice is idempotent", () => {
    const { result } = renderHook(() => useColumnVisibility(KEY, COLUMNS));

    act(() => result.current.hide("qty"));
    act(() => result.current.hide("qty"));

    expect(result.current.visibleCount).toBe(2);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(["qty"]);
  });

  it("show() on a column that is already visible is a no-op", () => {
    const { result } = renderHook(() => useColumnVisibility(KEY, COLUMNS));

    act(() => result.current.show("name"));

    expect(result.current.visibleCount).toBe(3);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual([]);
  });

  it("uses an isolated localStorage key per table", () => {
    const { result: a } = renderHook(() =>
      useColumnVisibility("table-a:hidden", COLUMNS)
    );
    const { result: b } = renderHook(() =>
      useColumnVisibility("table-b:hidden", COLUMNS)
    );

    act(() => a.current.hide("name"));

    expect(a.current.isVisible("name")).toBe(false);
    expect(b.current.isVisible("name")).toBe(true);
    expect(localStorage.getItem("table-b:hidden")).toBeNull();
  });
});
