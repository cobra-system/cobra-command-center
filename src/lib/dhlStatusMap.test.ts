import { describe, it, expect } from "vitest";
import {
  DHL_EVENT_CODES,
  DHL_LEVELS,
  describeEvent,
  describeStatus,
  normalizeLevel,
  stageIndexForEvent,
} from "./dhlStatusMap";

describe("describeEvent", () => {
  it("returns Hebrew translation for known DHL event codes", () => {
    expect(describeEvent("102", "anything")).toBe(DHL_EVENT_CODES["102"].he);
    expect(describeEvent("150", null)).toBe("נמסר");
    expect(describeEvent("110", null)).toBe(DHL_EVENT_CODES["110"].he);
  });

  it("falls back to the raw description when the code is unknown", () => {
    expect(describeEvent("999", "Custom raw text")).toBe("Custom raw text");
    expect(describeEvent(null, "Some raw description")).toBe("Some raw description");
    expect(describeEvent(null, null)).toBe("—");
    expect(describeEvent(undefined, "")).toBe("—");
  });

  it("trims whitespace from fallback", () => {
    expect(describeEvent("999", "  trimmed  ")).toBe("trimmed");
  });
});

describe("describeStatus", () => {
  it("returns 'נמסר' regardless of code/description for delivered level", () => {
    expect(describeStatus("delivered", "999", "anything else")).toBe("נמסר");
  });

  it("uses the event-code map when available", () => {
    expect(describeStatus("transit", "102", "raw desc")).toBe(DHL_EVENT_CODES["102"].he);
  });

  it("falls back to description when no code mapping exists", () => {
    expect(describeStatus("transit", "999", "Custom in transit info")).toBe("Custom in transit info");
  });

  it("falls back to level label when nothing else is available", () => {
    expect(describeStatus("transit", null, null)).toBe(DHL_LEVELS.transit.he);
    expect(describeStatus("failure", null, "")).toBe(DHL_LEVELS.failure.he);
  });
});

describe("normalizeLevel", () => {
  it("returns known levels directly", () => {
    expect(normalizeLevel("delivered")).toBe("delivered");
    expect(normalizeLevel("transit")).toBe("transit");
    expect(normalizeLevel("failure")).toBe("failure");
    expect(normalizeLevel("pre-transit")).toBe("pre-transit");
  });

  it("returns 'unknown' for unexpected input", () => {
    expect(normalizeLevel(null)).toBe("unknown");
    expect(normalizeLevel(undefined)).toBe("unknown");
    expect(normalizeLevel("")).toBe("unknown");
    expect(normalizeLevel("garbage")).toBe("unknown");
    expect(normalizeLevel("102")).toBe("unknown");
  });
});

describe("stageIndexForEvent", () => {
  it("returns 4 for delivered level regardless of event code", () => {
    expect(stageIndexForEvent("999", "delivered")).toBe(4);
    expect(stageIndexForEvent(null, "delivered")).toBe(4);
  });

  it("returns -1 for failure level (off-track)", () => {
    expect(stageIndexForEvent("110", "failure")).toBe(-1);
    expect(stageIndexForEvent(null, "failure")).toBe(-1);
  });

  it("maps event codes to their stage index when level is transit", () => {
    expect(stageIndexForEvent("110", "transit")).toBe(1); // pickup → idx 1
    expect(stageIndexForEvent("130", "transit")).toBe(2); // transit → idx 2
    expect(stageIndexForEvent("140", "transit")).toBe(3); // out-for-delivery → idx 3
  });

  it("returns -1 when an exception event code is present in transit level", () => {
    expect(stageIndexForEvent("104", "transit")).toBe(-1); // 104 = customs hold (exception)
    expect(stageIndexForEvent("170", "transit")).toBe(-1); // 170 = delivery exception
  });

  it("falls back to level metadata when code is unknown", () => {
    expect(stageIndexForEvent("999", "transit")).toBe(DHL_LEVELS.transit.stageIndex);
    expect(stageIndexForEvent(null, "pre-transit")).toBe(DHL_LEVELS["pre-transit"].stageIndex);
  });
});
