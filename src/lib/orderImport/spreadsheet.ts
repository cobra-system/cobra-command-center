/**
 * Parse an order spreadsheet (Excel / CSV) into a ParsedOrderDoc.
 *
 * Aimed at the free-form PI / order confirmations that come back from foreign
 * suppliers: there is no fixed template, so we locate the item table by looking
 * for a header row whose cells match known column names (Hebrew or English) and
 * read the rows under it until the table ends.
 */
import { emptyParsedDoc, type ParsedOrderDoc, type ParsedOrderItem } from "./types";
import { numberVariants, parseForeignDocLines } from "./foreignDoc";

export type Cell = string | number | boolean | null | undefined;
export type SheetRows = Cell[][];

type ColumnKey = "code" | "description" | "qty" | "unitPrice" | "lineTotal" | "currency" | "deliveryDate";

/** Header synonyms per column, matched case-insensitively as substrings. */
const COLUMN_SYNONYMS: Record<ColumnKey, string[]> = {
  code: ["מק\"ט", "מקט", "מק'ט", "קוד פריט", "קוד", "דגם", "sku", "item code", "item no", "item#", "part no", "part number", "p/n", "model", "code"],
  description: ["תיאור", "תאור", "שם פריט", "שם מוצר", "פריט", "description", "product name", "product", "item name", "goods", "name"],
  qty: ["כמות", "יחידות", "qty", "quantity", "pcs", "pieces", "units"],
  unitPrice: ["מחיר יחידה", "מחיר ליחידה", "מחיר", "unit price", "u/price", "price/pc", "unit cost", "fob price", "price"],
  lineTotal: ["סה\"כ שורה", "סה\"כ", "סהכ", "סך הכל", "total amount", "line total", "amount", "total"],
  currency: ["מטבע", "currency", "curr"],
  deliveryDate: ["תאריך אספקה", "אספקה", "delivery date", "delivery", "eta"],
};

/** Columns that have to be present for a row to count as the table header. */
const REQUIRED_FOR_HEADER: ColumnKey[] = ["qty"];

const norm = (v: Cell): string =>
  String(v ?? "").replace(/\s+/g, " ").trim().toLowerCase();

function classifyHeaderCell(value: Cell): ColumnKey | null {
  const text = norm(value);
  if (!text) return null;
  let best: { key: ColumnKey; len: number } | null = null;
  for (const [key, synonyms] of Object.entries(COLUMN_SYNONYMS) as [ColumnKey, string[]][]) {
    for (const syn of synonyms) {
      if (text.includes(syn.toLowerCase()) && (!best || syn.length > best.len)) {
        best = { key, len: syn.length };
      }
    }
  }
  return best?.key ?? null;
}

export function parseNumericCell(value: Cell): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  // A CSV from a European supplier writes 1.234,56 where an Asian one writes
  // 1,234.56 — numberVariants knows both conventions.
  const stripped = value.replace(/[₪$€£¥\s ]/g, "").trim();
  const [first] = numberVariants(stripped);
  return first ?? null;
}

function detectCurrency(...values: Cell[]): string | null {
  for (const v of values) {
    const text = String(v ?? "");
    if (/₪|ils|nis|ש"ח|שח/i.test(text)) return "ILS";
    if (/€|eur/i.test(text)) return "EUR";
    if (/\$|usd/i.test(text)) return "USD";
  }
  return null;
}

/** Find the item-table header row and where each known column sits. */
export function findHeaderRow(rows: SheetRows): { index: number; columns: Partial<Record<ColumnKey, number>> } | null {
  const limit = Math.min(rows.length, 40);
  for (let r = 0; r < limit; r++) {
    const columns: Partial<Record<ColumnKey, number>> = {};
    (rows[r] || []).forEach((cell, c) => {
      const key = classifyHeaderCell(cell);
      if (key && columns[key] === undefined) columns[key] = c;
    });
    const named = Object.keys(columns).length;
    const hasRequired = REQUIRED_FOR_HEADER.every(k => columns[k] !== undefined);
    const hasIdentity = columns.code !== undefined || columns.description !== undefined;
    if (named >= 2 && hasRequired && hasIdentity) return { index: r, columns };
  }
  return null;
}

const SUMMARY_ROW = /^(total|sub ?total|grand total|סה"?כ|סהכ|סך הכל|מע"?מ|vat)/i;

/** Label patterns for the scalars above the item table (matched on the whole cell label). */
const LABELS = {
  supplier: /^(ספק|שם ספק|שם הספק|supplier|vendor|seller|shipper|beneficiary)$/i,
  pi: /^(pi|p\.?i\.?\s*(no|number|#)?|proforma( invoice)?\s*(no|number|#)?|invoice\s*(no|number|#)?|inv\.?\s*(no)?|חשבונית|מספר חשבונית)$/i,
  po: /^(po|p\.?o\.?\s*(no|number|#)?|purchase order\s*(no|number|#)?|הזמנת רכש|מספר הזמנה|מס' הזמנה)$/i,
  date: /^(תאריך|תאריך הזמנה|date|order date)$/i,
  terms: /^(תנאי תשלום|payment terms|terms)$/i,
} as const;

/** Pull the header scalars (supplier, document number, date, terms) out of the sheet. */
function readScalars(rows: SheetRows, doc: ParsedOrderDoc, headerIndex: number): void {
  // Reads "ספק: X", "ספק:" followed by X in the next cell, and "Supplier" | "X".
  const labelled = (pattern: RegExp): string | null => {
    for (let r = 0; r < Math.min(rows.length, headerIndex + 1); r++) {
      const row = rows[r] || [];
      for (let c = 0; c < row.length; c++) {
        const text = String(row[c] ?? "").trim();
        if (!text) continue;
        const [labelPart, ...rest] = text.split(/[:：]/);
        if (!pattern.test(labelPart.trim())) continue;
        const inline = rest.join(":").trim();
        if (inline) return inline;
        for (let n = c + 1; n < Math.min(row.length, c + 4); n++) {
          const next = String(row[n] ?? "").trim();
          if (next) return next;
        }
      }
    }
    return null;
  };

  doc.supplierName = labelled(LABELS.supplier);
  doc.piNumber = labelled(LABELS.pi);
  doc.poNumber = labelled(LABELS.po);

  const rawDate = labelled(LABELS.date);
  if (rawDate) {
    const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/.exec(rawDate.trim());
    if (m) {
      const year = m[3].length === 2 ? `20${m[3]}` : m[3];
      doc.orderDate = `${year}-${String(Number(m[2])).padStart(2, "0")}-${String(Number(m[1])).padStart(2, "0")}`;
    } else if (/^\d{4}-\d{2}-\d{2}/.test(rawDate.trim())) {
      doc.orderDate = rawDate.trim().slice(0, 10);
    }
  }

  const terms = labelled(LABELS.terms);
  if (terms) doc.paymentTerms = terms;
}

/** Parse rows already read off a sheet. Pure, so it is unit-testable without xlsx. */
export function parseOrderRows(rows: SheetRows, fileName: string): ParsedOrderDoc {
  const doc = emptyParsedDoc("spreadsheet", fileName);
  const header = findHeaderRow(rows);

  if (!header) {
    // No recognisable header — fall back to reading the sheet as free text and
    // recovering rows where qty x unit price = line amount. A supplier whose
    // column titles are in Turkish still writes an item table that multiplies out.
    const flattened = rows.map(row => row.map(c => String(c ?? "").trim()).filter(Boolean).join("  ")).filter(Boolean);
    const recovered = parseForeignDocLines(flattened, fileName);
    if (recovered.items.length) {
      recovered.warnings.unshift("לא זוהתה שורת כותרות — הפריטים שוחזרו לפי החישוב 'כמות × מחיר = סכום'. בדוק אותם היטב");
      return recovered;
    }
    doc.warnings.push("לא זוהתה טבלת פריטים בקובץ — ודא שיש שורת כותרות עם 'כמות' ו'מק\"ט' או 'תיאור'. אפשר לצרף את הקובץ ולמלא ידנית");
    return doc;
  }

  readScalars(rows, doc, header.index);

  const { columns } = header;
  const cellAt = (row: Cell[], key: ColumnKey): Cell =>
    columns[key] === undefined ? null : row[columns[key]!];

  let blankStreak = 0;
  for (let r = header.index + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const isEmpty = row.every(c => String(c ?? "").trim() === "");
    if (isEmpty) {
      blankStreak++;
      // two blank rows in a row means the table ended
      if (blankStreak >= 2) break;
      continue;
    }
    blankStreak = 0;

    const firstText = String(row.find(c => String(c ?? "").trim() !== "") ?? "").trim();
    const qty = parseNumericCell(cellAt(row, "qty"));
    const description = String(cellAt(row, "description") ?? "").trim() || null;
    const code = String(cellAt(row, "code") ?? "").trim() || null;

    // summary / totals rows carry no item identity
    if (SUMMARY_ROW.test(firstText) && !code && !description) {
      const summaryTotal = parseNumericCell(cellAt(row, "lineTotal"));
      if (summaryTotal != null && doc.total == null) doc.total = summaryTotal;
      continue;
    }
    if (!code && !description) continue;

    const item: ParsedOrderItem = {
      code,
      description,
      qty,
      unitPrice: parseNumericCell(cellAt(row, "unitPrice")),
      lineTotal: parseNumericCell(cellAt(row, "lineTotal")),
      currency: detectCurrency(cellAt(row, "currency"), cellAt(row, "unitPrice"), cellAt(row, "lineTotal")),
      deliveryDate: null,
    };
    if (item.lineTotal == null && item.qty != null && item.unitPrice != null) {
      item.lineTotal = Math.round(item.qty * item.unitPrice * 100) / 100;
    }
    doc.items.push(item);
  }

  const currencies = [...new Set(doc.items.map(i => i.currency).filter(Boolean))] as string[];
  doc.currency = currencies.length === 1 ? currencies[0] : (currencies[0] ?? null);

  const sum = doc.items.reduce((s, i) => s + (i.lineTotal || 0), 0);
  doc.subtotal = sum || null;
  if (doc.total != null && doc.subtotal != null && Math.abs(doc.total - doc.subtotal) > 1) {
    doc.warnings.push(`סכום השורות (${doc.subtotal.toFixed(2)}) לא תואם לסה"כ שבקובץ (${doc.total.toFixed(2)})`);
  }
  if (!doc.items.length) doc.warnings.push("לא נמצאו שורות פריטים מתחת לשורת הכותרות");
  const missingQty = doc.items.filter(i => !i.qty).length;
  if (missingQty) doc.warnings.push(`ל-${missingQty} שורות אין כמות — יש להשלים בטופס`);

  return doc;
}

export async function parseOrderSpreadsheet(file: File): Promise<ParsedOrderDoc> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    const doc = emptyParsedDoc("spreadsheet", file.name);
    doc.warnings.push("הקובץ ריק");
    return doc;
  }
  const rows = XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[sheetName], {
    header: 1,
    raw: true,
    defval: null,
    blankrows: true,
  });
  return parseOrderRows(rows, file.name);
}
