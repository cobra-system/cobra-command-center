/**
 * Find the order a SWIFT confirmation pays for.
 *
 * The bank prints the supplier's invoice number in the payment details field
 * (:70:) — "DA20260007" — and Cobra stores that same number on the order as
 * `pi_number`. So a SWIFT can say which order it belongs to without the user
 * telling it, which is what makes uploading one onto the wrong order catchable.
 */
import { supabase } from "@/lib/supabase";
import type { ParsedSwift } from "./parseSwift";

export interface SwiftOrderMatch {
  id: string;
  pi_number: string | null;
  supplier_name: string | null;
  /** Where the invoice number was found — a pi_number hit is the strong one. */
  matchedOn: "pi_number" | "notes";
}

/** Comparable form of a document number: case and separators vary between systems. */
const normalize = (value: string): string => value.toUpperCase().replace(/[\s\-_/.]/g, "");

/**
 * Does this SWIFT belong to the order it was uploaded onto?
 *
 * `null` means "cannot tell" — the SWIFT quoted no invoice number, or the order
 * has none recorded — and must not be treated as a mismatch.
 */
export function swiftBelongsToOrder(swift: ParsedSwift, orderPiNumber?: string | null): boolean | null {
  if (!swift.referencedDocument || !orderPiNumber) return null;
  const a = normalize(swift.referencedDocument);
  const b = normalize(orderPiNumber);
  if (!a || !b) return null;
  // Revisions and suffixes are common on both sides (PI-2026-7 vs PI-2026-7rev1).
  return a.includes(b) || b.includes(a);
}

/** The order whose PI number the SWIFT quotes, or null when none matches. */
export async function findOrderForSwift(swift: ParsedSwift): Promise<SwiftOrderMatch | null> {
  const reference = swift.referencedDocument?.trim();
  if (!reference) return null;

  const { data, error } = await supabase
    .from("orders")
    .select("id, pi_number, supplier_name, notes")
    .is("deleted_at", null)
    .or(`pi_number.ilike.%${reference}%,notes.ilike.%${reference}%`)
    .limit(5);

  if (error || !data?.length) return null;

  const rows = data as { id: string; pi_number: string | null; supplier_name: string | null; notes: string | null }[];
  // An order whose pi_number carries the number beats one that only mentions it
  // in a note — the note could be about anything.
  const byPi = rows.find(r => r.pi_number && swiftBelongsToOrder(swift, r.pi_number));
  const chosen = byPi ?? rows[0];
  return {
    id: chosen.id,
    pi_number: chosen.pi_number,
    supplier_name: chosen.supplier_name,
    matchedOn: byPi ? "pi_number" : "notes",
  };
}
