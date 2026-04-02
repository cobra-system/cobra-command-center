import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";

const MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".csv": "text/csv",
  ".txt": "text/plain",
};

export function registerDocumentTools(server: McpServer) {
  server.tool(
    "upload_document",
    "העלאת מסמך — Upload a file from the local filesystem and create a purchase document record (PI/PO)",
    {
      file_path: z.string().describe("Absolute path to the file on the local filesystem (e.g. /home/user/downloads/invoice.pdf)"),
      type: z.enum(["PI", "PO"]).describe("Document type: PI (Proforma Invoice) or PO (Purchase Order)"),
      document_name: z.string().optional().describe("Display name for the document. Defaults to the filename."),
      supplier_id: z.string().uuid().optional().describe("Supplier UUID"),
      order_id: z.string().uuid().optional().describe("Order UUID"),
      product_id: z.string().uuid().optional().describe("Product UUID"),
      quantity: z.number().int().default(0).describe("Quantity referenced in document"),
      unit_price: z.number().optional().describe("Unit price"),
      total_price: z.number().optional().describe("Total price"),
      currency: z.enum(["USD", "EUR", "ILS"]).default("USD").describe("Currency"),
      status: z.string().default("ממתין לאישור").describe("Document status"),
      notes: z.string().optional().describe("Additional notes"),
    },
    async ({ file_path, type, document_name, supplier_id, order_id, product_id,
             quantity, unit_price, total_price, currency, status, notes }) => {
      // 1. Read file from disk
      let fileBuffer: Buffer;
      try {
        fileBuffer = await readFile(file_path);
      } catch (err) {
        return { content: [{ type: "text" as const, text: `Error reading file at "${file_path}": ${(err as Error).message}` }] };
      }

      // 2. Build storage path
      const originalName = basename(file_path);
      const ext = extname(originalName).toLowerCase();
      const storagePath = `uploads/${Date.now()}-${originalName}`;
      const contentType = MIME_MAP[ext] ?? "application/octet-stream";

      // 3. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, fileBuffer, { contentType, upsert: false });

      if (uploadError) {
        return { content: [{ type: "text" as const, text: `Error uploading to storage: ${uploadError.message}` }] };
      }

      // 4. Get public URL (synchronous — no await)
      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(storagePath);
      const file_url = urlData.publicUrl;

      // 5. Insert DB record
      const { data, error } = await supabase
        .from("purchase_documents")
        .insert({
          type,
          document_name: document_name ?? originalName,
          supplier_id: supplier_id ?? null,
          product_id: product_id ?? null,
          order_id: order_id ?? null,
          quantity,
          unit_price: unit_price ?? null,
          total_price: total_price ?? null,
          currency,
          status,
          notes: notes ?? null,
          file_url,
        })
        .select()
        .single();

      if (error) {
        // Best-effort cleanup of orphaned storage object
        await supabase.storage.from("documents").remove([storagePath]);
        return { content: [{ type: "text" as const, text: `File uploaded but DB insert failed (file removed): ${error.message}` }] };
      }

      return { content: [{ type: "text" as const, text: `Document uploaded successfully:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "list_documents",
    "רשימת מסמכים — List purchase documents with optional filters",
    {
      type: z.enum(["PI", "PO"]).optional().describe("Filter by document type"),
      status: z.string().optional().describe("Filter by status"),
      supplier_id: z.string().uuid().optional().describe("Filter by supplier UUID"),
      order_id: z.string().uuid().optional().describe("Filter by order UUID"),
      product_id: z.string().uuid().optional().describe("Filter by product UUID"),
      limit: z.number().default(50).describe("Max results"),
    },
    async ({ type, status, supplier_id, order_id, product_id, limit }) => {
      let query = supabase
        .from("purchase_documents")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (type) query = query.eq("type", type);
      if (status) query = query.eq("status", status);
      if (supplier_id) query = query.eq("supplier_id", supplier_id);
      if (order_id) query = query.eq("order_id", order_id);
      if (product_id) query = query.eq("product_id", product_id);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_document",
    "פרטי מסמך — Get a single purchase document by ID",
    {
      id: z.string().uuid().describe("Document UUID"),
    },
    async ({ id }) => {
      const { data, error } = await supabase
        .from("purchase_documents")
        .select("*")
        .eq("id", id)
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_document",
    "עדכון מסמך — Update fields of an existing purchase document",
    {
      id: z.string().uuid().describe("Document UUID"),
      status: z.string().optional().describe("New status (e.g. אושר, נשלח לספק, בוצע)"),
      document_name: z.string().optional().describe("Updated display name"),
      notes: z.string().optional().describe("Updated notes"),
      approval_date: z.string().optional().describe("Approval timestamp (ISO 8601, e.g. 2026-03-22T10:00:00Z)"),
      approved_by: z.string().uuid().optional().describe("UUID of approving user"),
      quantity: z.number().int().optional().describe("Updated quantity"),
      unit_price: z.number().optional().describe("Updated unit price"),
      total_price: z.number().optional().describe("Updated total price"),
      currency: z.enum(["USD", "EUR", "ILS"]).optional().describe("Updated currency"),
      order_id: z.string().uuid().optional().describe("Link or relink to an order UUID"),
      supplier_id: z.string().uuid().optional().describe("Link or relink to a supplier UUID"),
    },
    async ({ id, ...fields }) => {
      const updates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) updates[key] = value;
      }

      if (Object.keys(updates).length === 0) {
        return { content: [{ type: "text" as const, text: "No fields to update" }] };
      }

      const { data, error } = await supabase
        .from("purchase_documents")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Document updated:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "delete_document",
    "מחיקת מסמך — Delete a purchase document record and its file from storage",
    {
      id: z.string().uuid().describe("Document UUID"),
    },
    async ({ id }) => {
      // 1. Fetch file_url before deleting
      const { data: doc, error: fetchError } = await supabase
        .from("purchase_documents")
        .select("file_url")
        .eq("id", id)
        .single();

      if (fetchError) {
        return { content: [{ type: "text" as const, text: `Error fetching document: ${fetchError.message}` }] };
      }

      // 2. Delete DB record
      const { error: deleteError } = await supabase
        .from("purchase_documents")
        .delete()
        .eq("id", id);

      if (deleteError) {
        return { content: [{ type: "text" as const, text: `Error deleting document: ${deleteError.message}` }] };
      }

      // 3. Delete file from storage
      if (doc?.file_url) {
        const marker = "/object/public/documents/";
        const markerIndex = doc.file_url.indexOf(marker);
        if (markerIndex !== -1) {
          const storagePath = doc.file_url.slice(markerIndex + marker.length);
          const { error: storageError } = await supabase.storage
            .from("documents")
            .remove([storagePath]);
          if (storageError) {
            return { content: [{ type: "text" as const, text: `Document record deleted but file removal failed: ${storageError.message}` }] };
          }
        }
      }

      return { content: [{ type: "text" as const, text: "Document deleted successfully" }] };
    }
  );

  server.tool(
    "attach_document_to_order",
    "צירוף מסמך להזמנה — Link an existing document (PI/PO) to an order",
    {
      document_id: z.string().uuid().describe("Document UUID"),
      order_id: z.string().uuid().describe("Order UUID to attach to"),
    },
    async ({ document_id, order_id }) => {
      const { data, error } = await supabase
        .from("purchase_documents")
        .update({ order_id })
        .eq("id", document_id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Document attached to order:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "list_order_documents",
    "הצגת מסמכים מצורפים להזמנה — List all documents attached to an order",
    {
      order_id: z.string().uuid().describe("Order UUID"),
    },
    async ({ order_id }) => {
      const { data, error } = await supabase
        .from("purchase_documents")
        .select("*")
        .eq("order_id", order_id)
        .order("created_at", { ascending: false });

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      if (!data || data.length === 0) {
        return { content: [{ type: "text" as const, text: `No documents found for order ${order_id}` }] };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // --- document_products junction tools ---

  server.tool(
    "list_document_products",
    "מוצרים מקושרים למסמך — List products linked to a purchase document",
    {
      document_id: z.string().uuid().describe("Document UUID"),
    },
    async ({ document_id }) => {
      const { data, error } = await supabase
        .from("document_products")
        .select("*, products(name, sku)")
        .eq("document_id", document_id)
        .order("created_at", { ascending: true });

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "link_product_to_document",
    "קישור מוצר למסמך — Link a product to a purchase document",
    {
      document_id: z.string().uuid().describe("Document UUID"),
      product_id: z.string().uuid().describe("Product UUID"),
    },
    async ({ document_id, product_id }) => {
      const { data, error } = await supabase
        .from("document_products")
        .insert({ document_id, product_id })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Product linked to document:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "unlink_product_from_document",
    "הסרת קישור מוצר ממסמך — Remove a product-document link",
    {
      document_id: z.string().uuid().describe("Document UUID"),
      product_id: z.string().uuid().describe("Product UUID"),
    },
    async ({ document_id, product_id }) => {
      const { error } = await supabase
        .from("document_products")
        .delete()
        .eq("document_id", document_id)
        .eq("product_id", product_id);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: "Product unlinked from document successfully" }] };
    }
  );
}
