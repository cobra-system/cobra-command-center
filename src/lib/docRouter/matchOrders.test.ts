import { describe, it, expect } from "vitest";
import { findOrderCandidates, pickConfidentCandidate, findDuplicateOrder, mentions } from "./matchOrders";
import type { Order } from "@/contexts/types";

const order = (o: Partial<Order>): Order => ({ id: "x", priority: "בינוני", status: "ORDERED", items: [], ...o });

const orders = [
  order({ id: "a", pi_number: "SR-PI-26031", order_number: "CO-2026-0007", tracking_number: "MSKU1234567" }),
  order({ id: "b", pi_number: "DA20260007", booking_number: "BK998877" }),
];

describe("mentions", () => {
  it("does not match a short numeric id inside a longer number", () => {
    expect(mentions("declaration 26024532019850", "2019850")).toBe(false);
    expect(mentions("file 460509 attached", "460509")).toBe(true);
  });
  it("tolerates separator differences on alphanumeric ids", () => {
    expect(mentions("PI NO SRPI26031", "SR-PI-26031")).toBe(true);
  });
});

describe("findOrderCandidates", () => {
  it("matches an order by the PI number printed in the document", () => {
    const c = findOrderCandidates("PACKING LIST PI No.: SR-PI-26031", "pl.pdf", orders);
    expect(c[0].order.id).toBe("a");
    expect(pickConfidentCandidate(c)?.order.id).toBe("a");
  });

  it("matches by container / tracking number", () => {
    const c = findOrderCandidates("Container MSKU1234567", "bl.pdf", orders);
    expect(c[0].order.id).toBe("a");
  });

  it("returns nothing when no identifier appears", () => {
    expect(findOrderCandidates("hello", "x.pdf", orders)).toEqual([]);
  });

  it("refuses to pick when two orders tie (one container, two orders)", () => {
    const c = findOrderCandidates("SR-PI-26031 and DA20260007", "x.pdf", orders);
    expect(c).toHaveLength(2);
    expect(pickConfidentCandidate(c)).toBeNull();
  });
});

describe("findDuplicateOrder", () => {
  it("finds an existing order with the same PI regardless of separators", () => {
    expect(findDuplicateOrder(orders, { piNumber: "sr pi 26031" })?.id).toBe("a");
    expect(findDuplicateOrder(orders, { piNumber: "NEW-1" })).toBeNull();
  });
});
