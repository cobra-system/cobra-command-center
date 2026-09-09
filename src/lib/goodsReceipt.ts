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

/**
 * The supplier is a property of the order, not of the line, so it is edited
 * once above the table instead of being repeated in every row — that keeps the
 * dialog narrow enough to read without scrolling sideways. Both values still go
 * into every row of the mail itself.
 */
export const GOODS_RECEIPT_SUPPLIER_FIELDS: { field: GoodsReceiptField; label: string }[] = [
  { field: "supplier_code", label: "קוד ספק" },
  { field: "supplier_name", label: "שם ספק" },
];

/** The per-line columns, sized as percentages so the table never overflows. */
export const GOODS_RECEIPT_ROW_COLUMNS: { field: GoodsReceiptField; label: string; width: string }[] = [
  { field: "product_code", label: "קוד מוצר", width: "14%" },
  { field: "product_name", label: "שם מוצר", width: "26%" },
  { field: "qty", label: "כמות", width: "10%" },
  { field: "receipt_date", label: "תאריך קבלה", width: "16%" },
  { field: "warehouse", label: "לאן לקלוט", width: "17%" },
  { field: "received_by", label: "מי קיבל", width: "13%" },
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
