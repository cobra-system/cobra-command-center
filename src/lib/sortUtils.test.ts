import { describe, it, expect } from "vitest";
import { compareValues, createComparator, sortArray, filterArray } from "./sortUtils";

describe("compareValues", () => {
  describe("null/undefined handling", () => {
    it("returns 0 when both are null", () => {
      expect(compareValues(null, null)).toBe(0);
    });

    it("returns 0 when both are undefined", () => {
      expect(compareValues(undefined, undefined)).toBe(0);
    });

    it("sorts null after non-null", () => {
      expect(compareValues(null, "a")).toBe(1);
      expect(compareValues("a", null)).toBe(-1);
    });

    it("sorts undefined after non-undefined", () => {
      expect(compareValues(undefined, "a")).toBe(1);
      expect(compareValues("a", undefined)).toBe(-1);
    });
  });

  describe("string type", () => {
    it("compares strings using Hebrew locale", () => {
      expect(compareValues("א", "ב", "string")).toBeLessThan(0);
      expect(compareValues("ב", "א", "string")).toBeGreaterThan(0);
      expect(compareValues("א", "א", "string")).toBe(0);
    });

    it("compares English strings", () => {
      expect(compareValues("apple", "banana", "string")).toBeLessThan(0);
    });

    it("defaults to string type", () => {
      expect(compareValues("a", "b")).toBeLessThan(0);
    });
  });

  describe("number type", () => {
    it("compares numbers correctly", () => {
      expect(compareValues(1, 2, "number")).toBeLessThan(0);
      expect(compareValues(10, 5, "number")).toBeGreaterThan(0);
      expect(compareValues(3, 3, "number")).toBe(0);
    });

    it("handles string-encoded numbers", () => {
      expect(compareValues("10", "5", "number")).toBeGreaterThan(0);
    });

    it("treats non-numeric as 0", () => {
      expect(compareValues("abc", 5, "number")).toBeLessThan(0);
    });
  });

  describe("date type", () => {
    it("compares dates correctly", () => {
      expect(compareValues("2024-01-01", "2024-06-01", "date")).toBeLessThan(0);
      expect(compareValues("2024-12-01", "2024-01-01", "date")).toBeGreaterThan(0);
    });

    it("handles ISO date strings", () => {
      expect(
        compareValues("2024-01-01T00:00:00Z", "2024-01-02T00:00:00Z", "date")
      ).toBeLessThan(0);
    });
  });
});

describe("createComparator", () => {
  it("returns a comparator function for a field", () => {
    const cmp = createComparator<{ name: string }>("name", "string");
    expect(cmp({ name: "א" }, { name: "ב" })).toBeLessThan(0);
  });

  it("works with number fields", () => {
    const cmp = createComparator<{ price: number }>("price", "number");
    expect(cmp({ price: 10 }, { price: 5 })).toBeGreaterThan(0);
  });
});

describe("sortArray", () => {
  const items = [
    { name: "גמל", price: 30 },
    { name: "אלף", price: 10 },
    { name: "בית", price: 20 },
  ];

  it("sorts ascending by default", () => {
    const sorted = sortArray(items, "price", "asc", "number");
    expect(sorted.map((i) => i.price)).toEqual([10, 20, 30]);
  });

  it("sorts descending", () => {
    const sorted = sortArray(items, "price", "desc", "number");
    expect(sorted.map((i) => i.price)).toEqual([30, 20, 10]);
  });

  it("sorts strings with Hebrew locale", () => {
    const sorted = sortArray(items, "name", "asc", "string");
    expect(sorted.map((i) => i.name)).toEqual(["אלף", "בית", "גמל"]);
  });

  it("does not mutate the original array", () => {
    const original = [...items];
    sortArray(items, "price", "asc", "number");
    expect(items).toEqual(original);
  });
});

describe("filterArray", () => {
  const items = [
    { status: "active", category: "A", priority: 1 },
    { status: "inactive", category: "B", priority: 2 },
    { status: "active", category: "A", priority: 3 },
    { status: "active", category: "B", priority: 1 },
  ];

  it("filters by exact match", () => {
    const result = filterArray(items, { status: "active" });
    expect(result).toHaveLength(3);
    expect(result.every((i) => i.status === "active")).toBe(true);
  });

  it("filters by multiple criteria", () => {
    const result = filterArray(items, { status: "active", category: "A" });
    expect(result).toHaveLength(2);
  });

  it("skips null/undefined/all filter values", () => {
    expect(filterArray(items, { status: null })).toHaveLength(4);
    expect(filterArray(items, { status: undefined })).toHaveLength(4);
    expect(filterArray(items, { status: "all" })).toHaveLength(4);
  });

  it("filters by array of allowed values", () => {
    const result = filterArray(items, { priority: [1, 2] });
    expect(result).toHaveLength(3);
  });

  it("returns all items when no filters", () => {
    expect(filterArray(items, {})).toHaveLength(4);
  });
});
