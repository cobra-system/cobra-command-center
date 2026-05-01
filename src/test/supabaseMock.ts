import { vi } from "vitest";

export type Eq = [string, unknown];

export type Write =
  | { kind: "insert"; table: string; payload: Record<string, unknown> }
  | { kind: "update"; table: string; payload: Record<string, unknown>; eqs: Eq[] }
  | { kind: "delete"; table: string; eqs: Eq[] }
  | { kind: "upsert"; table: string; payload: Record<string, unknown> };

export interface SupabaseMockState {
  writes: Write[];
  responses: { [table: string]: Array<{ data: unknown; error?: unknown }> };
  defaultResponse: { data: unknown; error?: unknown };
  reset: () => void;
}

/**
 * Build a chainable supabase mock. Supports the chain methods we use across
 * the codebase: select / insert / update / delete / upsert / eq / gte / in /
 * not / limit / order / single / maybeSingle.
 *
 * Reads pull from `state.responses[table]` (FIFO) — falling back to
 * `state.defaultResponse` when the queue is empty. Writes are recorded into
 * `state.writes` and resolve with `{ data: null, error: null }` unless a
 * response is queued for that table.
 */
export function createSupabaseMock() {
  const state: SupabaseMockState = {
    writes: [],
    responses: {},
    defaultResponse: { data: null, error: null },
    reset() {
      state.writes.length = 0;
      state.responses = {};
      state.defaultResponse = { data: null, error: null };
    },
  };

  function takeResponse(table: string) {
    const queue = state.responses[table];
    if (queue && queue.length > 0) return queue.shift()!;
    return state.defaultResponse;
  }

  function from(table: string) {
    let mode: "select" | "insert" | "update" | "delete" | "upsert" | null = null;
    let payload: Record<string, unknown> | undefined;
    const eqs: Eq[] = [];

    const finalize = () => {
      if (mode === "insert") {
        state.writes.push({ kind: "insert", table, payload: payload! });
      } else if (mode === "update") {
        state.writes.push({ kind: "update", table, payload: payload!, eqs: [...eqs] });
      } else if (mode === "delete") {
        state.writes.push({ kind: "delete", table, eqs: [...eqs] });
      } else if (mode === "upsert") {
        state.writes.push({ kind: "upsert", table, payload: payload! });
      }
      const r = mode === "select" ? takeResponse(table) : { data: null, error: null };
      return Promise.resolve(r);
    };

    const b: Record<string, unknown> = {
      select: () => { mode = "select"; return b; },
      insert: (p: Record<string, unknown>) => { mode = "insert"; payload = p; return b; },
      update: (p: Record<string, unknown>) => { mode = "update"; payload = p; return b; },
      delete: () => { mode = "delete"; return b; },
      upsert: (p: Record<string, unknown>) => { mode = "upsert"; payload = p; return b; },
      eq: (col: string, val: unknown) => { eqs.push([col, val]); return b; },
      gte: () => b,
      lte: () => b,
      gt: () => b,
      lt: () => b,
      in: () => b,
      not: () => b,
      limit: () => b,
      order: () => b,
      single: () => Promise.resolve(takeResponse(table)),
      maybeSingle: () => Promise.resolve(takeResponse(table)),
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        finalize().then(resolve, reject),
    };
    return b;
  }

  return {
    state,
    from,
    auth: {
      getUser: vi.fn(),
    },
  };
}

export function inserts(state: SupabaseMockState, table: string) {
  return state.writes.filter(
    (w): w is Extract<Write, { kind: "insert" }> => w.kind === "insert" && w.table === table,
  );
}
export function updates(state: SupabaseMockState, table: string) {
  return state.writes.filter(
    (w): w is Extract<Write, { kind: "update" }> => w.kind === "update" && w.table === table,
  );
}
export function deletes(state: SupabaseMockState, table: string) {
  return state.writes.filter(
    (w): w is Extract<Write, { kind: "delete" }> => w.kind === "delete" && w.table === table,
  );
}
export function upserts(state: SupabaseMockState, table: string) {
  return state.writes.filter(
    (w): w is Extract<Write, { kind: "upsert" }> => w.kind === "upsert" && w.table === table,
  );
}
