/**
 * Order file import — turn a purchase order exported from SAP (PDF) or an order
 * file from a foreign supplier (PDF / Excel / CSV) into a draft order the user
 * can review and create from the app itself.
 */
import { emptyParsedDoc, type ParsedOrderDoc } from "./types";
import { parseSapPoPdf } from "./sapPdf";
import { parseOrderSpreadsheet } from "./spreadsheet";
import { parseForeignPdf, SCANNED_PDF_MESSAGE } from "./foreignDoc";

export * from "./types";
export * from "./match";
export { parseSapPoLines, parseSapPoPdf } from "./sapPdf";
export { parseOrderRows, parseOrderSpreadsheet, findHeaderRow } from "./spreadsheet";
export {
  parseForeignDocLines, parseForeignPdf, reconcileRow, rowNumbers, numberVariants,
  parseLooseDate, tokensToLines, SCANNED_PDF_MESSAGE,
} from "./foreignDoc";

/** File extensions the import dialog accepts. */
export const IMPORT_ACCEPT = ".pdf,.xlsx,.xls,.xlsm,.csv,.tsv,.txt,.png,.jpg,.jpeg,.webp,.heic";

/** Images can be attached to an order but not parsed in the browser. */
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".heic", ".tif", ".tiff", ".bmp"];

const extensionOf = (name: string) => name.slice(name.lastIndexOf(".")).toLowerCase();

/**
 * A PDF is either the Israeli SAP export or a foreign supplier's own document,
 * and the file itself does not say which. The SAP reader is tried first because
 * it is exact where it applies; when it comes back empty the document is not that
 * template, so the template-free foreign reader takes over. Whichever produced
 * line items wins, and the SAP warnings are dropped in that case — they describe
 * a template this document was never in.
 */
async function parsePdf(file: File): Promise<ParsedOrderDoc> {
  const sap = await parseSapPoPdf(file);
  if (sap.items.length && sap.poNumber) return sap;

  const foreign = await parseForeignPdf(file);
  if (foreign.items.length) return foreign;
  if (sap.items.length) return sap;

  // Neither reader found items. Report the foreign reader's diagnosis, which is
  // the more useful one for a document that is not a SAP export.
  return foreign;
}

export async function parseOrderFile(file: File): Promise<ParsedOrderDoc> {
  const ext = extensionOf(file.name);
  try {
    if (ext === ".pdf") return await parsePdf(file);
    if ([".xlsx", ".xls", ".xlsm", ".csv", ".tsv", ".txt"].includes(ext)) {
      return await parseOrderSpreadsheet(file);
    }
    if (IMAGE_EXTENSIONS.includes(ext)) {
      const doc = emptyParsedDoc("foreign-doc", file.name);
      doc.warnings.push(SCANNED_PDF_MESSAGE);
      return doc;
    }
  } catch (err) {
    const doc = emptyParsedDoc(ext === ".pdf" ? "sap-pdf" : "spreadsheet", file.name);
    doc.warnings.push(`שגיאה בקריאת הקובץ: ${err instanceof Error ? err.message : "לא ניתן לנתח את הקובץ"}`);
    return doc;
  }
  const doc = emptyParsedDoc("spreadsheet", file.name);
  doc.warnings.push(`סוג קובץ לא נתמך (${ext}). נתמכים: PDF (SAP או מסמך מספק בחו"ל), Excel, CSV`);
  return doc;
}
