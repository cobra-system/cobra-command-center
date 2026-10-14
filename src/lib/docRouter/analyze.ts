/**
 * Read a dropped file, decide what it is, and gather what the matching flow
 * needs to propose a destination. Nothing here writes to the database — the
 * dashboard inbox shows the proposal and only `execute.ts` saves anything.
 */
import { supabase } from "@/lib/supabase";
import type { Order, OrderPayment } from "@/contexts/types";
import { extractPdfTextLines } from "@/lib/orderImport/sapPdf";
import { tokensToLines } from "@/lib/orderImport/foreignDoc";
import { parseOrderFile, type ParsedOrderDoc } from "@/lib/orderImport";
import { parseSwiftText, SWIFT_SCAN_MESSAGE, type ParsedSwift } from "@/lib/swiftImport/parseSwift";
import { findOrderForSwift } from "@/lib/swiftImport/findOrder";
import { matchSwiftToPayment, type SwiftMatch } from "@/lib/swiftImport/matchPayment";
import { classifyDocument, type Classification, type DocKind } from "./classify";
import { findDuplicateOrder, findOrderCandidates, pickConfidentCandidate, type OrderCandidate } from "./matchOrders";

const SPREADSHEET_EXT = [".xlsx", ".xls", ".xlsm", ".csv", ".tsv"];
const TEXT_EXT = [".txt", ".sta", ".mt103"];

const extensionOf = (name: string) => name.slice(name.lastIndexOf(".")).toLowerCase();

export interface FileText {
  lines: string[];
  text: string;
  /** No readable text layer: a scan, a photo, or a format the browser cannot open. */
  unreadable: boolean;
}

export async function readFileText(file: File): Promise<FileText> {
  const ext = extensionOf(file.name);
  let lines: string[] = [];
  try {
    if (ext === ".pdf") {
      lines = tokensToLines(await extractPdfTextLines(await file.arrayBuffer()));
    } else if (TEXT_EXT.includes(ext)) {
      lines = (await file.text()).split("\n");
    }
  } catch {
    lines = [];
  }
  const isSpreadsheet = SPREADSHEET_EXT.includes(ext);
  return { lines, text: lines.join("\n"), unreadable: lines.length === 0 && !isSpreadsheet };
}

export interface SwiftPlan {
  swift: ParsedSwift;
  /** Order the SWIFT's invoice reference points at, when it names one. */
  orderId: string | null;
  payments: OrderPayment[];
  match: SwiftMatch | null;
}

export interface AnalyzedDoc {
  id: string;
  file: File;
  kind: DocKind;
  classification: Classification;
  fileText: FileText;
  candidates: OrderCandidate[];
  /** SWIFT: parsed transfer plus the installment it settles. */
  swiftPlan?: SwiftPlan;
  /** NEW_ORDER: the in-browser reading, and an existing order with the same PI / PO. */
  parsedOrder?: ParsedOrderDoc;
  duplicate?: Order | null;
  notes: string[];
}

/** Installments of an order, for matching a SWIFT against them. */
export async function loadOrderPayments(orderId: string): Promise<OrderPayment[]> {
  const { data } = await supabase
    .from("order_payments")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  return (data as OrderPayment[] | null) ?? [];
}

/** Match a parsed SWIFT to an order's schedule — used again when the person changes the order. */
export async function planSwiftForOrder(swift: ParsedSwift, orderId: string | null): Promise<SwiftPlan> {
  if (!orderId) return { swift, orderId: null, payments: [], match: null };
  const payments = await loadOrderPayments(orderId);
  return { swift, orderId, payments, match: matchSwiftToPayment(swift, payments) };
}

/**
 * Gather what the chosen kind needs. Separate from classification so a person
 * who overrides the guess gets the right proposal without re-reading the file.
 */
export async function enrichForKind(doc: AnalyzedDoc, kind: DocKind, orders: Order[]): Promise<AnalyzedDoc> {
  const next: AnalyzedDoc = { ...doc, kind, notes: [], swiftPlan: undefined, parsedOrder: undefined, duplicate: undefined };

  if (kind === "SWIFT") {
    if (doc.fileText.unreadable) {
      next.notes.push(SWIFT_SCAN_MESSAGE);
      return next;
    }
    const swift = parseSwiftText(doc.fileText.lines, doc.file.name);
    const byReference = await findOrderForSwift(swift);
    next.swiftPlan = await planSwiftForOrder(swift, byReference?.id ?? null);
    return next;
  }

  if (kind === "NEW_ORDER") {
    const parsed = await parseOrderFile(doc.file);
    next.parsedOrder = parsed;
    next.duplicate = findDuplicateOrder(orders, { piNumber: parsed.piNumber, poNumber: parsed.poNumber });
    return next;
  }

  if (kind === "SHIPPING" && doc.fileText.unreadable) {
    next.notes.push("אין טקסט בקובץ (סריקה / צילום) — השיוך להזמנה לפי שם הקובץ בלבד, כדאי לוודא ידנית");
  }
  return next;
}

let counter = 0;

export async function analyzeFile(file: File, orders: Order[]): Promise<AnalyzedDoc> {
  const fileText = await readFileText(file);
  let classification = classifyDocument({ fileName: file.name, text: fileText.text });

  // A spreadsheet carries no text the classifier can read, but one that parses
  // into order lines is an order file whatever it is called.
  if (classification.kind === "UNKNOWN" && SPREADSHEET_EXT.includes(extensionOf(file.name))) {
    const parsed = await parseOrderFile(file);
    if (parsed.items.length > 0) {
      classification = { kind: "NEW_ORDER", subtype: null, confidence: "medium", reasons: ["קובץ טבלה עם שורות פריטים"] };
    }
  }

  const candidates = findOrderCandidates(fileText.text, file.name, orders);
  const base: AnalyzedDoc = {
    id: `${Date.now()}-${counter++}`,
    file,
    kind: classification.kind,
    classification,
    fileText,
    candidates,
    notes: [],
  };
  if (classification.kind === "UNKNOWN") {
    if (fileText.unreadable) base.notes.push("אי אפשר לקרוא טקסט מהקובץ (סריקה / צילום) — בחר ידנית מה זה");
    return base;
  }
  return enrichForKind(base, classification.kind, orders);
}

/** Order a SHIPPING document should join when the text names exactly one. */
export function suggestedOrderId(doc: AnalyzedDoc): string {
  return pickConfidentCandidate(doc.candidates)?.order.id ?? "";
}
