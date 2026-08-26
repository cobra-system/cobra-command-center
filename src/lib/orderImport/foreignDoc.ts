/**
 * Parse a foreign supplier's purchase document (proforma invoice, order
 * confirmation, sales contract) into a ParsedOrderDoc — without a template.
 *
 * The SAP export always looks the same, so `sapPdf.ts` can read it by column
 * bands. An overseas supplier's document cannot be read that way: every supplier
 * has its own layout, language and number format. What every purchase order does
 * share is arithmetic — a line carries three numbers where qty x unit price =
 * line amount. Scanning each line for a numeric triple that reconciles finds the
 * item rows whatever the column order is, and settles as a side effect whether
 * "1.234,56" means 1234.56 (Europe) or 1.23456 read as 1.234 (nowhere) — the
 * reading that makes the row reconcile is the right one.
 *
 * Header scalars (document number, dates, currency, incoterm, payment terms,
 * totals) are read by multilingual label matching, and anything that does not
 * add up is reported in `warnings` rather than silently accepted.
 *
 * This is the browser counterpart of `scripts/foreign-po/extract_doc.py`, which
 * does the same job for the chat-side import (and additionally renders scans to
 * images for a visual read — something the browser cannot do).
 */
import { emptyParsedDoc, type ParsedOrderDoc, type ParsedOrderItem } from "./types";
import { extractPdfTextLines, type PdfTextLine } from "./sapPdf";

// ─── Numbers ─────────────────────────────────────────────────────────────────

/** One number found on a line, with every plausible reading of it. */
export interface NumberSpan {
  values: number[];
  start: number;
  end: number;
}

/**
 * Every plausible reading of a numeric token. `1,234.56` and `1.234,56` both
 * mean 1234.56; a lone `2.400` could be 2400 or 2.4 and both are returned.
 */
export function numberVariants(token: string): number[] {
  const raw = token.trim().replace(/[\s\u00a0]/g, "");
  if (!raw) return [];
  const negative = raw.startsWith("-");
  const body = raw.replace(/^[-+]/, "");
  if (!/^\d[\d.,]*$/.test(body)) return [];

  const lastDot = body.lastIndexOf(".");
  const lastComma = body.lastIndexOf(",");
  let primary: string;

  if (lastDot >= 0 && lastComma >= 0) {
    // Whichever separator comes last is the decimal point.
    const decimal = lastDot > lastComma ? "." : ",";
    const thousands = decimal === "." ? "," : ".";
    primary = body.split(thousands).join("").replace(decimal, ".");
  } else if (lastComma >= 0) {
    const groups = body.split(",");
    primary = groups.every((g, i) => (i === 0 ? g.length <= 3 : g.length === 3))
      ? groups.join("")                      // 1,234,567 — thousands
      : body.replace(/,/g, ".");             // 12,50 — decimal comma
  } else if (lastDot >= 0) {
    const groups = body.split(".");
    primary = groups.length > 2 && groups.every((g, i) => (i === 0 ? g.length <= 3 : g.length === 3))
      ? groups.join("")                      // 1.234.567 — thousands
      : body;
  } else {
    primary = body;
  }

  const out: number[] = [];
  const push = (n: number) => {
    if (Number.isFinite(n) && !out.includes(n)) out.push(negative ? -n : n);
  };
  push(Number(primary));

  // A single separator followed by exactly three digits is genuinely ambiguous
  // (2.400 = 2400 in Milan, 2.4 in London) — offer both and let the row decide.
  const ambiguous = /^\d{1,3}[.,]\d{3}$/.exec(body);
  if (ambiguous) push(Number(body.replace(/[.,]/, "")));

  return out;
}

const NUMBER_TOKEN = /[-+]?\d[\d.,]*/g;

/**
 * Numbers on a line that could be a quantity or money — skipping digits that
 * belong to a part code (`SR-4410`) or a fraction (`3/8"`).
 */
export function rowNumbers(line: string): NumberSpan[] {
  const out: NumberSpan[] = [];
  for (const match of line.matchAll(NUMBER_TOKEN)) {
    const start = match.index ?? 0;
    const token = match[0].replace(/[.,]+$/, "");
    if (!token) continue;
    const prev = start > 0 ? line[start - 1] : "";
    const prev2 = start > 1 ? line[start - 2] : "";
    if (/[A-Za-z0-9]/.test(prev)) continue;                 // inside a code like AB12
    if ((prev === "-" || prev === "/") && /[A-Za-z0-9]/.test(prev2)) continue;
    const values = numberVariants(token).filter(v => v > 0);
    if (values.length) out.push({ values, start, end: start + token.length });
  }
  return out;
}

// ─── Line items ──────────────────────────────────────────────────────────────

interface Reconciled {
  qty: number;
  unitPrice: number;
  lineTotal: number;
  error: number;
  spans: NumberSpan[];
  amountIsRightmost: boolean;
}

const RECONCILE_TOLERANCE = 0.015;

/** The best qty x price = amount triple on a line, or null when nothing adds up. */
export function reconcileRow(nums: NumberSpan[]): Reconciled | null {
  if (nums.length < 3) return null;
  let best: Reconciled | null = null;
  for (let a = 0; a < nums.length; a++) {
    for (let b = 0; b < nums.length; b++) {
      if (a === b) continue;
      for (let c = 0; c < nums.length; c++) {
        if (c === a || c === b) continue;
        for (const qty of nums[a].values) {
          for (const unitPrice of nums[b].values) {
            for (const lineTotal of nums[c].values) {
              // The amount is the largest of the three, by definition.
              if (lineTotal < unitPrice || lineTotal < qty) continue;
              const error = Math.abs(qty * unitPrice - lineTotal) / lineTotal;
              if (error > RECONCILE_TOLERANCE) continue;
              const candidate: Reconciled = {
                qty, unitPrice, lineTotal, error,
                spans: [nums[a], nums[b], nums[c]],
                amountIsRightmost: nums[c].start > Math.max(nums[a].start, nums[b].start),
              };
              const better = !best
                || candidate.lineTotal > best.lineTotal
                || (candidate.lineTotal === best.lineTotal
                    && (Number(candidate.amountIsRightmost) - Number(best.amountIsRightmost)
                        || best.error - candidate.error) > 0);
              if (better) best = candidate;
            }
          }
        }
      }
    }
  }
  return best;
}

// ─── Labels ──────────────────────────────────────────────────────────────────

const DOC_LABEL =
  "(?:proforma\\s*(?:invoice)?|p\\s*/?\\s*i|pi|invoice|inv|order|purchase\\s*order|p\\s*/?\\s*o|po|" +
  "contract|quotation|quote|offer|reference|ref|ordine|orden|pedido|commande|bestellung|auftrag|" +
  "rechnung|factura|facture|fattura|订单|发票)";
const NUMBER_WORD = "(?:number|no\\.?|n[o°º]\\.?|#|nr\\.?|num\\.?|№|numero|numéro|nummer)";
const DOC_VALUE = "([A-Za-z0-9][A-Za-z0-9\\-/_.]{3,29})";

const DOC_NUMBER_PATTERNS = [
  new RegExp(`${DOC_LABEL}[\\s.]*${NUMBER_WORD}?\\s*[:#]?\\s*${DOC_VALUE}`, "gi"),
  new RegExp(`${NUMBER_WORD}\\s*${DOC_LABEL}?\\s*[:#]\\s*${DOC_VALUE}`, "gi"),
];

const DATE_LABEL = new RegExp(
  "\\b(invoice\\s+date|order\\s+date|issue\\s+date|date\\s+of\\s+issue|dated|date|etd|eta|" +
  "delivery\\s+date|shipment\\s+date|ship\\s+date|data|fecha|datum|consegna|entrega|livraison|" +
  "lieferung|日期)\\b\\s*[:.]?\\s*(.{0,28})", "gi");

const DELIVERY_LABEL = /(delivery|shipment|ship\s+date|eta|consegna|entrega|livraison|lieferung)/i;

const CURRENCY_CODE = /\b(USD|EUR|GBP|CNY|RMB|JPY|ILS|NIS|CHF|TRY|INR|PLN|SEK|AUD|CAD|HKD|SGD)\b/g;
const CURRENCY_SYMBOL = /[$€£¥₪]/g;
const SYMBOL_TO_CODE: Record<string, string> = { $: "USD", "€": "EUR", "£": "GBP", "¥": "CNY", "₪": "ILS" };
const CURRENCY_ALIAS: Record<string, string> = { RMB: "CNY", NIS: "ILS" };

const INCOTERM = /\b(EXW|FCA|FAS|FOB|CFR|CIF|CPT|CIP|DAP|DPU|DDP|DAT)\b[\s,:-]*([A-Z][A-Za-z\-' ]{2,28})?/;

const PAYMENT_TERMS =
  /\b(T\s*\/\s*T|L\s*\/\s*C|D\s*\/\s*P|wire\s+transfer|bank\s+transfer|advance|deposit|balance|net\s*\d{1,3}\s*days?|\d{1,3}\s*%\s*(?:deposit|advance|balance|before|against|upon))/i;

const TOTAL_LABEL =
  /\b(grand\s+total|total\s+amount|amount\s+due|total\s+due|total\s+value|net\s+total|sub\s*-?\s*total|subtotal|total|totale|gesamtbetrag|gesamt|montant\s+total|importe\s+total|合计|总计)\b/i;

/** A "total" that counts pieces, not money. */
const QUANTITY_TOTAL = /\b(quantity|qty|pcs?|pieces?|ctns?|cartons?|units?|sets?|packages?|gross\s+weight|net\s+weight|volume|cbm|kgs?)\b/i;

const UNIT_WORD = /\b(pcs?|pieces?|units?|sets?|ctns?|cartons?|kgs?|pairs?|rolls?|boxes|box|mtrs?|meters?)\b/i;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Parse a date in any of the usual orders. `ambiguous` marks dd/mm vs mm/dd. */
export function parseLooseDate(text: string): { iso: string; ambiguous: boolean } | null {
  const yearOf = (y: string) => (y.length <= 2 ? 2000 + Number(y) : Number(y));
  const build = (y: number, m: number, d: number, ambiguous: boolean) =>
    m >= 1 && m <= 12 && d >= 1 && d <= 31
      ? { iso: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, ambiguous }
      : null;

  let m = /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/.exec(text);
  if (m) return build(Number(m[1]), Number(m[2]), Number(m[3]), false);

  m = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/.exec(text);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const year = yearOf(m[3]);
    // >12 settles it; otherwise read day-first (the convention everywhere Cobra
    // buys except the US) and flag it.
    if (a > 12) return build(year, b, a, false);
    if (b > 12) return build(year, a, b, false);
    return build(year, b, a, true);
  }

  m = /\b(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s,]+(\d{2,4})\b/.exec(text);
  if (m) {
    const month = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
    return month ? build(yearOf(m[3]), month, Number(m[1]), false) : null;
  }

  m = /\b([A-Za-z]{3,9})[-\s]+(\d{1,2})[-\s,]+(\d{2,4})\b/.exec(text);
  if (m) {
    const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1;
    return month ? build(yearOf(m[3]), month, Number(m[2]), false) : null;
  }
  return null;
}

function guessDocNumber(lines: string[]): string | null {
  let best: { value: string; score: number } | null = null;
  lines.slice(0, 60).forEach((line, index) => {
    for (const pattern of DOC_NUMBER_PATTERNS) {
      pattern.lastIndex = 0;
      for (const match of line.matchAll(pattern)) {
        const value = match[1]?.replace(/^[.:#-]+|[.:#-]+$/g, "") ?? "";
        if (value.length < 4 || !/\d/.test(value)) continue;
        if (/^(?:19|20)\d{2}$/.test(value)) continue;                 // a bare year
        if (/^[\d./-]+$/.test(value) && parseLooseDate(value)) continue; // that's the date field
        const label = line.slice(0, match.index ?? 0).toLowerCase();
        let score = 10 - index * 0.1;
        if (/proforma|invoice|fattura|rechnung|factura/.test(label)) score += 5;
        if (/order|contract|ordine|pedido|commande|auftrag/.test(label)) score += 3;
        if (!best || score > best.score) best = { value, score };
      }
    }
  });
  return best?.value ?? null;
}

function guessCurrency(lines: string[]): string | null {
  const counts = new Map<string, number>();
  for (const line of lines) {
    for (const match of line.matchAll(CURRENCY_CODE)) {
      const code = CURRENCY_ALIAS[match[1].toUpperCase()] ?? match[1].toUpperCase();
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    for (const match of line.matchAll(CURRENCY_SYMBOL)) {
      const code = SYMBOL_TO_CODE[match[0]];
      if (code) counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  for (const [code, n] of counts) if (!best || n > (counts.get(best) ?? 0)) best = code;
  return best;
}

/** Money totals stated in the document, most specific label first. */
const TOTAL_PRIORITY = ["grand total", "total amount", "amount due", "total due", "total value", "net total", "total"];

function guessGrandTotal(lines: string[]): number | null {
  const found: { label: string; value: number }[] = [];
  for (const line of lines) {
    const label = TOTAL_LABEL.exec(line);
    if (!label) continue;
    if (QUANTITY_TOTAL.test(line)) continue;                    // "Total quantity: 2000 PCS"
    const values = rowNumbers(line).flatMap(n => n.values);
    if (values.length) found.push({ label: label[1].toLowerCase().replace(/\s+/g, " "), value: Math.max(...values) });
  }
  for (const wanted of TOTAL_PRIORITY) {
    const hits = found.filter(f => f.label === wanted);
    if (hits.length) return Math.max(...hits.map(h => h.value));
  }
  return found.length ? Math.max(...found.map(f => f.value)) : null;
}

const ITEM_CODE = /[A-Za-z0-9][A-Za-z0-9\-_/.]{2,24}/g;

function guessItemCode(line: string): string | null {
  for (const token of line.slice(0, 60).match(ITEM_CODE) ?? []) {
    if (/^\d{1,3}$/.test(token)) continue;                      // row index
    if (/\d/.test(token) && /[A-Za-z\-_/.]/.test(token)) return token;
  }
  return null;
}

// ─── Document ────────────────────────────────────────────────────────────────

/** Group positioned PDF tokens into visual lines, left to right. */
export function tokensToLines(tokens: PdfTextLine[], tolerance = 3): string[] {
  const rows = new Map<number, PdfTextLine[]>();
  for (const token of tokens) {
    const key = [...rows.keys()].find(y => Math.abs(y - token.y) <= tolerance);
    const bucket = key === undefined ? [] : rows.get(key)!;
    if (key === undefined) rows.set(token.y, bucket);
    bucket.push(token);
  }
  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])                                // top of the page first
    .map(([, bucket]) =>
      bucket.sort((a, b) => a.x0 - b.x0).map(t => t.norm).join(" ").replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);
}

/**
 * Read a foreign purchase document from its text lines. Pure, so it is testable
 * without pdfjs — `parseForeignPdf` does the PDF work and calls this.
 */
export function parseForeignDocLines(lines: string[], fileName: string): ParsedOrderDoc {
  const doc = emptyParsedDoc("foreign-doc", fileName);
  const clean = lines.map(l => l.replace(/\u00a0/g, " ").trim()).filter(l => l && !/^[\s\-_=*.·•]+$/.test(l));

  doc.piNumber = guessDocNumber(clean);
  doc.currency = guessCurrency(clean);

  // Dates: the document's own date is the order date; a delivery/shipment date
  // becomes the ETA.
  let ambiguousDate = false;
  for (const line of clean.slice(0, 80)) {
    for (const match of line.matchAll(DATE_LABEL)) {
      const parsed = parseLooseDate(match[2] ?? "");
      if (!parsed) continue;
      ambiguousDate ||= parsed.ambiguous;
      if (DELIVERY_LABEL.test(match[1])) {
        doc.deliveryDate ??= parsed.iso;
      } else {
        doc.orderDate ??= parsed.iso;
      }
    }
  }

  const incoterm = clean.map(l => INCOTERM.exec(l)).find(Boolean);
  const paymentLine = clean.find(l => PAYMENT_TERMS.test(l));
  if (paymentLine) doc.paymentTerms = paymentLine.trim();

  // Line items: any row whose numbers reconcile as qty x price = amount.
  for (const line of clean) {
    if (TOTAL_LABEL.test(line) && !UNIT_WORD.test(line)) continue;   // a totals row
    const best = reconcileRow(rowNumbers(line));
    if (!best) continue;

    // The description is the line with the three numbers and the row index removed.
    let description = line;
    for (const span of [...best.spans].sort((a, b) => b.start - a.start)) {
      description = `${description.slice(0, span.start)} ${description.slice(span.end)}`;
    }
    description = description.replace(/^\s*\d{1,3}[).\s]\s*/, "").replace(/\s{2,}/g, " ").trim().replace(/^[|\t\-·]+|[|\t\-·]+$/g, "").trim();

    const item: ParsedOrderItem = {
      code: guessItemCode(line),
      description: description || null,
      qty: best.qty,
      unitPrice: best.unitPrice,
      lineTotal: best.lineTotal,
      currency: doc.currency,
      deliveryDate: null,
    };
    doc.items.push(item);
  }

  doc.subtotal = doc.items.reduce((sum, i) => sum + (i.lineTotal ?? 0), 0) || null;
  doc.total = guessGrandTotal(clean);

  const notes = [
    incoterm ? `תנאי מסירה: ${incoterm[1]}${incoterm[2] ? ` ${incoterm[2].trim()}` : ""}` : null,
    doc.currency ? `מטבע: ${doc.currency}` : null,
  ].filter(Boolean).join(" · ");
  if (notes) doc.notes = notes;

  if (!doc.items.length) {
    doc.warnings.push(
      "לא זוהו שורות פריטים במסמך — אף שורה לא הסתדרה כ'כמות × מחיר = סכום'. " +
      "אפשר למלא ידנית, או לשלוח את הקובץ בצ'אט ואקרא אותו לעומק");
  }
  if (!doc.currency) doc.warnings.push("לא זוהה מטבע במסמך — ודא אותו לפני יצירת ההזמנה");
  if (!doc.piNumber) doc.warnings.push("לא זוהה מספר מסמך (PI / Invoice No.) — כדאי להשלים אותו ידנית");
  if (ambiguousDate) doc.warnings.push("תאריך במסמך דו-משמעי (dd/mm מול mm/dd) — נקרא כיום-קודם, ודא אותו");
  if (doc.total != null && doc.subtotal != null && doc.total > 0
      && Math.abs(doc.total - doc.subtotal) / doc.total > 0.02) {
    doc.warnings.push(
      `סכום השורות (${doc.subtotal.toFixed(2)}) לא תואם לסה"כ שבמסמך (${doc.total.toFixed(2)}) — ` +
      "ייתכן ששורה חסרה, או שיש שורת הובלה/הנחה שאינה פריט");
  }
  return doc;
}

export async function parseForeignPdf(file: File): Promise<ParsedOrderDoc> {
  const tokens = await extractPdfTextLines(await file.arrayBuffer());
  if (!tokens.length) {
    const doc = emptyParsedDoc("foreign-doc", file.name);
    doc.warnings.push(SCANNED_PDF_MESSAGE);
    return doc;
  }
  return parseForeignDocLines(tokensToLines(tokens), file.name);
}

/** Shown for a PDF with no text layer, and for an image the browser cannot read. */
export const SCANNED_PDF_MESSAGE =
  "אין טקסט בקובץ — זו כנראה סריקה או צילום. הדפדפן לא יכול לקרוא אותה. " +
  "שלח לי את הקובץ בצ'אט ואקרא אותו ויזואלית, או מלא את ההזמנה ידנית וצרף את הקובץ.";
