import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

const ORDER_STATUS_ENUM = z.enum([
  "PENDING",
  "ORDERED",
  "SHIPPED",
  "ARRIVED_PORT",
  "CUSTOMS_CLEARANCE",
  "DELIVERED",
  "ARRIVED",
  "CANCELLED",
]);

export function registerOrderTools(server: McpServer) {
  server.tool(
    "list_orders",
    "רשימת הזמנות — List orders, optionally filtered by status/supplier/priority",
    {
      status: ORDER_STATUS_ENUM.optional().describe("Filter by status: PENDING, ORDERED, SHIPPED, ARRIVED_PORT, CUSTOMS_CLEARANCE, DELIVERED, ARRIVED, CANCELLED"),
      supplier_id: z.string().uuid().optional().describe("Filter by supplier UUID"),
      supplier_name: z.string().optional().describe("Filter by supplier name (partial match)"),
      priority: z.enum(["דחוף", "גבוה", "בינוני", "נמוך"]).optional().describe("Filter by priority: דחוף (urgent), גבוה (high), בינוני (medium), נמוך (low)"),
      shipment_group_id: z.string().uuid().optional().describe("Filter by shipment group UUID"),
      limit: z.number().default(50).describe("Max results"),
    },
    async ({ status, supplier_id, supplier_name, priority, shipment_group_id, limit }) => {
      let query = supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (status) query = query.eq("status", status);
      if (supplier_id) query = query.eq("supplier_id", supplier_id);
      if (supplier_name) query = query.ilike("supplier_name", `%${supplier_name}%`);
      if (priority) query = query.eq("priority", priority);
      if (shipment_group_id) query = query.eq("shipment_group_id", shipment_group_id);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_order",
    "פרטי הזמנה — Get a single order with its items and payment schedule",
    {
      id: z.string().uuid().describe("Order UUID"),
    },
    async ({ id }) => {
      const [orderRes, itemsRes, paymentsRes] = await Promise.all([
        supabase.from("orders").select("*").eq("id", id).single(),
        supabase.from("order_items").select("*").eq("order_id", id),
        supabase.from("order_payments").select("*").eq("order_id", id).order("created_at", { ascending: true }),
      ]);

      if (orderRes.error) return { content: [{ type: "text" as const, text: `Error: ${orderRes.error.message}` }] };

      const result = {
        ...orderRes.data,
        items: itemsRes.data || [],
        payment_schedule: paymentsRes.data || [],
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_order_by_pi",
    "חיפוש הזמנה לפי מספר PI — Find an order by its Proforma Invoice number (fuzzy — handles revisions like iSV251224003rev1)",
    {
      pi_number: z.string().describe("PI number or partial PI number to search for. Fuzzy match — 'iSV251224003' will match 'iSV251224003rev1', 'iSV251224003b', etc."),
    },
    async ({ pi_number }) => {
      // Pure fuzzy: search pi_number field and notes in one pass.
      // This handles revisions (iSV251224003rev1), suffixes (iSV260112001b),
      // and PI numbers that were stored in notes before the pi_number field existed.
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .or(`pi_number.ilike.%${pi_number}%,notes.ilike.%${pi_number}%`)
        .order("created_at", { ascending: false });

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      if (!data || data.length === 0) {
        return { content: [{ type: "text" as const, text: `No orders found for PI number "${pi_number}"` }] };
      }

      // Sort: orders with pi_number field set first, then notes-only matches
      const sorted = [...data].sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
        const aHasPi = Boolean(a.pi_number);
        const bHasPi = Boolean(b.pi_number);
        if (aHasPi && !bHasPi) return -1;
        if (!aHasPi && bHasPi) return 1;
        return 0;
      });

      return { content: [{ type: "text" as const, text: JSON.stringify(sorted, null, 2) }] };
    }
  );

  server.tool(
    "create_order",
    "יצירת הזמנה חדשה — Create a new order",
    {
      supplier_id: z.string().uuid().optional().describe("Supplier UUID"),
      supplier_name: z.string().optional().describe("Supplier name (auto-filled from supplier_id if omitted)"),
      status: ORDER_STATUS_ENUM.default("PENDING").describe("Order status"),
      priority: z.enum(["דחוף", "גבוה", "בינוני", "נמוך"]).default("בינוני").describe("Order priority"),
      order_date: z.string().optional().describe("Order date (YYYY-MM-DD)"),
      total_price: z.number().optional().describe("Total order price"),
      contact_name: z.string().optional().describe("Contact person name"),
      payment_status: z.enum(["ממתין", "שולם פיקדון", "שולם"]).optional().describe("Payment status: ממתין (pending), שולם פיקדון (deposit paid), שולם (fully paid)"),
      notes: z.string().optional().describe("Order notes"),
      eta: z.string().optional().describe("Estimated arrival date (YYYY-MM-DD)"),
      etd: z.string().optional().describe("Estimated departure date (YYYY-MM-DD)"),
      tracking_number: z.string().optional().describe("Legacy tracking number field"),
      pi_number: z.string().optional().describe("Proforma Invoice number from supplier"),
      vessel_name: z.string().optional().describe("Vessel/ship name (e.g. MSC ISABELLA)"),
      booking_number: z.string().optional().describe("Shipping line booking number or BL number"),
      tclog_reference: z.string().optional().describe("tclog freight forwarder reference number"),
      shipment_group_id: z.string().uuid().optional().describe("Shipment group UUID to link this order to a shared shipment"),
      destination_supplier_id: z.string().uuid().optional().describe("Destination supplier UUID for supplier-to-supplier transfers"),
      destination_supplier_name: z.string().optional().describe("Destination supplier display name"),
      items: z.array(z.object({
        name: z.string().describe("Item name"),
        qty: z.number().describe("Quantity"),
        product_id: z.string().uuid().optional().describe("Product UUID"),
        price: z.number().optional().describe("Unit price"),
      })).optional().describe("Order line items"),
    },
    async ({ supplier_id, supplier_name, status, priority, order_date, total_price, contact_name,
             payment_status, notes, eta, etd, tracking_number, pi_number, vessel_name,
             booking_number, tclog_reference, shipment_group_id,
             destination_supplier_id, destination_supplier_name, items }) => {
      let resolvedSupplierName = supplier_name || null;
      if (supplier_id && !supplier_name) {
        const { data: sup } = await supabase.from("suppliers").select("company").eq("id", supplier_id).single();
        if (sup) resolvedSupplierName = sup.company;
      }

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          supplier_id: supplier_id || null,
          supplier_name: resolvedSupplierName,
          status,
          priority,
          order_date: order_date || null,
          total_price: total_price ?? null,
          contact_name: contact_name || null,
          payment_status: payment_status || null,
          notes: notes || null,
          eta: eta || null,
          etd: etd || null,
          tracking_number: tracking_number || null,
          pi_number: pi_number || null,
          vessel_name: vessel_name || null,
          booking_number: booking_number || null,
          tclog_reference: tclog_reference || null,
          shipment_group_id: shipment_group_id || null,
          destination_supplier_id: destination_supplier_id || null,
          destination_supplier_name: destination_supplier_name || null,
        })
        .select()
        .single();

      if (orderError) return { content: [{ type: "text" as const, text: `Error creating order: ${orderError.message}` }] };

      if (items && items.length > 0) {
        const orderItems = items.map((item) => ({
          order_id: order.id,
          name: item.name,
          qty: item.qty,
          product_id: item.product_id || null,
          price: item.price || null,
        }));

        const { error: itemsError } = await supabase
          .from("order_items")
          .insert(orderItems);

        if (itemsError) {
          return { content: [{ type: "text" as const, text: `Order created but items failed: ${itemsError.message}\nOrder: ${JSON.stringify(order, null, 2)}` }] };
        }
      }

      return { content: [{ type: "text" as const, text: `Order created:\n${JSON.stringify(order, null, 2)}` }] };
    }
  );

  server.tool(
    "update_order",
    "עדכון הזמנה — Update order status, dates, shipping fields, notes, etc.",
    {
      id: z.string().uuid().describe("Order UUID"),
      supplier_id: z.string().uuid().optional().describe("Supplier UUID — use to reassign order to a different supplier"),
      status: ORDER_STATUS_ENUM.optional().describe("New status"),
      priority: z.enum(["דחוף", "גבוה", "בינוני", "נמוך"]).optional().describe("New priority"),
      order_date: z.string().optional().describe("Order date (YYYY-MM-DD)"),
      total_price: z.number().optional().describe("Total order price"),
      payment_status: z.enum(["ממתין", "שולם פיקדון", "שולם"]).optional().describe("Payment status"),
      payment_date: z.string().optional().describe("Payment date (YYYY-MM-DD)"),
      contact_name: z.string().optional().describe("Contact person name"),
      supplier_name: z.string().optional().describe("Supplier name"),
      notes: z.string().optional().describe("Updated notes — previous value is saved to history"),
      notes_change_reason: z.string().optional().describe("Reason for notes change (saved to history): e.g. 'ETA updated', 'SWIFT received'"),
      eta: z.string().optional().describe("Updated ETA (YYYY-MM-DD)"),
      etd: z.string().optional().describe("Updated ETD (YYYY-MM-DD)"),
      shipping: z.string().optional().describe("Shipping method info"),
      tracking_number: z.string().optional().describe("Legacy tracking number"),
      pi_number: z.string().optional().describe("Proforma Invoice number"),
      vessel_name: z.string().optional().describe("Vessel/ship name"),
      booking_number: z.string().optional().describe("Booking/BL number"),
      tclog_reference: z.string().optional().describe("tclog reference number"),
      shipment_group_id: z.string().uuid().nullable().optional().describe("Shipment group UUID (pass null to unlink)"),
      destination_supplier_id: z.string().uuid().nullable().optional().describe("Destination supplier UUID for transfers (pass null to clear)"),
      destination_supplier_name: z.string().nullable().optional().describe("Destination supplier name (pass null to clear)"),
    },
    async ({ id, notes, notes_change_reason, ...fields }) => {
      const updates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) updates[key] = value;
      }
      if (notes !== undefined) updates.notes = notes;

      if (Object.keys(updates).length === 0) {
        return { content: [{ type: "text" as const, text: "No fields to update" }] };
      }

      // If notes are being updated, save the current value to history first
      if (notes !== undefined) {
        const { data: currentOrder } = await supabase
          .from("orders")
          .select("notes")
          .eq("id", id)
          .single();

        if (currentOrder) {
          await supabase.from("order_notes_history").insert({
            order_id: id,
            note_text: currentOrder.notes,
            changed_at: new Date().toISOString(),
            change_reason: notes_change_reason || null,
          });
        }
      }

      const { data, error } = await supabase
        .from("orders")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Order updated:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "get_order_notes_history",
    "היסטוריית הערות הזמנה — Get the change history for an order's notes",
    {
      order_id: z.string().uuid().describe("Order UUID"),
      limit: z.number().default(20).describe("Max history entries to return"),
    },
    async ({ order_id, limit }) => {
      const { data, error } = await supabase
        .from("order_notes_history")
        .select("*")
        .eq("order_id", order_id)
        .order("changed_at", { ascending: false })
        .limit(limit);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      if (!data || data.length === 0) {
        return { content: [{ type: "text" as const, text: "No notes history found for this order" }] };
      }

      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "delete_order",
    "מחיקת הזמנה — Delete an order and its items",
    {
      id: z.string().uuid().describe("Order UUID"),
    },
    async ({ id }) => {
      // Delete order items first to avoid FK constraint issues
      await supabase.from("order_items").delete().eq("order_id", id);

      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("id", id);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Order deleted successfully` }] };
    }
  );

  server.tool(
    "add_order_item",
    "הוספת פריט להזמנה — Add a line item to an existing order",
    {
      order_id: z.string().uuid().describe("Order UUID"),
      name: z.string().describe("Item name"),
      qty: z.number().describe("Quantity"),
      product_id: z.string().uuid().optional().describe("Product UUID"),
      price: z.number().optional().describe("Unit price"),
    },
    async ({ order_id, name, qty, product_id, price }) => {
      const { data, error } = await supabase
        .from("order_items")
        .insert({
          order_id,
          name,
          qty,
          product_id: product_id || null,
          price: price || null,
        })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Item added:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "remove_order_item",
    "הסרת פריט מהזמנה — Remove a line item from an order",
    {
      id: z.string().uuid().describe("Order item UUID"),
    },
    async ({ id }) => {
      const { error } = await supabase
        .from("order_items")
        .delete()
        .eq("id", id);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Order item removed successfully` }] };
    }
  );

  server.tool(
    "search_orders",
    "חיפוש הזמנות — Search orders by supplier, status, date range, product name, PI number, or vessel",
    {
      supplier_name: z.string().optional().describe("Partial supplier name match"),
      status: ORDER_STATUS_ENUM.optional().describe("Filter by order status"),
      date_from: z.string().optional().describe("Start date for order_date range (YYYY-MM-DD)"),
      date_to: z.string().optional().describe("End date for order_date range (YYYY-MM-DD)"),
      product_name: z.string().optional().describe("Search for orders containing a product (partial name match)"),
      pi_number: z.string().optional().describe("Search by PI number (partial match)"),
      vessel_name: z.string().optional().describe("Search by vessel name (partial match)"),
      limit: z.number().default(50).describe("Max results"),
    },
    async ({ supplier_name, status, date_from, date_to, product_name, pi_number, vessel_name, limit }) => {
      // If searching by product name, first find matching order IDs
      let orderIdFilter: string[] | null = null;
      if (product_name) {
        const { data: items } = await supabase
          .from("order_items")
          .select("order_id")
          .ilike("name", `%${product_name}%`);
        orderIdFilter = [...new Set((items || []).map((i: { order_id: string }) => i.order_id))];
        if (orderIdFilter.length === 0) {
          return { content: [{ type: "text" as const, text: "No orders found matching that product name" }] };
        }
      }

      let query = supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (supplier_name) query = query.ilike("supplier_name", `%${supplier_name}%`);
      if (status) query = query.eq("status", status);
      if (date_from) query = query.gte("order_date", date_from);
      if (date_to) query = query.lte("order_date", date_to);
      if (orderIdFilter) query = query.in("id", orderIdFilter);
      if (pi_number) query = query.ilike("pi_number", `%${pi_number}%`);
      if (vessel_name) query = query.ilike("vessel_name", `%${vessel_name}%`);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_order_by_reference",
    "משיכת הזמנה לפי הפניה — Find an order by PI number, tracking number, booking number, or reference string",
    {
      reference: z.string().describe("PI number, tracking number, booking number, or reference string to search for"),
    },
    async ({ reference }) => {
      // Strategy 1: exact match on pi_number
      const { data: byPi } = await supabase
        .from("orders")
        .select("*")
        .eq("pi_number", reference);

      if (byPi && byPi.length > 0) {
        return { content: [{ type: "text" as const, text: JSON.stringify(byPi, null, 2) }] };
      }

      // Strategy 2: exact match on tracking_number
      const { data: byTracking } = await supabase
        .from("orders")
        .select("*")
        .eq("tracking_number", reference);

      if (byTracking && byTracking.length > 0) {
        return { content: [{ type: "text" as const, text: JSON.stringify(byTracking, null, 2) }] };
      }

      // Strategy 3: exact match on booking_number
      const { data: byBooking } = await supabase
        .from("orders")
        .select("*")
        .eq("booking_number", reference);

      if (byBooking && byBooking.length > 0) {
        return { content: [{ type: "text" as const, text: JSON.stringify(byBooking, null, 2) }] };
      }

      // Strategy 4: exact match on tclog_reference
      const { data: byTclog } = await supabase
        .from("orders")
        .select("*")
        .eq("tclog_reference", reference);

      if (byTclog && byTclog.length > 0) {
        return { content: [{ type: "text" as const, text: JSON.stringify(byTclog, null, 2) }] };
      }

      // Strategy 5: legacy match on sap_doc_entry
      const { data: bySap } = await supabase
        .from("orders")
        .select("*")
        .eq("sap_doc_entry", reference);

      if (bySap && bySap.length > 0) {
        return { content: [{ type: "text" as const, text: JSON.stringify(bySap, null, 2) }] };
      }

      // Strategy 6: search in purchase_documents
      const { data: docs } = await supabase
        .from("purchase_documents")
        .select("order_id, document_name, type")
        .ilike("document_name", `%${reference}%`)
        .not("order_id", "is", null);

      if (docs && docs.length > 0) {
        const orderIds = [...new Set(docs.map((d: { order_id: string }) => d.order_id))];
        const { data: orders, error } = await supabase
          .from("orders")
          .select("*")
          .in("id", orderIds);

        if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
        return { content: [{ type: "text" as const, text: JSON.stringify({ orders, matched_documents: docs }, null, 2) }] };
      }

      // Strategy 7: partial match in notes
      const { data: byNotes } = await supabase
        .from("orders")
        .select("*")
        .ilike("notes", `%${reference}%`);

      if (byNotes && byNotes.length > 0) {
        return { content: [{ type: "text" as const, text: JSON.stringify(byNotes, null, 2) }] };
      }

      return { content: [{ type: "text" as const, text: `No orders found for reference "${reference}"` }] };
    }
  );

  server.tool(
    "bulk_create_order_items",
    "הוספת כמה פריטים להזמנה — Add multiple line items to an order in a single call",
    {
      order_id: z.string().uuid().describe("Order UUID"),
      items: z.array(z.object({
        name: z.string().describe("Item name"),
        qty: z.number().describe("Quantity"),
        product_id: z.string().uuid().optional().describe("Product UUID"),
        price: z.number().optional().describe("Unit price"),
      })).describe("Array of items to add"),
    },
    async ({ order_id, items }) => {
      const rows = items.map((item) => ({
        order_id,
        name: item.name,
        qty: item.qty,
        product_id: item.product_id || null,
        price: item.price ?? null,
      }));

      const { data, error } = await supabase
        .from("order_items")
        .insert(rows)
        .select();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `${data.length} items added:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );
}
