import { describe, it, expect } from "vitest";
import {
  csvEscape,
  isStale,
  nextActionFor,
  statusAfterAction,
  STALE_THRESHOLD_MS,
} from "./lockControlUtils";

describe("nextActionFor", () => {
  it("toggles closed → open", () => {
    expect(nextActionFor("closed")).toBe("open");
  });

  it("toggles open → close", () => {
    expect(nextActionFor("open")).toBe("close");
  });

  it("treats unknown as needing closing (assume locking up)", () => {
    expect(nextActionFor("unknown")).toBe("open");
  });
});

describe("statusAfterAction", () => {
  it("maps open action → open status", () => {
    expect(statusAfterAction("open")).toBe("open");
  });

  it("maps close action → closed status", () => {
    expect(statusAfterAction("close")).toBe("closed");
  });
});

describe("isStale", () => {
  const now = Date.UTC(2026, 3, 30, 12, 0, 0);

  it("considers locks with no scan as stale", () => {
    expect(isStale(null, now)).toBe(true);
  });

  it("returns false for a fresh scan within the threshold", () => {
    const fresh = new Date(now - 60 * 60 * 1000).toISOString();
    expect(isStale(fresh, now)).toBe(false);
  });

  it("returns true once last scan is older than the threshold", () => {
    const old = new Date(now - STALE_THRESHOLD_MS - 1000).toISOString();
    expect(isStale(old, now)).toBe(true);
  });
});

describe("csvEscape", () => {
  it("returns empty string for null/undefined", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });

  it("returns plain values unquoted", () => {
    expect(csvEscape("hello")).toBe("hello");
    expect(csvEscape(42)).toBe("42");
  });

  it("quotes and escapes values containing commas, quotes or newlines", () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('he said "hi"')).toBe('"he said ""hi"""');
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });
});
