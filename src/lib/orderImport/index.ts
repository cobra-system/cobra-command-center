/**
 * Order file import — turn a purchase order exported from SAP (PDF) or an order
 * file from a foreign supplier (Excel/CSV) into a draft order the user can review
 * and create from the app itself.
 */
import { emptyParsedDoc, type ParsedOrderDoc } from "./types";
import { parseSapPoPdf } from "./sapPdf";
import { parseOrderSpreadsheet } from "./spreadsheet";

export * from "./types";
export * from "./match";
export { parseSapPoLines, parseSapPoPdf } from "./sapPdf";
export { parseOrderRows, parseOrderSpreadsheet, findHeaderRow } from "./spreadsheet";

/** File extensions the import dialog accepts. */
export const IMPORT_ACCEPT = ".pdf,.xlsx,.xls,.xlsm,.csv";

const extensionOf = (name: string) => name.slice(name.lastIndexOf(".")).toLowerCase();

export async function parseOrderFile(file: File): Promise<ParsedOrderDoc> {
  const ext = extensionOf(file.name);
  try {
    if (ext === ".pdf") return await parseSapPoPdf(file);
    if ([".xlsx", ".xls", ".xlsm", ".csv", ".tsv", ".txt"].includes(ext)) {
      return await parseOrderSpreadsheet(file);
    }
  } catch (err) {
    const doc = emptyParsedDoc(ext === ".pdf" ? "sap-pdf" : "spreadsheet", file.name);
    doc.warnings.push(`שגיאה בקריאת הקובץ: ${err instanceof Error ? err.message : "לא ניתן לנתח את הקובץ"}`);
    return doc;
  }
  const doc = emptyParsedDoc("spreadsheet", file.name);
  doc.warnings.push(`סוג קובץ לא נתמך (${ext}). נתמכים: PDF מ-SAP, Excel, CSV`);
  return doc;
}
