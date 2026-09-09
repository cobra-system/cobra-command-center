/**
 * Goods-receipt mail (מייל קליטת סחורה) — the shape the client collects and the
 * defaults it fills in. The mail body itself is rendered server-side by
 * supabase/functions/_shared/goodsReceiptEmail.ts; the dialog only previews it,
 * so the column order here must stay in step with that file.
 */

export interface GoodsReceiptLine {
  /** Client-side row key — not sent to the function. */
  key: string;
  supplier_code: string;
  supplier_name: string;
  product_code: string;
  product_name: string;
  qty: string;
  receipt_date: string;
  warehouse: string;
  received_by: string;
}

export type GoodsReceiptField = Exclude<keyof GoodsReceiptLine, "key">;

export const GOODS_RECEIPT_COLUMNS: { field: GoodsReceiptField; label: string; width: string }[] = [
  { field: "supplier_code", label: "קוד ספק", width: "7rem" },
  { field: "supplier_name", label: "שם ספק", width: "12rem" },
  { field: "product_code", label: "קוד מוצר", width: "8rem" },
  { field: "product_name", label: "שם מוצר", width: "12rem" },
  { field: "qty", label: "כמות", width: "6rem" },
  { field: "receipt_date", label: "תאריך קבלה", width: "9rem" },
  { field: "warehouse", label: "לאן לקלוט", width: "9rem" },
  { field: "received_by", label: "מי קיבל", width: "8rem" },
];

/** dd/MM/yyyy — the format the receiving clerk reads in the mail. */
export const formatReceiptDate = (date: Date): string =>
  `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;

/** "מחסן 011" when the centre has a SAP code, otherwise its name. */
export const warehouseLabel = (center: { name: string; sap_code?: string | null }): string =>
  center.sap_code ? `מחסן ${center.sap_code}` : center.name;

export const buildGoodsReceiptSubject = (lines: GoodsReceiptLine[]): string => {
  const codes = [...new Set(lines.map(l => (l.product_code || l.product_name).trim()).filter(Boolean))];
  return codes.length > 0 ? `הגעת סחורה - ${codes.join(", ")}` : "הגעת סחורה";
};

/** Document kinds worth attaching by default — the invoice the clerk books against. */
const INVOICE_SUBTYPES = ["INVOICE", "COMMERCIAL_INVOICE", "PI"];
const INVOICE_NAME_HINTS = ["invoice", "חשבונית", "pi "];

export function isLikelyInvoice(doc: { type?: string | null; document_subtype?: string | null; document_name?: string | null }): boolean {
  if (doc.document_subtype && INVOICE_SUBTYPES.includes(doc.document_subtype)) return true;
  if (doc.type === "PI") return true;
  const name = (doc.document_name ?? "").toLowerCase();
  return INVOICE_NAME_HINTS.some(hint => name.includes(hint.trim()));
}
