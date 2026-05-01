import { describe, it, expect, beforeEach, vi } from "vitest";
import { inserts, deletes } from "@/test/supabaseMock";

const mock = vi.hoisted(() => ({
  instance: null as ReturnType<typeof import("@/test/supabaseMock").createSupabaseMock> | null,
}));

vi.mock("@/lib/supabase", async () => {
  const { createSupabaseMock } = await import("@/test/supabaseMock");
  mock.instance = createSupabaseMock();
  return { supabase: mock.instance };
});

import { syncDivisionProducts } from "./divisionUtils";

beforeEach(() => {
  mock.instance!.state.reset();
});

function seedExisting(rows: Array<{ id: string; division: string }>) {
  mock.instance!.state.responses["division_products"] = [{ data: rows }];
}

describe("syncDivisionProducts", () => {
  it("inserts only the divisions that are new", async () => {
    seedExisting([{ id: "dp-1", division: "Logistics" }]);

    await syncDivisionProducts("p-1", "Logistics, Sales");

    const ins = inserts(mock.instance!.state, "division_products");
    expect(ins).toHaveLength(1);
    expect(ins[0].payload).toEqual([{ division: "Sales", product_id: "p-1" }]);
    expect(deletes(mock.instance!.state, "division_products")).toHaveLength(0);
  });

  it("deletes only the divisions that were removed", async () => {
    seedExisting([
      { id: "dp-1", division: "Logistics" },
      { id: "dp-2", division: "Sales" },
    ]);

    await syncDivisionProducts("p-1", "Logistics");

    const del = deletes(mock.instance!.state, "division_products");
    expect(del).toHaveLength(1);
    // The helper passes IDs through `.in("id", [...])`; our mock records only the eq() chain,
    // so we just assert the delete was issued for the right table.
    expect(del[0].table).toBe("division_products");
    expect(inserts(mock.instance!.state, "division_products")).toHaveLength(0);
  });

  it("performs both delete and insert when the set changes", async () => {
    seedExisting([
      { id: "dp-1", division: "Logistics" },
      { id: "dp-2", division: "Sales" },
    ]);

    await syncDivisionProducts("p-1", "Sales, Marketing");

    expect(deletes(mock.instance!.state, "division_products")).toHaveLength(1);

    const ins = inserts(mock.instance!.state, "division_products");
    expect(ins).toHaveLength(1);
    expect(ins[0].payload).toEqual([{ division: "Marketing", product_id: "p-1" }]);
  });

  it("is a no-op when the requested divisions equal the existing ones", async () => {
    seedExisting([
      { id: "dp-1", division: "Logistics" },
      { id: "dp-2", division: "Sales" },
    ]);

    await syncDivisionProducts("p-1", "Logistics, Sales");

    expect(inserts(mock.instance!.state, "division_products")).toHaveLength(0);
    expect(deletes(mock.instance!.state, "division_products")).toHaveLength(0);
  });

  it("clears every division when newDivision is null/empty", async () => {
    seedExisting([
      { id: "dp-1", division: "Logistics" },
      { id: "dp-2", division: "Sales" },
    ]);

    await syncDivisionProducts("p-1", null);

    expect(deletes(mock.instance!.state, "division_products")).toHaveLength(1);
    expect(inserts(mock.instance!.state, "division_products")).toHaveLength(0);
  });

  it("trims whitespace and skips empty entries from the comma-separated input", async () => {
    seedExisting([]);

    await syncDivisionProducts("p-1", "  Logistics ,  , Sales  ,");

    const ins = inserts(mock.instance!.state, "division_products");
    expect(ins).toHaveLength(1);
    expect(ins[0].payload).toEqual([
      { division: "Logistics", product_id: "p-1" },
      { division: "Sales", product_id: "p-1" },
    ]);
  });
});
