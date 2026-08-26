/**
 * Match a parsed order file against live suppliers and products.
 *
 * Deliberately conservative: an ambiguous match (several plausible candidates)
 * is reported as "no match" so the user resolves it in the form rather than the
 * import guessing and creating an order against the wrong supplier/product.
 */
import type { Product, Supplier } from "@/contexts/types";
import type { ParsedOrderDoc, ParsedOrderItem } from "./types";

export type MatchReason = "sap_code" | "supplier_number" | "sku" | "exact_name" | "fuzzy_name" | null;

/**
 * SAP's catch-all item code (9999 and friends): the line carries no real product,
 * everything meaningful is written in the description. Never matched to a product —
 * such a line becomes a free-text row the user can complete or leave as is.
 */
export const isGenericItemCode = (code?: string | null): boolean =>
  /^9{3,}$/.test((code ?? "").trim());

export interface SupplierMatch {
  supplier: Supplier | null;
  reason: MatchReason;
}

export interface MatchedImportItem {
  parsed: ParsedOrderItem;
  product: Product | null;
  reason: MatchReason;
  /** The line used SAP's generic item code — the description is the item. */
  generic: boolean;
}

/** Codes compare without case, spaces, dashes, slashes or dots. */
export const normalizeCode = (v?: string | null): string =>
  (v ?? "").toLowerCase().replace(/[\s\-_/.]/g, "");

/** Names compare without case, punctuation or double spaces. */
export const normalizeName = (v?: string | null): string =>
  (v ?? "")
    .toLowerCase()
    .replace(/["'`׳״.,()[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export function matchSupplier(doc: ParsedOrderDoc, suppliers: Supplier[]): SupplierMatch {
  const none: SupplierMatch = { supplier: null, reason: null };
  const codes = [doc.supplierVat, doc.supplierCode].map(normalizeCode).filter(Boolean);
  const name = normalizeName(doc.supplierName);
  if (!codes.length && !name) return none;

  for (const code of codes) {
    const byCode = suppliers.find(
      s => normalizeCode(s.sap_code) === code || normalizeCode(s.supplier_number) === code
    );
    if (byCode) {
      return { supplier: byCode, reason: normalizeCode(byCode.sap_code) === code ? "sap_code" : "supplier_number" };
    }
  }

  if (!name) return none;

  const exact = suppliers.filter(s => normalizeName(s.company) === name);
  if (exact.length === 1) return { supplier: exact[0], reason: "exact_name" };
  if (exact.length > 1) return none;

  const fuzzy = suppliers.filter(s => {
    const company = normalizeName(s.company);
    return company.length > 2 && (company.includes(name) || name.includes(company));
  });
  if (fuzzy.length === 1) return { supplier: fuzzy[0], reason: "fuzzy_name" };

  return none;
}

export function matchProduct(item: ParsedOrderItem, products: Product[]): { product: Product | null; reason: MatchReason } {
  const none = { product: null as Product | null, reason: null as MatchReason };
  const generic = isGenericItemCode(item.code);

  // On a generic line the description is free text, so it is the only thing worth
  // matching on — and only exactly (a code written into the description, or the
  // product's exact name). No fuzzy guessing.
  const codes = generic
    ? [item.description].map(normalizeCode).filter(Boolean)
    : [item.code, item.mfrSku].map(normalizeCode).filter(Boolean);

  for (const code of codes) {
    const bySku = products.find(p => normalizeCode(p.sku) === code);
    if (bySku) return { product: bySku, reason: "sku" };
    const bySap = products.find(p => normalizeCode(p.sap_code) === code);
    if (bySap) return { product: bySap, reason: "sap_code" };
  }

  const name = normalizeName(item.description);
  if (!name || name.length < 3) return none;

  const exact = products.filter(p => normalizeName(p.name) === name);
  if (exact.length === 1) return { product: exact[0], reason: "exact_name" };
  if (exact.length > 1 || generic) return none;

  const fuzzy = products.filter(p => {
    const pname = normalizeName(p.name);
    return pname.length > 2 && (pname.includes(name) || name.includes(pname));
  });
  if (fuzzy.length === 1) return { product: fuzzy[0], reason: "fuzzy_name" };

  return none;
}

export function matchItems(items: ParsedOrderItem[], products: Product[]): MatchedImportItem[] {
  return items.map(parsed => {
    const { product, reason } = matchProduct(parsed, products);
    return { parsed, product, reason, generic: isGenericItemCode(parsed.code) };
  });
}

export const matchReasonLabel: Record<Exclude<MatchReason, null>, string> = {
  sap_code: "לפי קוד SAP",
  supplier_number: "לפי מספר ספק",
  sku: "לפי מק\"ט",
  exact_name: "לפי שם מדויק",
  fuzzy_name: "לפי שם דומה",
};
