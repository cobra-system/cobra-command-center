// Parallel Supabase queries used to be unwrapped with `res.data || []`, which
// silently turns a failed request into an empty result set. A tool would then
// answer "0 orders" or "no alerts" — indistinguishable from a healthy but empty
// database, and impossible for the caller to tell apart from a real answer.
//
// `rows()` makes the failure loud instead: the MCP SDK catches a thrown error
// and returns it to the caller as an isError response.

import type { PostgrestError } from "@supabase/supabase-js";

export interface QueryResult<T> {
  data: T[] | null;
  error: PostgrestError | null;
}

export class QueryFailure extends Error {
  constructor(label: string, message: string) {
    super(`Query failed (${label}): ${message}`);
    this.name = "QueryFailure";
  }
}

/**
 * Unwrap a Supabase result, throwing when the query failed.
 *
 * @param res   the awaited Supabase query result
 * @param label short name of what was queried, used in the error message
 */
export function unwrapRows<T = Record<string, unknown>>(res: QueryResult<T>, label: string): T[] {
  if (res.error) throw new QueryFailure(label, res.error.message);
  return res.data ?? [];
}
