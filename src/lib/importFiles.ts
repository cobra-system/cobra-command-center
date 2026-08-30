/**
 * Import files (תיקי יבוא) — the customs-broker dossier for one shipment.
 *
 * A dossier is the bundle of 5-8 PDFs a forwarder emails a few days after a
 * shipment lands. They all describe the same physical shipment and are tied
 * together by the forwarder's file number ("תיק", e.g. 460509).
 *
 * Storage layout, chosen so import PDFs inherit the documents module's viewer,
 * search, starring and trash rather than growing a parallel system:
 *   file bytes        → `documents` storage bucket, same as every other upload
 *   file row          → purchase_documents, with import_file_id set
 *   shipment facts    → import_files
 *   money             → import_cost_lines
 *   which orders      → import_file_orders (many-to-many: one container often
 *                       carries several orders)
 */
import { supabase } from "@/lib/supabase";

/** Document `type` for import paperwork — a general attachment, not a PI/PO. */
export const IMPORT_DOC_TYPE = "כללי";

/**
 * Accept anything.
 *
 * Forwarders send PDFs, but also scans, phone photos of a stamped page, Excel
 * annexes, and occasionally a forwarded .msg or .eml. Filtering by extension
 * only ever silently hides a file the person meant to keep, so the picker
 * takes everything and the document kind is sorted out afterwards.
 */
export const IMPORT_FILE_ACCEPT = "*";

/**
 * The document kinds that make up a dossier, written to
 * purchase_documents.document_subtype.
 *
 * DECLARATION / BL / PACKING_LIST / INVOICE / CUSTOMS already existed in the
 * documents module's vocabulary; the rest are new here. Every forwarder lays
 * its paperwork out differently, so OTHER stays a valid answer.
 */
export const IMPORT_DOC_SUBTYPES = [
  "COMMERCIAL_INVOICE",
  "PACKING_LIST",
  "BL",
  "DECLARATION",
  "FREIGHT_INVOICE",
  "TERMINAL_INVOICE",
  "FORWARDER_INVOICE",
  "INSURANCE",
  "CERTIFICATE_OF_ORIGIN",
  "OTHER",
] as const;

export type ImportDocSubtype = (typeof IMPORT_DOC_SUBTYPES)[number];

export const importDocSubtypeLabels: Record<ImportDocSubtype, string> = {
  COMMERCIAL_INVOICE: "חשבונית מסחרית",
  PACKING_LIST: "רשימת אריזה",
  BL: "שטר מטען",
  DECLARATION: "רשימון יבוא",
  FREIGHT_INVOICE: "חשבונית הובלה",
  TERMINAL_INVOICE: "חשבונית מסוף",
  FORWARDER_INVOICE: "חשבונית משלח מרכזת",
  INSURANCE: "ביטוח",
  CERTIFICATE_OF_ORIGIN: "תעודת מקור",
  OTHER: "אחר",
};

/**
 * A forwarder's summary invoice restates the freight and terminal invoices as
 * its own lines. Only these kinds can therefore *contain* another document's
 * charges, so only they are offered as the "already included in" target.
 */
export const SUMMARY_DOC_SUBTYPES: ImportDocSubtype[] = ["FORWARDER_INVOICE"];

export const importCostCategories = [
  "freight",
  "origin",
  "terminal",
  "customs_duty",
  "vat",
  "clearance",
  "inland",
  "storage",
  "insurance",
  "fees",
  "other",
] as const;

export type ImportCostCategory = (typeof importCostCategories)[number];

export const importCostCategoryLabels: Record<ImportCostCategory, string> = {
  freight: "הובלה ימית/אווירית",
  origin: "הוצאות במקור",
  terminal: "מסוף ונמל",
  customs_duty: "מכס",
  vat: 'מע"מ',
  clearance: "עמילות מכס",
  inland: "הובלה יבשתית",
  storage: "אחסנה ודמורג'",
  insurance: "ביטוח",
  fees: "אגרות",
  other: "אחר",
};

/** VAT is reclaimed, so it is pre-ticked as recoverable when picked. */
export const RECOVERABLE_BY_DEFAULT: ImportCostCategory[] = ["vat"];

/**
 * What counts as the cost of moving the goods, as opposed to the cost of
 * clearing them.
 *
 * This is the number a person means by "how much did the shipment cost me":
 * the freight itself plus everything the forwarder charges to get the box from
 * the supplier's door to the warehouse. Duty, VAT, brokerage and statutory
 * fees are the customs side — they follow from what was imported and its
 * value, not from how it travelled, so mixing them in makes air and sea
 * incomparable.
 */
export const SHIPPING_CATEGORIES: ImportCostCategory[] = [
  "freight",
  "origin",
  "terminal",
  "inland",
  "storage",
  "insurance",
];

export function isShippingCategory(category: string): boolean {
  return SHIPPING_CATEGORIES.includes(category as ImportCostCategory);
}

export const shipmentModes = ["SEA", "AIR", "LAND", "COURIER"] as const;
export type ShipmentMode = (typeof shipmentModes)[number];

export const shipmentModeLabels: Record<ShipmentMode, string> = {
  SEA: "ימי",
  AIR: "אווירי",
  LAND: "יבשתי",
  COURIER: "שליח",
};

export const importFileStatuses = ["draft", "matched", "complete"] as const;
export type ImportFileStatus = (typeof importFileStatuses)[number];

export const importFileStatusLabels: Record<ImportFileStatus, string> = {
  draft: "טיוטה",
  matched: "משויך",
  complete: "הושלם",
};

export const importFileStatusColors: Record<ImportFileStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  matched: "bg-primary/15 text-primary",
  complete: "bg-success/15 text-success",
};

export interface ImportFile {
  id: string;
  file_number: string;
  forwarder_name: string | null;
  declaration_number: string | null;
  declaration_date: string | null;
  bl_number: string | null;
  house_bl_number: string | null;
  container_number: string | null;
  vessel_name: string | null;
  port_of_loading: string | null;
  port_of_discharge: string | null;
  shipment_mode: string;
  etd: string | null;
  arrival_date: string | null;
  release_date: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  supplier_invoice_number: string | null;
  goods_value: number | null;
  goods_currency: string;
  exchange_rate: number | null;
  customs_value_ils: number | null;
  gross_weight_kg: number | null;
  volume_cbm: number | null;
  package_count: number | null;
  shipment_group_id: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportCostLine {
  id: string;
  import_file_id: string;
  document_id: string | null;
  line_code: string | null;
  label: string;
  category: string;
  amount: number;
  currency: string;
  amount_ils: number | null;
  is_recoverable: boolean;
  included_in_document_id: string | null;
  notes: string | null;
  created_at: string;
}

/** A PDF belonging to a dossier — a purchase_documents row. */
export interface ImportDocument {
  id: string;
  document_name: string | null;
  document_subtype: string | null;
  document_number: string | null;
  file_url: string | null;
  total_price: number | null;
  currency: string;
  created_at: string;
}


/**
 * Guess a document's kind from its file name.
 *
 * Forwarders name their attachments consistently enough that this is right
 * most of the time, and the upload dialog always lets a person override it.
 * Ordered most specific first: "Freight_Tax_Invoice_460509.pdf" must land on
 * FREIGHT_INVOICE, not the looser INVOICE rule at the end.
 */
const NAME_HINTS: [RegExp, ImportDocSubtype][] = [
  [/packing[\s_-]*list|רשימת\s*אריזה/i, "PACKING_LIST"],
  // SAD — Single Administrative Document, DHL's name for the customs
  // declaration. Bounded, so it cannot fire inside an unrelated word.
  [/declaration|רשימון|הצהרת\s*יבוא|(?:^|[^a-z0-9])sad(?![a-z0-9])/i, "DECLARATION"],
  // DHL calls the shipper's own commercial invoice "paperwork" and abbreviates
  // it to ppwk — the one file in a DHL batch that really is the goods invoice.
  [/(?:^|[^a-z0-9])(ppwk|paperwork)(?![a-z0-9])/i, "COMMERCIAL_INVOICE"],
  // …while DHL's "proforma" is not a supplier proforma at all: it is their own
  // clearance charges bill (VAT, computer and security fees, release fee). The
  // two names read backwards from what they mean, so both are pinned here. A
  // genuine supplier proforma dropped into a dossier would land on this rule
  // too; the kind is editable on the document row for exactly that reason.
  [/(?:^|[^a-z0-9])proforma(?![a-z0-9])/i, "FORWARDER_INVOICE"],
  [/freight|הובלה/i, "FREIGHT_INVOICE"],
  [/masof|terminal|מסוף/i, "TERMINAL_INVOICE"],
  // Not \b around the acronyms: underscore is a word character, so \b never
  // fires in "HAWB_460509". Bound on "not alphanumeric" instead.
  [/(?:^|[^a-z0-9])(hawb|hbl|mbl|awb)(?![a-z0-9])|bill[\s_-]*of[\s_-]*lading|שטר\s*מטען/i, "BL"],
  [/commercial[\s_-]*invoice|חשבונית\s*מסחרית/i, "COMMERCIAL_INVOICE"],
  [/certificate.*origin|תעודת\s*מקור/i, "CERTIFICATE_OF_ORIGIN"],
  [/insurance|ביטוח/i, "INSURANCE"],
  // "Inv_197112.pdf" — Total Care abbreviates. Bounded so it does not fire
  // inside unrelated words; plain "invoice" is handled by the first branch.
  [/invoice|חשבונית|(?:^|[^a-z0-9])inv(?![a-z0-9])/i, "FORWARDER_INVOICE"],
];

export function guessSubtype(fileName: string): ImportDocSubtype {
  for (const [pattern, subtype] of NAME_HINTS) {
    if (pattern.test(fileName)) return subtype;
  }
  return "OTHER";
}

/** Pull a run of 4+ digits out of a file name, e.g. Inv_197112 → 197112. */
export function guessDocumentNumber(fileName: string): string {
  const base = fileName.replace(/\.[^/.]+$/, "");
  const matches = base.match(/\d{4,}/g);
  return matches ? matches[matches.length - 1] : "";
}

/**
 * Work out which dossier a batch of dropped files belongs to.
 *
 * A person drops the whole email's attachments at once, and the forwarder's
 * file number is the one identifier printed on all of them — so it is also the
 * number that repeats across their names. Candidates are 4-8 digit runs: long
 * enough to exclude a "207" terminal code, short enough to exclude a 14-digit
 * customs declaration number, which appears on one file only.
 *
 * Returns the most frequent candidate, or null when nothing repeats (a single
 * file, or names with no numbers in them at all).
 */
export function deriveFileNumber(fileNames: string[]): string | null {
  const counts = new Map<string, number>();

  for (const name of fileNames) {
    const base = name.replace(/\.[^/.]+$/, "");
    // Count each number once per file, so a name repeating it twice does not
    // outvote two files that each mention it once.
    // Bounded on BOTH sides: without the lookbehind, the 14-digit declaration
    // number 26024532019850 would still yield "2019850" as a 7-digit tail and
    // masquerade as a file number.
    //
    // Upper bound is 12, not 8: DHL names its batch after the 10-digit air
    // waybill (5060974542_awb.pdf, _sad.pdf, …), and at 8 the whole batch
    // resolved to nothing and landed under a placeholder. 12 still excludes
    // the 14-digit customs declaration number, which appears on one file only.
    const seen = new Set(base.match(/(?<!\d)\d{4,12}(?!\d)/g) ?? []);
    for (const n of seen) counts.set(n, (counts.get(n) ?? 0) + 1);
  }

  let best: string | null = null;
  let bestCount = 1; // must appear in at least two files to be a shared key
  for (const [value, count] of counts) {
    if (count > bestCount) { best = value; bestCount = count; }
  }
  return best;
}

/** Storage-safe object name — Supabase storage rejects most non-ASCII paths. */
export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_{2,}/g, "_");
}

/**
 * A storage key that cannot collide with another file's.
 *
 * sanitizeFileName strips every non-ASCII character, so any Hebrew name
 * ("שטר מטען.pdf", "רשימת אריזה.pdf", …) collapses to the same "_.pdf". Keying
 * on a timestamp plus that name meant a batch of Hebrew-named attachments
 * uploaded within the same millisecond resolved to one path, and Supabase
 * storage rejected all but the first as already existing — silently losing
 * documents. The random id makes the key unique regardless of the name; the
 * sanitized name is kept only so the bucket stays browsable, and the real
 * name always survives in purchase_documents.document_name.
 */
export function importStorageKey(importFileId: string, fileName: string): string {
  const id = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const readable = sanitizeFileName(fileName);
  return `imports/${importFileId}/${id}_${readable}`;
}

/**
 * What a charge actually costs the business.
 *
 * Two kinds of line are worth money on paper but must not reach landed cost:
 *   - recoverable VAT, which is offset against output VAT;
 *   - a line already restated inside another document (the forwarder's summary
 *     invoice repeating the freight invoice), which would otherwise be counted
 *     twice.
 */
export function isCostBearing(line: Pick<ImportCostLine, "is_recoverable" | "included_in_document_id">): boolean {
  return !line.is_recoverable && !line.included_in_document_id;
}

export interface ImportCostTotals {
  /** Added cost that belongs in landed cost. */
  landed: number;
  /**
   * The cost of moving the goods — freight, origin charges, terminal, inland
   * haulage, storage, insurance. Part of `landed`, broken out because it is
   * the figure that answers "what did this shipment cost me" and the only one
   * that is comparable between air and sea.
   */
  shipping: number;
  /** Duty, brokerage and statutory fees. Also part of `landed`. */
  customs: number;
  /** Recoverable VAT — paid out, then reclaimed. */
  recoverable: number;
  /** Lines restated inside another document; shown, never summed. */
  duplicated: number;
  /** Cash actually leaving the business: landed + recoverable. */
  cashOut: number;
}

/**
 * Total a dossier's charges, in ILS.
 *
 * Lines carry `amount_ils` when the source document converted them; otherwise
 * an ILS `amount` is used as-is. A foreign-currency line with no conversion is
 * skipped rather than silently added at the wrong rate — the UI flags those.
 */
export function sumImportCosts(lines: ImportCostLine[]): ImportCostTotals {
  const totals: ImportCostTotals = {
    landed: 0, shipping: 0, customs: 0, recoverable: 0, duplicated: 0, cashOut: 0,
  };

  for (const line of lines) {
    const ils = lineAmountIls(line);
    if (ils === null) continue;

    if (line.included_in_document_id) {
      totals.duplicated += ils;
    } else if (line.is_recoverable) {
      totals.recoverable += ils;
    } else {
      totals.landed += ils;
      // shipping + customs always re-add to landed, so the split can be shown
      // without a third "everything else" bucket appearing.
      if (isShippingCategory(line.category)) totals.shipping += ils;
      else totals.customs += ils;
    }
  }

  totals.cashOut = totals.landed + totals.recoverable;
  return totals;
}

/**
 * Shipping cost expressed per unit of freight, which is what makes two
 * shipments comparable.
 *
 * A total on its own says nothing — ₪9,000 is cheap for a full container and
 * ruinous for 40kg of air freight. Sea freight is normally bought per CBM and
 * air per kg, so both are returned and the caller shows whichever suits the
 * mode. Null where the dossier has no weight or volume recorded; guessing a
 * denominator would invent a rate.
 */
export interface ShippingUnitCost {
  perKg: number | null;
  perCbm: number | null;
  /** The rate to lead with for this shipment's mode. */
  headline: { value: number; unit: "kg" | "CBM" } | null;
}

export function shippingUnitCost(
  shipping: number,
  file: Pick<ImportFile, "gross_weight_kg" | "volume_cbm" | "shipment_mode">
): ShippingUnitCost {
  const weight = file.gross_weight_kg ? Number(file.gross_weight_kg) : null;
  const volume = file.volume_cbm ? Number(file.volume_cbm) : null;

  const perKg = weight && weight > 0 ? shipping / weight : null;
  const perCbm = volume && volume > 0 ? shipping / volume : null;

  // Air is sold on weight, sea on volume. Fall back to whichever exists so a
  // dossier missing one measure still gets a headline rate.
  const prefersWeight = file.shipment_mode === "AIR" || file.shipment_mode === "COURIER";
  const headline = prefersWeight
    ? (perKg !== null ? { value: perKg, unit: "kg" as const } : perCbm !== null ? { value: perCbm, unit: "CBM" as const } : null)
    : (perCbm !== null ? { value: perCbm, unit: "CBM" as const } : perKg !== null ? { value: perKg, unit: "kg" as const } : null);

  return { perKg, perCbm, headline };
}

/** A line's ILS value, or null when it is in another currency and unconverted. */
export function lineAmountIls(line: Pick<ImportCostLine, "amount" | "amount_ils" | "currency">): number | null {
  if (line.amount_ils !== null && line.amount_ils !== undefined) return Number(line.amount_ils);
  if (line.currency === "ILS") return Number(line.amount);
  return null;
}

export interface UploadImportDocumentArgs {
  file: File;
  importFileId: string;
  subtype: ImportDocSubtype;
  /** Defaults to the file name without its extension. */
  documentName?: string;
  documentNumber?: string | null;
  supplierId?: string | null;
  /** Order to also file the document under, so it shows on that order's page. */
  orderId?: string | null;
  totalPrice?: number | null;
  currency?: string | null;
}

export interface UploadImportDocumentResult {
  error: string | null;
  documentId?: string;
  fileUrl?: string;
}

/**
 * Store one dossier PDF: upload to the `documents` bucket, then record it in
 * purchase_documents pointing at the dossier.
 */
export async function uploadImportDocument(args: UploadImportDocumentArgs): Promise<UploadImportDocumentResult> {
  const { file, importFileId, subtype, documentNumber, supplierId, orderId, totalPrice, currency } = args;

  const path = importStorageKey(importFileId, file.name);

  const { error: uploadError } = await supabase.storage.from("documents").upload(path, file);
  if (uploadError) return { error: uploadError.message };

  const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);

  const documentName = args.documentName?.trim() || file.name.replace(/\.[^/.]+$/, "");

  const { data, error: insertError } = await supabase
    .from("purchase_documents")
    .insert({
      document_name: documentName,
      type: IMPORT_DOC_TYPE,
      document_subtype: subtype,
      document_number: documentNumber || null,
      import_file_id: importFileId,
      order_id: orderId || null,
      supplier_id: supplierId || null,
      file_url: urlData.publicUrl,
      total_price: totalPrice ?? null,
      currency: currency || "ILS",
      quantity: 0,
    })
    .select("id")
    .single();

  if (insertError) {
    // Roll back the upload so a failed insert does not orphan the file.
    await supabase.storage.from("documents").remove([path]);
    return { error: insertError.message };
  }

  return { error: null, documentId: data.id, fileUrl: urlData.publicUrl };
}

export interface AttachBatchArgs {
  files: File[];
  orderId: string;
  supplierId?: string | null;
  supplierName?: string | null;
  /** Used to name a dossier when the file names carry no shared number. */
  orderNumber?: string | null;
}

export interface AttachBatchResult {
  error: string | null;
  importFileId?: string;
  fileNumber?: string;
  uploaded: number;
  /** Files already in the dossier, skipped rather than filed twice. */
  skipped: number;
  /** Files that failed, as "name: reason" — a partial batch still counts. */
  failures: string[];
  /** True when the dossier already existed and these files joined it. */
  joinedExisting: boolean;
}

/**
 * Drop a batch of import PDFs onto an order and be done.
 *
 * Everything a dossier needs is inferred: which dossier the files belong to
 * (the file number repeated across their names), what each document is (its
 * name), and the link to the order. Nothing is asked of the person up front —
 * the shipment details and the cost lines are filled in later, if at all.
 *
 * Re-dropping is safe and expected: the rest of the paperwork arrives over
 * several days, and a later batch carrying the same file number joins the
 * dossier already on the order instead of making a second one.
 */
export async function attachImportDocumentBatch(args: AttachBatchArgs): Promise<AttachBatchResult> {
  const { files, orderId, supplierId, supplierName, orderNumber } = args;

  if (files.length === 0) {
    return { error: "לא נבחרו קבצים", uploaded: 0, skipped: 0, failures: [], joinedExisting: false };
  }

  const derived = deriveFileNumber(files.map(f => f.name));
  // No shared number to go on — still create the dossier rather than blocking,
  // with a placeholder the person can correct. Losing the files is worse than
  // an ugly number.
  const fileNumber = derived ?? `${orderNumber || "ORDER"}-${Date.now().toString().slice(-6)}`;

  // Join the dossier if this order already has one under that number, so a
  // second batch of attachments lands with the first.
  const { data: existingLinks } = await supabase
    .from("import_file_orders")
    .select("import_file_id, import_files(id, file_number, deleted_at)")
    .eq("order_id", orderId);

  const existing = (existingLinks ?? [])
    .map(l => l.import_files as unknown as { id: string; file_number: string; deleted_at: string | null } | null)
    .find(f => f && !f.deleted_at && f.file_number === fileNumber);

  let importFileId: string;
  let joinedExisting = false;

  if (existing) {
    importFileId = existing.id;
    joinedExisting = true;
  } else {
    const { data: created, error: createError } = await supabase
      .from("import_files")
      .insert({
        file_number: fileNumber,
        supplier_id: supplierId ?? null,
        supplier_name: supplierName ?? null,
        status: "matched",
      })
      .select("id")
      .single();

    if (createError) {
      return { error: createError.message, uploaded: 0, skipped: 0, failures: [], joinedExisting: false };
    }
    importFileId = created.id;

    const { error: linkError } = await supabase.from("import_file_orders").insert({
      import_file_id: importFileId,
      order_id: orderId,
      matched_by: "manual",
      match_reason: derived ? `file number ${fileNumber} in attachment names` : "uploaded onto this order",
    });
    if (linkError) {
      // Roll the dossier back so a failed link does not strand it.
      await supabase.from("import_files").delete().eq("id", importFileId);
      return { error: linkError.message, uploaded: 0, skipped: 0, failures: [], joinedExisting: false };
    }
  }

  // Re-dropping the same attachments is the normal way to recover from a
  // failed batch, so a file already in the dossier is skipped rather than
  // filed twice. Matching on the displayed name is enough: that is what a
  // person sees, and it is what a repeat of the same attachment carries.
  const { data: alreadyThere } = await supabase
    .from("purchase_documents")
    .select("document_name")
    .eq("import_file_id", importFileId);
  const existingNames = new Set(
    (alreadyThere ?? []).map(d => (d.document_name ?? "").trim().toLowerCase()).filter(Boolean)
  );

  // Upload sequentially: a batch is under ten files, and one failure should
  // not take the rest of them down with it.
  let uploaded = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const file of files) {
    const displayName = file.name.replace(/\.[^/.]+$/, "");
    if (existingNames.has(displayName.trim().toLowerCase())) {
      skipped += 1;
      continue;
    }

    const result = await uploadImportDocument({
      file,
      importFileId,
      subtype: guessSubtype(file.name),
      documentNumber: guessDocumentNumber(file.name) || null,
      supplierId,
      orderId,
    });
    if (result.error) {
      failures.push(`${file.name}: ${result.error}`);
    } else {
      uploaded += 1;
      existingNames.add(displayName.trim().toLowerCase());
    }
  }

  // A dossier created for a batch where nothing landed is an empty shell that
  // clutters the order and means nothing. Take it back out; one that files
  // even a single document stays.
  if (!joinedExisting && uploaded === 0) {
    await supabase.from("import_file_orders").delete().eq("import_file_id", importFileId);
    await supabase.from("import_files").delete().eq("id", importFileId);
    return { error: null, fileNumber, uploaded: 0, skipped, failures, joinedExisting: false };
  }

  return { error: null, importFileId, fileNumber, uploaded, skipped, failures, joinedExisting };
}
