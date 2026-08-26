/** Store an imported order file in the order's documents (storage + purchase_documents). */
import { supabase } from "@/lib/supabase";

export interface AttachOrderDocumentArgs {
  file: File;
  orderId: string;
  supplierId?: string | null;
  documentName: string;
  documentNumber?: string | null;
  /** PI / PO / כללי — same vocabulary as the documents module. */
  type: string;
  totalPrice?: number | null;
  currency?: string | null;
  notes?: string | null;
}

/** Returns null on success, or a human-readable error message. */
export async function attachOrderDocument(args: AttachOrderDocumentArgs): Promise<string | null> {
  const { file, orderId, supplierId, documentName, documentNumber, type, totalPrice, currency, notes } = args;

  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_{2,}/g, "_");
  const path = `uploads/${Date.now()}_${sanitizedName}`;

  const { error: uploadError } = await supabase.storage.from("documents").upload(path, file);
  if (uploadError) return uploadError.message;

  const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);

  const { error: insertError } = await supabase.from("purchase_documents").insert({
    document_name: documentName,
    type,
    file_url: urlData.publicUrl,
    order_id: orderId,
    supplier_id: supplierId || null,
    document_number: documentNumber || null,
    total_price: totalPrice ?? null,
    currency: currency || "USD",
    notes: notes || null,
    quantity: 0,
  });

  if (insertError) {
    // Roll back the upload so we don't leave an orphan file in storage.
    await supabase.storage.from("documents").remove([path]);
    return insertError.message;
  }

  return null;
}
