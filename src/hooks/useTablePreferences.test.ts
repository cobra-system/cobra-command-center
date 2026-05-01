import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

type Eq = [string, unknown];
type UpsertCall = { table: string; payload: Record<string, unknown> };

const state = vi.hoisted(() => ({
  upserts: [] as UpsertCall[],
  selectResponse: { data: null as unknown, error: null as { code: string } | null },
  authSession: null as { user: { id: string } } | null,
}));

vi.mock("@/contexts/AppContext", () => ({
  useAuth: () => ({ session: state.authSession }),
}));

vi.mock("@/lib/supabase", () => {
  function builder(table: string) {
    let mode: "select" | "upsert" | null = null;
    const eqs: Eq[] = [];
    let upsertPayload: Record<string, unknown> | undefined;

    const finalize = () => {
      if (mode === "upsert") {
        state.upserts.push({ table, payload: upsertPayload! });
        return Promise.resolve({ error: null });
      }
      return Promise.resolve({ data: null, error: null });
    };

    const b: Record<string, unknown> = {
      select: () => { mode = "select"; return b; },
      upsert: (p: Record<string, unknown>) => {
        mode = "upsert";
        upsertPayload = p;
        return b;
      },
      eq: (col: string, val: unknown) => { eqs.push([col, val]); return b; },
      single: () => Promise.resolve({ ...state.selectResponse }),
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        finalize().then(resolve, reject),
    };
    return b;
  }
  return { supabase: { from: builder } };
});

import { useTablePreferences } from "./useTablePreferences";

beforeEach(() => {
  state.upserts.length = 0;
  state.selectResponse = { data: null, error: { code: "PGRST116" } };
  state.authSession = null;
  localStorage.clear();
});

describe("useTablePreferences — unauthenticated", () => {
  it("returns the provided defaults when nothing is stored", async () => {
    const { result } = renderHook(() =>
      useTablePreferences("orders", { sortField: "created_at", sortDir: "desc" })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.sortField).toBe("created_at");
    expect(result.current.sortDir).toBe("desc");
    expect(result.current.filters).toEqual({});
  });

  it("loads existing preferences from localStorage", async () => {
    localStorage.setItem(
      "tablePreferences:orders",
      JSON.stringify({ sortField: "name", sortDir: "asc", filters: { status: "PENDING" } })
    );

    const { result } = renderHook(() => useTablePreferences("orders"));

    await waitFor(() => expect(result.current.sortField).toBe("name"));
    expect(result.current.sortDir).toBe("asc");
    expect(result.current.filters).toEqual({ status: "PENDING" });
  });

  it("savePreferences writes to localStorage and skips the DB", async () => {
    const { result } = renderHook(() => useTablePreferences("orders"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.savePreferences({ sortField: "qty", sortDir: "desc" });
    });

    const stored = JSON.parse(localStorage.getItem("tablePreferences:orders")!);
    expect(stored.sortField).toBe("qty");
    expect(stored.sortDir).toBe("desc");
    expect(state.upserts).toHaveLength(0);
  });

  it("does not crash on a corrupted localStorage payload", async () => {
    localStorage.setItem("tablePreferences:orders", "not-json");
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useTablePreferences("orders"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.sortField).toBeNull();
    expect(result.current.filters).toEqual({});
    errSpy.mockRestore();
  });
});

describe("useTablePreferences — toggleSort 3-state cycle", () => {
  it("none → asc → desc → none for the same field", async () => {
    const { result } = renderHook(() => useTablePreferences("orders"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => result.current.toggleSort("name"));
    expect(result.current.sortField).toBe("name");
    expect(result.current.sortDir).toBe("asc");

    await act(async () => result.current.toggleSort("name"));
    expect(result.current.sortField).toBe("name");
    expect(result.current.sortDir).toBe("desc");

    await act(async () => result.current.toggleSort("name"));
    expect(result.current.sortField).toBeNull();
    expect(result.current.sortDir).toBeNull();
  });

  it("switching to a different field always starts at asc", async () => {
    const { result } = renderHook(() => useTablePreferences("orders"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => result.current.toggleSort("name"));
    await act(async () => result.current.toggleSort("name")); // now desc

    await act(async () => result.current.toggleSort("qty"));
    expect(result.current.sortField).toBe("qty");
    expect(result.current.sortDir).toBe("asc");
  });
});

describe("useTablePreferences — filter helpers", () => {
  it("setFilter merges into the filters object", async () => {
    const { result } = renderHook(() => useTablePreferences("orders"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => result.current.setFilter("status", "PENDING"));
    expect(result.current.filters).toEqual({ status: "PENDING" });

    await act(async () => result.current.setFilter("priority", "דחוף"));
    expect(result.current.filters).toEqual({ status: "PENDING", priority: "דחוף" });
  });

  it("clearFilter removes a single key without touching the rest", async () => {
    const { result } = renderHook(() => useTablePreferences("orders"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => result.current.setFilter("status", "PENDING"));
    await act(async () => result.current.setFilter("priority", "דחוף"));
    await act(async () => result.current.clearFilter("status"));

    expect(result.current.filters).toEqual({ priority: "דחוף" });
  });

  it("clearPreferences resets sort and filters to a blank slate", async () => {
    const { result } = renderHook(() => useTablePreferences("orders"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => result.current.toggleSort("name"));
    await act(async () => result.current.setFilter("status", "PENDING"));
    await act(async () => result.current.clearPreferences());

    expect(result.current.sortField).toBeNull();
    expect(result.current.sortDir).toBeNull();
    expect(result.current.filters).toEqual({});
  });
});

describe("useTablePreferences — authenticated", () => {
  it("loads from the database when a session exists", async () => {
    state.authSession = { user: { id: "u-1" } };
    state.selectResponse = {
      data: {
        sort_field: "created_at",
        sort_dir: "desc",
        filters: { status: "ORDERED" },
      },
      error: null,
    };

    const { result } = renderHook(() => useTablePreferences("orders"));

    await waitFor(() => expect(result.current.sortField).toBe("created_at"));
    expect(result.current.sortDir).toBe("desc");
    expect(result.current.filters).toEqual({ status: "ORDERED" });
  });

  it("savePreferences upserts to user_preferences and also writes localStorage", async () => {
    state.authSession = { user: { id: "u-1" } };

    const { result } = renderHook(() => useTablePreferences("orders"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.savePreferences({ sortField: "name", sortDir: "asc" });
    });

    expect(state.upserts).toHaveLength(1);
    expect(state.upserts[0].table).toBe("user_preferences");
    expect(state.upserts[0].payload).toMatchObject({
      user_id: "u-1",
      page_name: "orders",
      sort_field: "name",
      sort_dir: "asc",
    });

    const stored = JSON.parse(localStorage.getItem("tablePreferences:orders")!);
    expect(stored.sortField).toBe("name");
  });

  it("falls back to localStorage when the DB row is absent (PGRST116)", async () => {
    state.authSession = { user: { id: "u-1" } };
    state.selectResponse = { data: null, error: { code: "PGRST116" } };
    localStorage.setItem(
      "tablePreferences:orders",
      JSON.stringify({ sortField: "name", sortDir: "asc", filters: {} })
    );

    const { result } = renderHook(() => useTablePreferences("orders"));

    await waitFor(() => expect(result.current.sortField).toBe("name"));
    expect(result.current.sortDir).toBe("asc");
  });

  it("filter handlers also persist via upsert when authenticated", async () => {
    state.authSession = { user: { id: "u-1" } };

    const { result } = renderHook(() => useTablePreferences("orders"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => result.current.setFilter("status", "PENDING"));

    expect(state.upserts).toHaveLength(1);
    expect(state.upserts[0].payload.filters).toEqual({ status: "PENDING" });
  });
});
