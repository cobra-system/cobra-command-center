/**
 * Read a SWIFT payment confirmation into structured fields.
 *
 * A SWIFT confirmation is the easy end of document parsing: unlike a supplier's
 * proforma invoice, it is a bank document with a fixed shape. Two shapes cover
 * what banks hand out:
 *
 *   1. The MT103 message itself — numbered field tags (:20:, :32A:, :59: …)
 *      defined by the SWIFT standard, identical at every bank on earth.
 *   2. The bank's own printable confirmation — the same facts under Hebrew or
 *      English labels ("סכום", "תאריך ערך", "Beneficiary", "Our reference").
 *
 * Both are read here. The MT103 tags are tried first because they are exact;
 * labels are the fallback, and whatever is missing is reported in `warnings`
 * rather than guessed, because these numbers settle what the supplier was paid.
 */
import { numberVariants, parseLooseDate, tokensToLines } from "@/lib/orderImport/foreignDoc";
import { extractPdfTextLines } from "@/lib/orderImport/sapPdf";

export interface ParsedSwift {
  /** Sender's transaction reference (:20:) — the bank's own reference for the transfer. */
  reference: string | null;
  amount: number | null;
  currency: string | null;
  /** Value date, ISO (YYYY-MM-DD) — the day the money left, i.e. the payment date. */
  valueDate: string | null;
  /** Beneficiary — the supplier being paid (:59:). */
  beneficiary: string | null;
  /** Beneficiary's bank / BIC (:57:). */
  beneficiaryBank: string | null;
  /** Ordering customer — us (:50K:). */
  ordering: string | null;
  /** Remittance information (:70:) — usually carries the PI or invoice number. */
  remittanceInfo: string | null;
  /** Charge bearer (:71A:) — OUR / SHA / BEN. */
  charges: string | null;
  /** Document number quoted in the remittance info, when there is one. */
  referencedDocument: string | null;
  fileName: string;
  /** True when the MT103 tag structure was found (rather than label matching). */
  isMt103: boolean;
  warnings: string[];
}

const empty = (fileName: string): ParsedSwift => ({
  reference: null, amount: null, currency: null, valueDate: null,
  beneficiary: null, beneficiaryBank: null, ordering: null,
  remittanceInfo: null, charges: null, referencedDocument: null,
  fileName, isMt103: false, warnings: [],
});

const CURRENCIES = "USD|EUR|GBP|CNY|JPY|ILS|CHF|TRY|INR|PLN|SEK|AUD|CAD|HKD|SGD";

/** Hebrew and English names banks print instead of the ISO code. */
const CURRENCY_WORDS: [RegExp, string][] = [
  [/דולר|dollar/i, "USD"],
  [/אירו|יורו|euro/i, "EUR"],
  [/ש["']?ח|שקל|shekel/i, "ILS"],
  [/לירה שטרלינג|sterling|pound/i, "GBP"],
  [/יואן|yuan|renminbi/i, "CNY"],
];

const SYMBOL_CURRENCY: Record<string, string> = { $: "USD", "€": "EUR", "₪": "ILS", "£": "GBP" };

// ─── MT103 ───────────────────────────────────────────────────────────────────

/** `:32A:260315USD70000,00` — value date, currency and amount in one field. */
const TAG_32A = /:32A:\s*(\d{6})\s*([A-Z]{3})\s*([\d.,]+)/i;
/** `:33B:USD70000,00` — instructed amount, used when :32A: is absent. */
const TAG_33B = /:33B:\s*([A-Z]{3})\s*([\d.,]+)/i;

const tagValue = (text: string, tag: string): string | null => {
  // A field runs to the next ":NN…:" tag, the end of the message block ("-}"),
  // or the end of the text — the last field must not swallow the trailer.
  const re = new RegExp(`:${tag}:\\s*([\\s\\S]*?)(?=\\n\\s*:\\d{2}[A-Z]?:|\\n?\\s*-?\\}|$)`, "i");
  const m = re.exec(text);
  if (!m) return null;
  const value = m[1]
    .split("\n")
    .map(l => l.replace(/-?\}\s*$/, "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
  return value || null;
};

/** `260315` → 2026-03-15. SWIFT dates are always YYMMDD. */
export function mt103Date(yymmdd: string): string | null {
  const m = /^(\d{2})(\d{2})(\d{2})$/.exec(yymmdd);
  if (!m) return null;
  const [, yy, mm, dd] = m;
  const month = Number(mm);
  const day = Number(dd);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `20${yy}-${mm}-${dd}`;
}

/** SWIFT writes amounts with a comma for the decimal point: 70000,00 → 70000. */
export function swiftAmount(raw: string): number | null {
  const [value] = numberVariants(raw.replace(/\s/g, ""));
  return value ?? null;
}

/** Strip the leading /account-number line banks put before a party's name. */
const partyName = (value: string | null): string | null => {
  if (!value) return null;
  const cleaned = value.replace(/^\/[A-Z0-9]+\s*/i, "").trim();
  return cleaned || null;
};

function parseMt103(text: string, doc: ParsedSwift): boolean {
  const m32 = TAG_32A.exec(text);
  const m33 = TAG_33B.exec(text);
  if (!m32 && !m33 && !/:20:/i.test(text)) return false;

  doc.isMt103 = true;
  if (m32) {
    doc.valueDate = mt103Date(m32[1]);
    doc.currency = m32[2].toUpperCase();
    doc.amount = swiftAmount(m32[3]);
  } else if (m33) {
    doc.currency = m33[1].toUpperCase();
    doc.amount = swiftAmount(m33[2]);
  }
  doc.reference = tagValue(text, "20");
  doc.ordering = partyName(tagValue(text, "50K") ?? tagValue(text, "50F") ?? tagValue(text, "50A"));
  doc.beneficiary = partyName(tagValue(text, "59") ?? tagValue(text, "59A") ?? tagValue(text, "59F"));
  doc.beneficiaryBank = tagValue(text, "57A") ?? tagValue(text, "57D") ?? tagValue(text, "57");
  doc.remittanceInfo = tagValue(text, "70");
  doc.charges = tagValue(text, "71A");
  return true;
}

// ─── Bank confirmation with labels ───────────────────────────────────────────

const LABELS = {
  amount: /(?:^|\s)(סכום ההעברה|סכום החיוב|סכום|amount|transfer amount|payment amount)\s*[:：]?\s*(.{0,40})/i,
  valueDate: /(?:^|\s)(תאריך ערך|תאריך ביצוע|תאריך העברה|value date|execution date|payment date|date)\s*[:：]?\s*(.{0,30})/i,
  reference: /(?:^|\s)(אסמכתא|מספר אסמכתא|מספר העברה|מס['׳] העברה|reference|our ref(?:erence)?|transaction ref(?:erence)?|trn|uetr)\s*[:：]?\s*([A-Za-z0-9\-/_.]{4,40})/i,
  beneficiary: /(?:^|\s)(מוטב|שם המוטב|לטובת|beneficiary(?:\s+name)?|pay(?:ee)?\s+to)\s*[:：]?\s*(.{2,60})/i,
  beneficiaryBank: /(?:^|\s)(בנק המוטב|בנק מוטב|beneficiary bank|receiving bank)\s*[:：]?\s*(.{2,60})/i,
  charges: /(?:^|\s)(עמלה|עמלות|charges?|charge bearer)\s*[:：]?\s*(.{0,30})/i,
} as const;

const BIC = /\b([A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)\b/;

function labelled(lines: string[], pattern: RegExp): string | null {
  for (const line of lines) {
    const m = pattern.exec(line);
    if (m && m[2]?.trim()) return m[2].trim();
  }
  return null;
}

function findCurrency(lines: string[]): string | null {
  const text = lines.join("\n");
  const iso = new RegExp(`\\b(${CURRENCIES})\\b`).exec(text);
  if (iso) return iso[1].toUpperCase();
  for (const [pattern, code] of CURRENCY_WORDS) if (pattern.test(text)) return code;
  for (const [symbol, code] of Object.entries(SYMBOL_CURRENCY)) if (text.includes(symbol)) return code;
  return null;
}

function parseLabelled(lines: string[], doc: ParsedSwift): void {
  const amountText = labelled(lines, LABELS.amount);
  if (amountText) {
    const token = /[\d][\d.,]*/.exec(amountText);
    if (token) doc.amount = swiftAmount(token[0]);
    const inline = new RegExp(`\\b(${CURRENCIES})\\b`).exec(amountText);
    if (inline) doc.currency = inline[1].toUpperCase();
  }
  doc.currency ??= findCurrency(lines);

  const dateText = labelled(lines, LABELS.valueDate);
  if (dateText) doc.valueDate = parseLooseDate(dateText)?.iso ?? null;

  doc.reference ??= labelled(lines, LABELS.reference);
  doc.beneficiary ??= labelled(lines, LABELS.beneficiary);
  doc.beneficiaryBank ??= labelled(lines, LABELS.beneficiaryBank);
  doc.charges ??= labelled(lines, LABELS.charges);

  if (!doc.beneficiaryBank) {
    const bic = BIC.exec(lines.join(" "));
    if (bic) doc.beneficiaryBank = bic[1];
  }
}

// ─── Document number referenced by the transfer ──────────────────────────────

/**
 * The PI / invoice number the transfer pays, quoted in the remittance line.
 * This is what ties a SWIFT to an order without the user typing anything.
 */
export function documentReference(...texts: (string | null)[]): string | null {
  const haystack = texts.filter(Boolean).join(" ");
  const patterns = [
    /\b(?:p\s*\/?\s*i|proforma(?:\s+invoice)?|invoice|inv|contract|order|p\s*\/?\s*o)\s*(?:no\.?|number|#)?\s*[:.#]?\s*([A-Za-z0-9][A-Za-z0-9\-/_.]{3,29})/i,
    /\b([A-Za-z]{2,6}-[A-Za-z0-9\-/_.]{3,24})\b/,
  ];
  for (const pattern of patterns) {
    const m = pattern.exec(haystack);
    if (m) return m[1].replace(/[.,;]+$/, "");
  }
  return null;
}

// ─── Entry points ────────────────────────────────────────────────────────────

/** Parse a SWIFT confirmation from its text lines. Pure — testable without pdfjs. */
export function parseSwiftText(lines: string[], fileName = "swift"): ParsedSwift {
  const doc = empty(fileName);
  const clean = lines.map(l => l.replace(/\u00a0/g, " ").trim()).filter(Boolean);
  const text = clean.join("\n");

  if (!parseMt103(text, doc)) parseLabelled(clean, doc);
  // An MT103 pasted into a bank's cover page can still be missing tags — fill
  // whatever the labels can add without overwriting an exact tag value.
  if (doc.isMt103 && (!doc.amount || !doc.valueDate)) parseLabelled(clean, doc);

  doc.referencedDocument = documentReference(doc.remittanceInfo, text);

  if (doc.amount == null) doc.warnings.push("לא זוהה סכום בהעברה — יש להזין אותו ידנית");
  if (!doc.currency) doc.warnings.push("לא זוהה מטבע בהעברה — ודא אותו לפני שמירה");
  if (!doc.valueDate) doc.warnings.push("לא זוהה תאריך ערך — תאריך התשלום יוגדר להיום");
  if (!doc.reference) doc.warnings.push("לא זוהתה אסמכתא בהעברה");
  return doc;
}

/** Shown when the file carries no text the browser can read. */
export const SWIFT_SCAN_MESSAGE =
  "אין טקסט בקובץ ה-SWIFT — זו כנראה סריקה או צילום מסך. הפרטים לא מולאו אוטומטית; " +
  "אפשר להזין אותם ידנית (הקובץ עצמו נשמר), או לשלוח לי אותו בצ'אט ואקרא אותו.";

/** Parse an uploaded SWIFT file. PDFs are read; images cannot be read in the browser. */
export async function parseSwiftFile(file: File): Promise<ParsedSwift> {
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  try {
    if (ext === ".pdf") {
      const tokens = await extractPdfTextLines(await file.arrayBuffer());
      if (!tokens.length) {
        const doc = empty(file.name);
        doc.warnings.push(SWIFT_SCAN_MESSAGE);
        return doc;
      }
      return parseSwiftText(tokensToLines(tokens), file.name);
    }
    if ([".txt", ".sta", ".mt103", ".csv"].includes(ext)) {
      return parseSwiftText((await file.text()).split("\n"), file.name);
    }
  } catch (err) {
    const doc = empty(file.name);
    doc.warnings.push(`שגיאה בקריאת קובץ ה-SWIFT: ${err instanceof Error ? err.message : "לא ניתן לנתח את הקובץ"}`);
    return doc;
  }
  const doc = empty(file.name);
  doc.warnings.push(SWIFT_SCAN_MESSAGE);
  return doc;
}
