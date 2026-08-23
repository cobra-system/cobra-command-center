/**
 * Parse a SAP purchase-order PDF (Hebrew, right-to-left) into a ParsedOrderDoc.
 *
 * This is the browser port of `scripts/sap-po/extract_po.py` — same fixed-template
 * strategy: text tokens are placed by their x/y coordinates, header scalars are read
 * off the row of their Hebrew label, and line items are cut into columns by x bands.
 * If SAP's layout changes, `COLUMN_BANDS` is the thing to adjust; the returned
 * `warnings` are designed to catch such drift instead of failing silently.
 */
import { emptyParsedDoc, type ParsedOrderDoc, type ParsedOrderItem } from "./types";

export interface PdfTextLine {
  /** Left edge in PDF user-space points. */
  x0: number;
  /** Right edge in PDF user-space points. */
  x1: number;
  /** Baseline y. Later pages are pushed below page 1 so rows never mix. */
  y: number;
  /** Text exactly as the PDF stores it (digits are reliable, Hebrew is visual-order). */
  raw: string;
  /** Hebrew de-reversed to logical order — use this for label matching. */
  norm: string;
}

const HEBREW = /[֐-׿]/;

/** Column boundaries (x of the token centre), right → left, for the SAP PO template. */
export const COLUMN_BANDS = {
  idx: 560,
  code: 505,
  mfrSku: 450,
  desc: 258,
  delivOrQty: 168,
  price: 115,
} as const;

type Band = "idx" | "code" | "mfrSku" | "desc" | "delivOrQty" | "price" | "total";

function bandOf(x: number): Band {
  if (x >= COLUMN_BANDS.idx) return "idx";
  if (x >= COLUMN_BANDS.code) return "code";
  if (x >= COLUMN_BANDS.mfrSku) return "mfrSku";
  if (x >= COLUMN_BANDS.desc) return "desc";
  if (x >= COLUMN_BANDS.delivOrQty) return "delivOrQty";
  if (x >= COLUMN_BANDS.price) return "price";
  return "total";
}

/** De-reverse visually-ordered Hebrew and repair the נ→ð font glitch. */
export function fixHebrew(s: string): string {
  const repaired = s.replace(/ð/g, "נ");
  return HEBREW.test(repaired) ? [...repaired].reverse().join("") : repaired;
}

/** DD/MM/YY(YY) → YYYY-MM-DD (SAP prints day/month/year). */
export function isoDate(d?: string | null): string | null {
  if (!d) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(d.trim());
  if (!m) return null;
  const [, dd, mm, yy] = m;
  const year = yy.length === 2 ? `20${yy}` : yy;
  return `${year}-${String(Number(mm)).padStart(2, "0")}-${String(Number(dd)).padStart(2, "0")}`;
}

export function toNumber(s?: string | null): number | null {
  if (s == null) return null;
  const cleaned = s.replace(/,/g, "").replace(/[₪$€]/g, "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const labelY = (lines: PdfTextLine[], needle: string): number | null =>
  lines.find(l => l.norm.includes(needle))?.y ?? null;

const rowTokens = (lines: PdfTextLine[], y: number, tol = 4): PdfTextLine[] =>
  lines.filter(l => Math.abs(l.y - y) <= tol);

/**
 * Turn positioned PDF text into a parsed order. Pure — `extractPdfTextLines`
 * does the pdfjs work, this does the template reading, so it is unit-testable.
 */
export function parseSapPoLines(lines: PdfTextLine[], fileName: string): ParsedOrderDoc {
  const out = emptyParsedDoc("sap-pdf", fileName);
  out.currency = "ILS";

  // --- header scalars ---------------------------------------------------
  const vat = /\b(\d{9})\b/.exec(lines.map(l => l.raw).join(" "));
  out.supplierVat = vat ? vat[1] : null;

  // supplier name: widest Hebrew token on the "לכבוד" row
  const toY = labelY(lines, "לכבוד");
  if (toY != null) {
    const cands = rowTokens(lines, toY).filter(l => !l.norm.includes("לכבוד") && HEBREW.test(l.norm));
    if (cands.length) {
      const widest = cands.reduce((a, b) => (b.x1 - b.x0 > a.x1 - a.x0 ? b : a));
      out.supplierName = widest.norm.replace(/\s+/g, " ").trim();
    }
  }

  // PO number: numeric token on the "הזמנת רכש" title row
  const poY = labelY(lines, "הזמנת רכש");
  if (poY != null) {
    const hit = rowTokens(lines, poY).find(l => /^\d{4,8}$/.test(l.raw.trim()));
    if (hit) out.poNumber = hit.raw.trim();
  }

  const dateY = labelY(lines, "תאריך");
  if (dateY != null) {
    const hit = rowTokens(lines, dateY).find(l => /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(l.raw.trim()));
    if (hit) out.orderDate = isoDate(hit.raw);
  }

  const termsY = labelY(lines, "תנאי תשלום");
  if (termsY != null) {
    const parts = rowTokens(lines, termsY).filter(l => !l.norm.includes("תנאי")).map(l => l.norm);
    if (parts.length) out.paymentTerms = parts.reverse().join("").replace(/\s+/g, "");
  }

  const agentY = labelY(lines, "סוכן");
  if (agentY != null) {
    const parts = rowTokens(lines, agentY)
      .filter(l => !l.norm.includes("סוכן") && HEBREW.test(l.norm))
      .map(l => l.norm);
    if (parts.length) out.agent = parts.join(" ");
  }

  const comment = lines.find(l => l.norm.startsWith("הזמנה עבור") || (l.norm.includes("עבור") && l.norm.includes("הזמנה")));
  if (comment) out.notes = comment.norm;

  // --- totals -----------------------------------------------------------
  const subtotalY = labelY(lines, 'חייב מע"מ');
  if (subtotalY != null) {
    const vals = rowTokens(lines, subtotalY)
      .map(l => toNumber(l.raw))
      .filter((v): v is number => v != null && v > 1);
    if (vals.length) out.subtotal = Math.max(...vals);
  }

  const vatRateLine = lines.find(l => {
    const v = toNumber(l.raw);
    return /^\d{1,2}\.\d{2}$/.test(l.raw.trim()) && v != null && v >= 15 && v <= 20;
  });
  if (vatRateLine) out.vatRate = toNumber(vatRateLine.raw);

  const moneyRe = /^(\d{1,3}(,\d{3})*|\d+)\.\d{2}$/;
  const monies = lines
    .map(l => (moneyRe.test(l.raw.replace(/₪/g, "").trim()) ? toNumber(l.raw) : null))
    .filter((v): v is number => v != null);
  out.vatAmount = out.subtotal != null && out.vatRate != null
    ? Math.round((out.subtotal * out.vatRate) / 100 * 100) / 100
    : null;
  out.total = monies.length ? Math.max(...monies) : null;

  // --- line items -------------------------------------------------------
  // Item rows carry a small integer in the '#' column (rightmost band), above the totals.
  const hdrY = labelY(lines, "קוד פריט");
  const itemYs = [...new Set(
    lines
      .filter(l => l.x0 >= COLUMN_BANDS.idx && /^\d{1,3}$/.test(l.raw.trim()) && (hdrY == null || l.y < hdrY))
      .map(l => l.y)
  )].sort((a, b) => b - a);

  for (const iy of itemYs) {
    const toks = rowTokens(lines, iy, 3).sort((a, b) => b.x0 - a.x0);
    const item: ParsedOrderItem = {
      code: null, mfrSku: null, description: null,
      deliveryDate: null, qty: null, unitPrice: null, lineTotal: null,
      currency: "ILS",
    };
    const desc: string[] = [];
    const mid: PdfTextLine[] = [];

    for (const t of toks) {
      switch (bandOf((t.x0 + t.x1) / 2)) {
        case "code": if (/\w/.test(t.raw)) item.code = t.raw.trim(); break;
        case "mfrSku": item.mfrSku = t.raw.trim(); break;
        case "desc": desc.push(t.norm); break;
        case "delivOrQty": mid.push(t); break;
        case "price": item.unitPrice = toNumber(t.raw); break;
        case "total": item.lineTotal = toNumber(t.raw); break;
        default: break;
      }
    }
    if (desc.length) item.description = desc.join(" ").replace(/\s+/g, " ").trim();
    for (const t of mid) {
      if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(t.raw.trim())) item.deliveryDate = isoDate(t.raw);
      else if (toNumber(t.raw) != null) item.qty = toNumber(t.raw);
    }
    if (item.code || item.lineTotal != null) out.items.push(item);
  }

  // --- validation -------------------------------------------------------
  const lineSum = out.items.reduce((s, i) => s + (i.lineTotal || 0), 0);
  if (out.subtotal != null && Math.abs(lineSum - out.subtotal) > 0.5) {
    out.warnings.push(`סכום השורות (${lineSum.toFixed(2)}) לא תואם לסה"כ לפני מע"מ (${out.subtotal.toFixed(2)})`);
  }
  if (out.subtotal != null && out.vatRate != null && out.total != null) {
    const expected = Math.round(out.subtotal * (1 + out.vatRate / 100) * 100) / 100;
    if (Math.abs(expected - out.total) > 1) {
      out.warnings.push(`סה"כ כולל מע"מ (${out.total.toFixed(2)}) לא תואם לחישוב (${expected.toFixed(2)})`);
    }
  }
  if (!out.items.length) {
    out.warnings.push("לא זוהו שורות פריטים — ייתכן שתבנית הקובץ השתנתה. אפשר להשלים ידנית בטופס");
  }

  return out;
}

/** Read a PDF into positioned text lines using pdfjs (worker bundled by Vite). */
export async function extractPdfTextLines(data: ArrayBuffer): Promise<PdfTextLine[]> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const lines: PdfTextLine[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    // Pages after the first are pushed far below page 1 so equal y values on
    // different pages are never grouped into one table row.
    const pageOffset = (pageNum - 1) * 100000;
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const text = item.str.trim();
      if (!text) continue;
      const x0 = item.transform[4] as number;
      const y = item.transform[5] as number;
      lines.push({
        x0: Math.round(x0),
        x1: Math.round(x0 + (item.width || 0)),
        y: Math.round(y) - pageOffset,
        raw: text,
        norm: fixHebrew(text),
      });
    }
  }
  return lines;
}

export async function parseSapPoPdf(file: File): Promise<ParsedOrderDoc> {
  const buffer = await file.arrayBuffer();
  const lines = await extractPdfTextLines(buffer);
  if (!lines.length) {
    const doc = emptyParsedDoc("sap-pdf", file.name);
    doc.warnings.push("לא נמצא טקסט ב-PDF (ייתכן שזו סריקה) — אפשר לצרף את הקובץ ולמלא ידנית");
    return doc;
  }
  return parseSapPoLines(lines, file.name);
}
