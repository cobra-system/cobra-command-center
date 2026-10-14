/**
 * The writes behind the dashboard document inbox. Each reuses the module that
 * already owns that kind of paperwork, so a document filed from the dashboard
 * is indistinguishable from one filed from the order page.
 */
import { supabase } from "@/lib/supabase";
import type { Order, Supplier } from "@/contexts/types";
import { uploadSwiftDocument } from "@/lib/swiftDocuments";
import { paymentUpdateFromSwift } from "@/lib/swiftImport/matchPayment";
import { swiftBelongsToOrder } from "@/lib/swiftImport/findOrder";
import { attachImportDocumentBatch, importDocSubtypeLabels, type ImportDocSubtype } from "@/lib/importFiles";
import { attachOrderDocument } from "@/lib/orderImport/attachDocument";
import type { SwiftPlan } from "./analyze";
import type { ParsedOrderDoc } from "@/lib/orderImport";

export interface ExecuteResult {
  error: string | null;
  message: string;
}

const fail = (error: string): ExecuteResult => ({ error, message: error });

/**
 * File a SWIFT under its order and, when it settles a scheduled installment,
 * mark that installment paid.
 *
 * Marking paid is the one consequential step, so it is skipped when the SWIFT
 * quotes an invoice number that is not this order's — the document is still
 * filed (and the message says so), matching the order page's behaviour.
 */
export async function fileSwift(file: File, order: Order, plan: SwiftPlan, supplierId?: string | null): Promise<ExecuteResult> {
  const payment = plan.orderId === order.id ? plan.match?.payment ?? null : null;
  const upload = await uploadSwiftDocument({ file, orderId: order.id, payment, supplierId: supplierId ?? order.supplier_id });
  if (upload.error) return fail(upload.error);

  if (!payment) return { error: null, message: "המסמך נשמר בהזמנה (לא נמצא תשלום מתאים לסמן)" };
  if (payment.status === "שולם") return { error: null, message: "המסמך נשמר; התשלום כבר היה מסומן כשולם" };

  if (swiftBelongsToOrder(plan.swift, order.pi_number) === false) {
    return { error: null, message: `המסמך נשמר, אך לא סומן תשלום — ה-SWIFT מפנה לחשבונית ${plan.swift.referencedDocument}` };
  }

  const { error } = await supabase.from("order_payments").update(paymentUpdateFromSwift(plan.swift)).eq("id", payment.id);
  if (error) return fail(`המסמך נשמר אך עדכון התשלום נכשל: ${error.message}`);
  return { error: null, message: "המסמך נשמר והתשלום סומן כשולם" };
}

/** Add shipping paperwork to an order's import dossier (created on demand). */
export async function fileShipping(
  items: { file: File; subtype: ImportDocSubtype }[],
  order: Order,
  suppliers: Supplier[],
): Promise<ExecuteResult> {
  const supplier = suppliers.find(s => s.id === order.supplier_id);
  const result = await attachImportDocumentBatch({
    files: items.map(i => i.file),
    orderId: order.id,
    supplierId: order.supplier_id,
    supplierName: supplier?.company ?? order.supplier_name,
    orderNumber: order.order_number,
    subtypes: new Map(items.map(i => [i.file, i.subtype])),
  });
  if (result.error) return fail(result.error);
  if (result.failures.length) return fail(result.failures.join("; "));

  const kinds = [...new Set(items.map(i => importDocSubtypeLabels[i.subtype]))].join(", ");
  const parts = [`${result.uploaded} נשמרו בתיק יבוא ${result.fileNumber} (${kinds})`];
  if (result.skipped) parts.push(`${result.skipped} כבר היו בתיק`);
  return { error: null, message: parts.join(" · ") };
}

/** A PI / PO for an order that already exists goes to its documents instead of making a duplicate. */
export async function attachToExistingOrder(file: File, order: Order, parsed: ParsedOrderDoc): Promise<ExecuteResult> {
  const isPo = parsed.source === "sap-pdf" && !!parsed.poNumber;
  const number = parsed.poNumber || parsed.piNumber || null;
  const error = await attachOrderDocument({
    file,
    orderId: order.id,
    supplierId: order.supplier_id,
    documentName: number ? `${isPo ? "הזמנת רכש SAP" : "PI"} ${number}` : file.name.replace(/\.[^/.]+$/, ""),
    documentNumber: number,
    type: isPo ? "PO" : parsed.piNumber ? "PI" : "כללי",
    totalPrice: parsed.total ?? parsed.subtotal ?? null,
    currency: parsed.currency || undefined,
    notes: "צורף ממרכז המסמכים בדשבורד",
  });
  return error ? fail(error) : { error: null, message: "המסמך צורף להזמנה הקיימת" };
}
