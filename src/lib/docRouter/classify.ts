/**
 * Work out what a dropped document is, so the dashboard inbox can file it
 * without being told.
 *
 * Three families of paperwork reach the procurement desk, and each already has
 * its own reader and its own destination in the app:
 *
 *   SWIFT      bank confirmation of a transfer → marks an installment paid
 *   NEW_ORDER  SAP purchase order, supplier PI / order confirmation / quotation
 *              → becomes (or is attached to) an order
 *   SHIPPING   B/L, packing list, customs declaration, freight / terminal /
 *              forwarder invoices → joins the import dossier of an order
 *
 * Classification is scored, not first-match: a packing list prints "PI No." and
 * a PI prints "packing"; only the document's own title and a family's tell-tale
 * fields decide. When nothing scores clearly the answer is UNKNOWN and the
 * person picks — a wrong confident guess is worse than asking.
 */
import { guessSubtype, type ImportDocSubtype } from "@/lib/importFiles";

export type DocKind = "SWIFT" | "NEW_ORDER" | "SHIPPING" | "UNKNOWN";
export type Confidence = "high" | "medium" | "low";

export interface Classification {
  kind: DocKind;
  /** Dossier document kind — set when `kind` is SHIPPING. */
  subtype: ImportDocSubtype | null;
  confidence: Confidence;
  /** Human-readable evidence, shown so a person can judge the guess. */
  reasons: string[];
}

interface Rule {
  kind: Exclude<DocKind, "UNKNOWN">;
  subtype?: ImportDocSubtype;
  pattern: RegExp;
  /** Only the file name and the top of the document — where a title lives. */
  titleOnly?: boolean;
  /** Only the file name. */
  nameOnly?: boolean;
  weight: number;
  reason: string;
}

/** How much of a document counts as its "head" for title rules. */
const HEAD_CHARS = 900;

const RULES: Rule[] = [
  // ── SWIFT ──────────────────────────────────────────────────────────────
  { kind: "SWIFT", pattern: /:(?:20|32A|59|71A):/, weight: 10, reason: "שדות הודעת MT103" },
  { kind: "SWIFT", pattern: /\bMT[\s-]?103\b/i, weight: 8, reason: "MT103" },
  { kind: "SWIFT", pattern: /swift/i, nameOnly: true, weight: 7, reason: "שם הקובץ מכיל SWIFT" },
  { kind: "SWIFT", pattern: /mt103|העברה|מטח|מט["']ח/i, nameOnly: true, weight: 6, reason: "שם הקובץ מציין העברה" },
  { kind: "SWIFT", pattern: /\bswift\b/i, weight: 3, reason: "המסמך מזכיר SWIFT" },
  { kind: "SWIFT", pattern: /beneficiary|ordering[\s_-]*customer|remittance[\s_-]*information|details[\s_-]*of[\s_-]*charges|value[\s_-]*date/i, weight: 4, reason: "שדות העברה בנקאית (Beneficiary / Value date)" },
  { kind: "SWIFT", pattern: /תאריך[\s_-]*ערך|העברת?[\s_-]*מט["']?ח|אישור[\s_-]*ביצוע[\s_-]*העברה|פרטי[\s_-]*המוטב|העברה[\s_-]*בנקאית/, weight: 6, reason: "אישור העברה בנקאית" },

  // ── SHIPPING / import dossier ──────────────────────────────────────────
  { kind: "SHIPPING", subtype: "BL", pattern: /bill[\s_-]*of[\s_-]*lading|air[\s_-]*waybill|house[\s_-]*b[\s_-]*\/?[\s_-]*l|\bHAWB\b|\bHBL\b|\bMBL\b|שטר[\s_-]*מטען/i, titleOnly: true, weight: 9, reason: "שטר מטען (B/L / AWB)" },
  { kind: "SHIPPING", subtype: "PACKING_LIST", pattern: /packing[\s_-]*list|רשימת[\s_-]*אריזה/i, titleOnly: true, weight: 9, reason: "רשימת אריזה" },
  { kind: "SHIPPING", subtype: "DECLARATION", pattern: /רשימון|customs[\s_-]*declaration|import[\s_-]*declaration|הצהרת[\s_-]*יבוא/i, titleOnly: true, weight: 9, reason: "רשימון יבוא / הצהרת מכס" },
  { kind: "SHIPPING", subtype: "COMMERCIAL_INVOICE", pattern: /commercial[\s_-]*invoice|חשבונית[\s_-]*מסחרית/i, titleOnly: true, weight: 8, reason: "חשבונית מסחרית" },
  { kind: "SHIPPING", subtype: "FREIGHT_INVOICE", pattern: /freight[\s_-]*(?:tax[\s_-]*)?invoice|חשבונית[\s_-]*הובלה/i, titleOnly: true, weight: 8, reason: "חשבונית הובלה" },
  { kind: "SHIPPING", subtype: "TERMINAL_INVOICE", pattern: /terminal|מסוף|masof|port[\s_-]*charges/i, titleOnly: true, weight: 6, reason: "חשבונית מסוף" },
  { kind: "SHIPPING", subtype: "INSURANCE", pattern: /insurance[\s_-]*(?:certificate|policy)|תעודת[\s_-]*ביטוח|פוליסת[\s_-]*ביטוח/i, titleOnly: true, weight: 8, reason: "ביטוח מטען" },
  { kind: "SHIPPING", subtype: "CERTIFICATE_OF_ORIGIN", pattern: /certificate[\s_-]*of[\s_-]*origin|תעודת[\s_-]*מקור/i, titleOnly: true, weight: 8, reason: "תעודת מקור" },
  { kind: "SHIPPING", pattern: /container[\s_-]*(?:no|number|#)|vessel|voyage|port[\s_-]*of[\s_-]*(?:loading|discharge)/i, weight: 2, reason: "פרטי משלוח (מכולה / אונייה / נמל)" },

  // ── NEW ORDER ──────────────────────────────────────────────────────────
  { kind: "NEW_ORDER", pattern: /proforma|פרופורמה|\bP\.?\s?I\.?[\s_-]*(?:no|#|number)\b/i, titleOnly: true, weight: 9, reason: "Proforma Invoice (PI)" },
  { kind: "NEW_ORDER", pattern: /purchase[\s_-]*order|הזמנת[\s_-]*רכש/i, titleOnly: true, weight: 9, reason: "הזמנת רכש" },
  { kind: "NEW_ORDER", pattern: /order[\s_-]*confirmation|sales[\s_-]*(?:contract|confirmation)|quotation|price[\s_-]*quote|הצעת[\s_-]*מחיר|אישור[\s_-]*הזמנה/i, titleOnly: true, weight: 8, reason: "אישור הזמנה / חוזה מכירה / הצעת מחיר" },
  { kind: "NEW_ORDER", pattern: /proforma|(?:^|[^a-z0-9])pi[_\s-]?\w|purchase[\s_-]*order|(?:^|[^a-z0-9])po[_\s-]?\d|הזמנת|הזמנה/i, nameOnly: true, weight: 6, reason: "שם הקובץ מציין הזמנה / PI" },
  { kind: "NEW_ORDER", pattern: /מספר[\s_-]*ע\.?[\s_-]*מ|קוד[\s_-]*פריט|מק["']ט[\s_-]*יצרן/, weight: 2, reason: "מבנה הזמנת SAP" },
];

const CONFIDENCE_BAR = { high: { score: 9, margin: 4 }, medium: { score: 6, margin: 2 } };

/** Minimum winning score — below this the document is not recognised. */
const MIN_SCORE = 5;

export interface ClassifyInput {
  fileName: string;
  /** Extracted text; empty for scans and photos. */
  text: string;
}

export function classifyDocument({ fileName, text }: ClassifyInput): Classification {
  const head = text.slice(0, HEAD_CHARS);
  const titleHaystack = `${fileName}\n${head}`;
  const fullHaystack = `${fileName}\n${text}`;

  const scores: Record<Exclude<DocKind, "UNKNOWN">, number> = { SWIFT: 0, SHIPPING: 0, NEW_ORDER: 0 };
  const reasons: Record<Exclude<DocKind, "UNKNOWN">, string[]> = { SWIFT: [], SHIPPING: [], NEW_ORDER: [] };
  const subtypeScores = new Map<ImportDocSubtype, number>();

  for (const rule of RULES) {
    const haystack = rule.nameOnly ? fileName : rule.titleOnly ? titleHaystack : fullHaystack;
    if (!rule.pattern.test(haystack)) continue;
    scores[rule.kind] += rule.weight;
    reasons[rule.kind].push(rule.reason);
    if (rule.subtype) subtypeScores.set(rule.subtype, (subtypeScores.get(rule.subtype) ?? 0) + rule.weight);
  }

  // The dossier vocabulary already knows forwarders' file-name habits
  // ("Inv_197112.pdf", "HAWB_460509.pdf"). Use it as a weak shipping signal.
  const nameSubtype = guessSubtype(fileName);
  if (nameSubtype !== "OTHER") {
    // A bare "invoice" is as likely a supplier's as a forwarder's — weaker.
    const weight = nameSubtype === "FORWARDER_INVOICE" ? 3 : 6;
    scores.SHIPPING += weight;
    reasons.SHIPPING.push("שם הקובץ מתאים למסמכי תיק יבוא");
    subtypeScores.set(nameSubtype, (subtypeScores.get(nameSubtype) ?? 0) + weight);
  }

  const ranked = (Object.keys(scores) as (keyof typeof scores)[]).sort((a, b) => scores[b] - scores[a]);
  const top = ranked[0];
  const margin = scores[top] - scores[ranked[1]];

  if (scores[top] < MIN_SCORE || margin <= 0) {
    return { kind: "UNKNOWN", subtype: null, confidence: "low", reasons: [] };
  }

  let subtype: ImportDocSubtype | null = null;
  if (top === "SHIPPING") {
    subtype = [...subtypeScores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "OTHER";
  }

  const confidence: Confidence =
    scores[top] >= CONFIDENCE_BAR.high.score && margin >= CONFIDENCE_BAR.high.margin ? "high"
      : scores[top] >= CONFIDENCE_BAR.medium.score && margin >= CONFIDENCE_BAR.medium.margin ? "medium"
        : "low";

  return { kind: top, subtype, confidence, reasons: reasons[top] };
}

export const docKindLabels: Record<DocKind, string> = {
  SWIFT: "אישור SWIFT",
  NEW_ORDER: "הזמנה חדשה",
  SHIPPING: "מסמך משלוח",
  UNKNOWN: "לא מזוהה",
};
