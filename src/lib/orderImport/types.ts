/** Shared shapes for importing an order from a file (SAP PDF / Excel / CSV). */

export type ImportSource = "sap-pdf" | "spreadsheet";

export interface ParsedOrderItem {
  /** Item code as printed in the file — the primary product match key. */
  code?: string | null;
  /** Manufacturer SKU column, when the file has one. */
  mfrSku?: string | null;
  description?: string | null;
  qty?: number | null;
  unitPrice?: number | null;
  lineTotal?: number | null;
  currency?: string | null;
  /** ISO date (YYYY-MM-DD). */
  deliveryDate?: string | null;
}

export interface ParsedOrderDoc {
  source: ImportSource;
  fileName: string;
  /** SAP purchase-order number (הזמנת רכש) — stored on orders.sap_doc_entry. */
  poNumber?: string | null;
  /** PI / invoice number on a foreign order — stored on orders.pi_number. */
  piNumber?: string | null;
  supplierName?: string | null;
  /** 9-digit company/VAT id (מספר ע.מ). */
  supplierVat?: string | null;
  /** Short SAP vendor account number printed on the document. */
  supplierCode?: string | null;
  /** ISO date (YYYY-MM-DD). */
  orderDate?: string | null;
  /** Requested delivery date for the whole document, ISO (YYYY-MM-DD). */
  deliveryDate?: string | null;
  paymentTerms?: string | null;
  agent?: string | null;
  notes?: string | null;
  currency?: string | null;
  subtotal?: number | null;
  vatRate?: number | null;
  vatAmount?: number | null;
  total?: number | null;
  items: ParsedOrderItem[];
  /** Non-fatal problems the user must see before creating the order. */
  warnings: string[];
}

export const emptyParsedDoc = (source: ImportSource, fileName: string): ParsedOrderDoc => ({
  source,
  fileName,
  items: [],
  warnings: [],
});
