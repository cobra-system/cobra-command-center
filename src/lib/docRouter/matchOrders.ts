/**
 * Find the order(s) a document talks about by the identifiers it prints.
 *
 * A B/L quotes the booking or tracking number, a packing list the PI number, a
 * forwarder's invoice the container — and Cobra keeps all of those on the order.
 * So the document usually says where it belongs without being told, the same
 * way a SWIFT quotes the PI it pays (see swiftImport/findOrder.ts).
 */
import type { Order } from "@/contexts/types";

export interface OrderCandidate {
  order: Order;
  score: number;
  reasons: string[];
}

/** Comparable form: case, spaces and separators differ between systems. */
const normalize = (v: string): string => v.toUpperCase().replace(/[\s\-_/.]/g, "");

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Is `id` present in `haystack`?
 *
 * A purely numeric id must stand alone ("460509" must not match inside a
 * 14-digit declaration number). An alphanumeric one may differ in separators
 * ("SR-PI-26031" vs "SRPI26031").
 */
export function mentions(haystack: string, id: string | null | undefined, minLength = 5): boolean {
  const raw = (id ?? "").trim();
  if (raw.length < minLength) return false;
  const standalone = new RegExp(`(?<![A-Za-z0-9])${escapeRegex(raw)}(?![A-Za-z0-9])`, "i");
  if (standalone.test(haystack)) return true;
  if (/^\d+$/.test(raw)) return false;
  const n = normalize(raw);
  return n.length >= 6 && normalize(haystack).includes(n);
}

const IDENTIFIERS: { field: keyof Order; score: number; label: string }[] = [
  { field: "pi_number", score: 50, label: "מספר PI" },
  { field: "sap_doc_entry", score: 50, label: "הזמנת SAP" },
  { field: "order_number", score: 50, label: "מספר הזמנה" },
  { field: "tracking_number", score: 40, label: "מספר מעקב / B/L" },
  { field: "booking_number", score: 40, label: "מספר booking" },
  { field: "tclog_reference", score: 40, label: "אסמכתא TCLOG" },
];

/** Orders whose identifiers appear in the document, best first. */
export function findOrderCandidates(text: string, fileName: string, orders: Order[], limit = 5): OrderCandidate[] {
  const haystack = `${fileName}\n${text}`;
  const candidates: OrderCandidate[] = [];

  for (const order of orders) {
    let score = 0;
    const reasons: string[] = [];
    for (const { field, score: points, label } of IDENTIFIERS) {
      const value = order[field];
      if (typeof value === "string" && mentions(haystack, value)) {
        score += points;
        reasons.push(label);
      }
    }
    if (order.vessel_name && mentions(haystack, order.vessel_name, 6)) {
      score += 15;
      reasons.push("שם אונייה");
    }
    if (score > 0) candidates.push({ order, score, reasons });
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * The single obvious candidate, or null. Two orders sharing the top score (one
 * container carrying several orders is normal) is "ask the person", not a coin flip.
 */
export function pickConfidentCandidate(candidates: OrderCandidate[]): OrderCandidate | null {
  if (!candidates.length) return null;
  const [first, second] = candidates;
  if (first.score < 40) return null;
  if (second && second.score >= first.score) return null;
  return first;
}

/** An existing order that already carries this PI / SAP number, if any. */
export function findDuplicateOrder(
  orders: Order[],
  ids: { piNumber?: string | null; poNumber?: string | null },
): Order | null {
  const pi = ids.piNumber ? normalize(ids.piNumber) : "";
  const po = ids.poNumber ? normalize(ids.poNumber) : "";
  return orders.find(o =>
    (po && o.sap_doc_entry && normalize(o.sap_doc_entry) === po) ||
    (pi && o.pi_number && normalize(o.pi_number) === pi)
  ) ?? null;
}
