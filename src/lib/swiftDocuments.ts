/**
 * SWIFT confirmation documents.
 *
 * A SWIFT confirmation is stored like any other file in the documents module
 * (`purchase_documents`, storage bucket `documents`) with:
 *   type              = "כללי"
 *   document_subtype  = "SWIFT"
 *   order_payment_id  = the installment in `order_payments` it settles
 *
 * That way a SWIFT uploaded straight from the order payment schedule shows up
 * in the documents module (and in the order's document list) without any extra
 * bookkeeping, and the payment row can link back to the file.
 */
import { supabase } from "@/lib/supabase";
import type { OrderPayment } from "@/contexts/types";

export const SWIFT_SUBTYPE = "SWIFT";

/** Document `type` used for SWIFT rows — SWIFT is a subtype of a general document, not a PI/PO. */
export const SWIFT_DOC_TYPE = "כללי";

/** File types accepted as a SWIFT confirmation (bank exports are PDF, sometimes a screenshot). */
export const SWIFT_FILE_ACCEPT = ".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx";

const paymentTypeLabel: Record<string, string> = {
  Deposit: "מקדמה",
  Balance: "יתרה",
  Full: "מלא",
};

/** Storage-safe object name (Supabase storage rejects most non-ASCII paths). */
export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_{2,}/g, "_");
}

/**
 * Default display name for a SWIFT document, e.g. "SWIFT מקדמה 70,000 USD".
 * Falls back to the file name when there is no payment context.
 */
export function swiftDocumentName(payment?: Pick<OrderPayment, "payment_type" | "amount" | "currency"> | null, fileName?: string): string {
  if (!payment) return fileName ? fileName.replace(/\.[^/.]+$/, "") : "SWIFT";
  const parts = ["SWIFT", paymentTypeLabel[payment.payment_type] || payment.payment_type];
  if (payment.amount) parts.push(`${Number(payment.amount).toLocaleString("en-US")} ${payment.currency || ""}`.trim());
  return parts.filter(Boolean).join(" ");
}

export interface UploadSwiftArgs {
  file: File;
  orderId: string;
  /** Installment the SWIFT settles — omit to attach the SWIFT to the order only. */
  payment?: OrderPayment | null;
  supplierId?: string | null;
  /** Override the generated document name. */
  documentName?: string;
}

export interface UploadSwiftResult {
  error: string | null;
  documentId?: string;
  fileUrl?: string;
}

/**
 * Upload a SWIFT file to storage and create its `purchase_documents` row.
 * On a failed DB insert the storage object is removed again so no orphan file
 * is left behind (same rollback the manual upload dialog does).
 */
export async function uploadSwiftDocument({
  file, orderId, payment, supplierId, documentName,
}: UploadSwiftArgs): Promise<UploadSwiftResult> {
  const path = `swift/${orderId}/${Date.now()}_${sanitizeFileName(file.name)}`;

  const { error: uploadError } = await supabase.storage.from("documents").upload(path, file);
  if (uploadError) return { error: uploadError.message };

  const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);

  const { data, error } = await supabase
    .from("purchase_documents")
    .insert({
      document_name: documentName?.trim() || swiftDocumentName(payment, file.name),
      type: SWIFT_DOC_TYPE,
      document_subtype: SWIFT_SUBTYPE,
      order_id: orderId,
      order_payment_id: payment?.id ?? null,
      supplier_id: supplierId || null,
      document_number: payment?.swift_reference || null,
      total_price: payment?.amount ?? null,
      currency: payment?.currency || "USD",
      // A bank confirmation is a record of something that already happened —
      // it does not go through the PI/PO approval flow.
      status: "בוצע",
      quantity: 0,
      file_url: urlData.publicUrl,
    })
    .select("id")
    .single();

  if (error) {
    await supabase.storage.from("documents").remove([path]);
    return { error: error.message };
  }

  return { error: null, documentId: (data as { id: string } | null)?.id, fileUrl: urlData.publicUrl };
}
