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

/** Forwarders send PDFs; scans and photos of a stamped page turn up too. */
export const IMPORT_FILE_ACCEPT = ".pdf,.jpg,.jpeg,.png,.tif,.tiff,.doc,.docx,.xls,.xlsx";

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
  [/declaration|רשימון|הצהרת\s*יבוא/i, "DECLARATION"],
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

/** Storage-safe object name — Supabase storage rejects most non-ASCII paths. */
export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_{2,}/g, "_");
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
  const totals: ImportCostTotals = { landed: 0, recoverable: 0, duplicated: 0, cashOut: 0 };

  for (const line of lines) {
    const ils = lineAmountIls(line);
    if (ils === null) continue;

    if (line.included_in_document_id) totals.duplicated += ils;
    else if (line.is_recoverable) totals.recoverable += ils;
    else totals.landed += ils;
  }

  totals.cashOut = totals.landed + totals.recoverable;
  return totals;
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

  const path = `imports/${importFileId}/${Date.now()}_${sanitizeFileName(file.name)}`;

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
