import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const mock = vi.hoisted(() =>
  ({ instance: null as ReturnType<typeof import("@/test/supabaseMock").createSupabaseMock> | null }),
);

vi.mock("@/lib/supabase", async () => {
  const { createSupabaseMock } = await import("@/test/supabaseMock");
  mock.instance = createSupabaseMock();
  return { supabase: mock.instance };
});

import { usePickupMonthlyAvg } from "./usePickupMonthlyAvg";

beforeEach(() => {
  mock.instance!.state.reset();
});

function queue(table: string, data: unknown) {
  const queues = mock.instance!.state.responses;
  queues[table] = queues[table] ?? [];
  queues[table].push({ data });
}

describe("usePickupMonthlyAvg", () => {
  it("returns an empty map and finishes loading when there are no recent pickups", async () => {
    queue("equipment_pickups", []);

    const { result } = renderHook(() => usePickupMonthlyAvg());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.avgByProduct.size).toBe(0);
  });

  it("aggregates quantities per product and divides by 3 (rounded to 0.1)", async () => {
    queue("equipment_pickups", [{ id: "pk1" }, { id: "pk2" }]);
    queue("equipment_pickup_items", [
      { product_id: "p-A", quantity: 4 },
      { product_id: "p-A", quantity: 5 }, // total p-A = 9 → 3.0
      { product_id: "p-B", quantity: 3 }, // total p-B = 3 → 1.0
    ]);

    const { result } = renderHook(() => usePickupMonthlyAvg());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.avgByProduct.get("p-A")).toBe(3);
    expect(result.current.avgByProduct.get("p-B")).toBe(1);
  });

  it("rounds to one decimal place: total 10 → 3.3", async () => {
    queue("equipment_pickups", [{ id: "pk1" }]);
    queue("equipment_pickup_items", [{ product_id: "p-A", quantity: 10 }]);

    const { result } = renderHook(() => usePickupMonthlyAvg());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // 10 / 3 = 3.333… → rounded to one decimal = 3.3
    expect(result.current.avgByProduct.get("p-A")).toBe(3.3);
  });

  it("treats null quantity as 0 (no NaN propagation)", async () => {
    queue("equipment_pickups", [{ id: "pk1" }]);
    queue("equipment_pickup_items", [
      { product_id: "p-A", quantity: null },
      { product_id: "p-A", quantity: 6 },
    ]);

    const { result } = renderHook(() => usePickupMonthlyAvg());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.avgByProduct.get("p-A")).toBe(2);
  });

  it("loading transitions from true to false", async () => {
    queue("equipment_pickups", []);

    const { result } = renderHook(() => usePickupMonthlyAvg());
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
  });
});
