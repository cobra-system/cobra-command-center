import { describe, it, expect } from "vitest";
import {
  ACTIVE_ORDER_STATUSES,
  CLOSED_ORDER_STATUSES,
  isOrderActive,
  isOrderClosed,
  isOrderCompleted,
} from "./orderStatus";

describe("orderStatus", () => {
  it("treats DELIVERED as closed, not active", () => {
    expect(isOrderClosed("DELIVERED")).toBe(true);
    expect(isOrderActive("DELIVERED")).toBe(false);
  });

  it("keeps in-pipeline statuses active", () => {
    for (const s of ACTIVE_ORDER_STATUSES) {
      expect(isOrderActive(s)).toBe(true);
      expect(isOrderClosed(s)).toBe(false);
    }
  });

  it("closes ARRIVED and CANCELLED too", () => {
    for (const s of CLOSED_ORDER_STATUSES) expect(isOrderClosed(s)).toBe(true);
  });

  it("counts DELIVERED and ARRIVED as completed, CANCELLED not", () => {
    expect(isOrderCompleted("DELIVERED")).toBe(true);
    expect(isOrderCompleted("ARRIVED")).toBe(true);
    expect(isOrderCompleted("CANCELLED")).toBe(false);
    expect(isOrderCompleted("SHIPPED")).toBe(false);
  });

  it("treats missing/unknown statuses as active", () => {
    expect(isOrderActive(null)).toBe(true);
    expect(isOrderActive(undefined)).toBe(true);
    expect(isOrderActive("SOMETHING_NEW")).toBe(true);
  });
});
