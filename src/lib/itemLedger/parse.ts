/**
 * Parser for the ERP item-ledger export (כרטסת פריטים).
 *
 * The export is saved as ".xls" but is really UTF-16LE tab-separated text:
 *
 *   תאריך אסמכתא | מסמך | שורה במסמך | מחסן | קוד ח-ן/כרטיס | שם ח-ן/כרטיס | יחידת מידה | כמות | מחיר | יתרה
 *   ATNJ         |      |            |      |               | <item name>   |            |      |      | 163      ← item header (opening balance)
 *   01/01/26     | תמ 1970922 | 4    | 011  | 20350         | קרסו מוטורס   |            | -1   | 0.00 | 162      ← movement
 *   ...
 *                |      |            |      |               |               |            |      |      | 278      ← item closing row
 *
 * A full export holds many item blocks back to back. Real .xlsx files are read
 * through SheetJS and go through the same row parser.
 */
import * as XLSX from "xlsx";

export interface LedgerMovement {
  movement_date: string; // YYYY-MM-DD
  line_no: number; // order inside the file
  doc_type: string; // תמ / מח / קנ …
  doc_number: string | null;
  doc_line: number | null;
  warehouse_code: string | null;
  account_code: string | null;
  account_name: string | null;
  quantity: number;
  unit_price: number | null;
  balance: number | null;
}

export interface LedgerItem {
  sku: string;
  item_name: string | null;
  opening_balance: number;
  closing_balance: number;
  movements: LedgerMovement[];
}

export interface ParsedLedger {
  items: LedgerItem[];
  period_start: string | null;
  period_end: string | null;
  movement_count: number;
}

const DATE_RE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/;

export function parseLedgerDate(s: string): string | null {
  const m = DATE_RE.exec(s.trim());
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  let y = Number(m[3]);
  if (y < 100) y += 2000;
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "1,001" → 1001, "-6" → -6, "6-" → -6 (trailing minus in Hebrew exports), "" → null */
export function parseLedgerNumber(s: string | undefined): number | null {
  if (s == null) return null;
  let t = s.trim().replace(/,/g, "").replace(/‎|‏/g, "");
  if (!t) return null;
  let neg = false;
  if (t.endsWith("-")) { neg = true; t = t.slice(0, -1); }
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

/** Decode the raw file bytes into a grid of trimmed cell strings. */
export function fileBytesToRows(buf: ArrayBuffer): string[][] {
  const bytes = new Uint8Array(buf);
  const isUtf16le = bytes[0] === 0xff && bytes[1] === 0xfe;
  const isUtf16be = bytes[0] === 0xfe && bytes[1] === 0xff;
  const isUtf8Bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  // OLE (.xls) and ZIP (.xlsx) signatures → real spreadsheet
  const isOle = bytes[0] === 0xd0 && bytes[1] === 0xcf;
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;

  if (!isOle && !isZip) {
    const enc = isUtf16le ? "utf-16le" : isUtf16be ? "utf-16be" : "utf-8";
    let text = new TextDecoder(enc).decode(bytes);
    if (isUtf8Bom || text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    if (text.includes("\t")) return textToRows(text);
  }

  const wb = XLSX.read(bytes, { type: "array", raw: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "" });
  return grid.map(r => r.map(c => String(c ?? "").trim()));
}

export function textToRows(text: string): string[][] {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map(line => line.split("\t").map(c => c.trim()));
}

interface Cols {
  date: number; doc: number; docLine: number; wh: number;
  accCode: number; accName: number; qty: number; price: number; bal: number;
}

const DEFAULT_COLS: Cols = { date: 0, doc: 1, docLine: 2, wh: 3, accCode: 4, accName: 5, qty: 7, price: 8, bal: 9 };

function detectCols(header: string[]): Cols {
  const find = (pred: (h: string) => boolean, fallback: number) => {
    const i = header.findIndex(h => pred(h));
    return i >= 0 ? i : fallback;
  };
  return {
    date: find(h => h.startsWith("תאריך"), DEFAULT_COLS.date),
    doc: find(h => h === "מסמך", DEFAULT_COLS.doc),
    docLine: find(h => h.startsWith("שורה"), DEFAULT_COLS.docLine),
    wh: find(h => h === "מחסן", DEFAULT_COLS.wh),
    accCode: find(h => h.startsWith("קוד"), DEFAULT_COLS.accCode),
    accName: find(h => h.startsWith("שם"), DEFAULT_COLS.accName),
    qty: find(h => h === "כמות", DEFAULT_COLS.qty),
    price: find(h => h.startsWith("מחיר"), DEFAULT_COLS.price),
    bal: find(h => h === "יתרה", DEFAULT_COLS.bal),
  };
}

export function parseLedgerRows(rows: string[][]): ParsedLedger {
  let cols = DEFAULT_COLS;
  const items: LedgerItem[] = [];
  let cur: LedgerItem | null = null;
  let lineNo = 0;
  let minDate: string | null = null;
  let maxDate: string | null = null;
  const closed = new Set<LedgerItem>();

  for (const raw of rows) {
    const r = raw.map(c => (c ?? "").trim());
    if (r.every(c => !c)) continue;
    if (r[0]?.startsWith("תאריך")) { cols = detectCols(r); continue; }

    const date = parseLedgerDate(r[cols.date] ?? "");
    if (date) {
      if (!cur) continue; // movement before any item header — ignore
      const docRaw = (r[cols.doc] ?? "").trim();
      const [docType, ...rest] = docRaw.split(/\s+/);
      const qty = parseLedgerNumber(r[cols.qty]) ?? 0;
      cur.movements.push({
        movement_date: date,
        line_no: ++lineNo,
        doc_type: docType || "?",
        doc_number: rest.join(" ") || null,
        doc_line: parseLedgerNumber(r[cols.docLine]),
        warehouse_code: r[cols.wh] || null,
        account_code: r[cols.accCode] || null,
        account_name: r[cols.accName] || null,
        quantity: qty,
        unit_price: parseLedgerNumber(r[cols.price]),
        balance: parseLedgerNumber(r[cols.bal]),
      });
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
      continue;
    }

    const first = r[cols.date] ?? "";
    const bal = parseLedgerNumber(r[cols.bal]);
    if (first) {
      // item header row: SKU in the first column, name in the account-name column
      cur = {
        sku: first.toUpperCase(),
        item_name: r[cols.accName] || r.slice(1).find(c => c && parseLedgerNumber(c) == null) || null,
        opening_balance: bal ?? 0,
        closing_balance: bal ?? 0,
        movements: [],
      };
      items.push(cur);
    } else if (cur && bal != null) {
      cur.closing_balance = bal; // closing row
      closed.add(cur);
    }
  }

  // An item block without a closing row → fall back to the last running balance
  for (const it of items) {
    if (!closed.has(it)) it.closing_balance = it.opening_balance + it.movements.reduce((s, m) => s + m.quantity, 0);
  }

  return {
    items,
    period_start: minDate,
    period_end: maxDate,
    movement_count: items.reduce((s, i) => s + i.movements.length, 0),
  };
}

export function parseLedgerFile(buf: ArrayBuffer): ParsedLedger {
  return parseLedgerRows(fileBytesToRows(buf));
}
