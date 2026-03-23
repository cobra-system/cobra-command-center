import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerOrderTools(server: McpServer) {
  server.tool(
    "list_orders",
    "רשימת הזמנות — List orders, optionally filtered by status/supplier/priority",
    {
      status: z.string().optional().describe("Filter by status"),
      supplier_id: z.string().uuid().optional().describe("Filter by supplier UUID"),
      supplier_name: z.string().optional().describe("Filter by supplier name (partial match)"),
      priority: z.string().optional().describe("Filter by priority"),
      limit: z.number().default(50).describe("Max results"),
    },
    async ({ status, supplier_id, supplier_name, priority, limit }) => {
      let query = supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (status) query = query.eq("status", status);
      if (supplier_id) query = query.eq("supplier_id", supplier_id);
      if (supplier_name) query = query.ilike("supplier_name", `%${supplier_name}%`);
      if (priority) query = query.eq("priority", priority);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_order",
    "פרטי הזמנה — Get a single order with its items",
    {
      id: z.string().uuid().describe("Order UUID"),
    },
    async ({ id }) => {
      const [orderRes, itemsRes] = await Promise.all([
        supabase.from("orders").select("*").eq("id", id).single(),
        supabase.from("order_items").select("*").eq("order_id", id),
      ]);

      if (orderRes.error) return { content: [{ type: "text" as const, text: `Error: ${orderRes.error.message}` }] };

      const result = {
        ...orderRes.data,
        items: itemsRes.data || [],
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "create_order",
    "יצירת הזמנה חדשה — Create a new order",
    {
      supplier_id: z.string().uuid().optional().describe("Supplier UUID"),
      supplier_name: z.string().optional().describe("Supplier name (auto-filled from supplier_id if omitted)"),
      status: z.string().default("חדשה").describe("Order status"),
      priority: z.string().default("רגיל").describe("Order priority"),
      order_date: z.string().optional().describe("Order date (YYYY-MM-DD)"),
      total_price: z.number().optional().describe("Total order price"),
      contact_name: z.string().optional().describe("Contact person name"),
      payment_status: z.string().optional().describe("Payment status (ממתין / שולם פיקדון / שולם)"),
      notes: z.string().optional().describe("Order notes"),
      eta: z.string().optional().describe("Estimated arrival date (YYYY-MM-DD)"),
      etd: z.string().optional().describe("Estimated departure date (YYYY-MM-DD)"),
      items: z.array(z.object({
        name: z.string().describe("Item name"),
        qty: z.number().describe("Quantity"),
        product_id: z.string().uuid().optional().describe("Product UUID"),
        price: z.number().optional().describe("Unit price"),
      })).optional().describe("Order line items"),
    },
    async ({ supplier_id, supplier_name, status, priority, order_date, total_price, contact_name, payment_status, notes, eta, etd, items }) => {
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
    "עדכון הזמנה — Update order status, dates, notes, etc.",
    {
      id: z.string().uuid().describe("Order UUID"),
      status: z.string().optional().describe("New status"),
      priority: z.string().optional().describe("New priority"),
      order_date: z.string().optional().describe("Order date (YYYY-MM-DD)"),
      total_price: z.number().optional().describe("Total order price"),
      payment_status: z.string().optional().describe("Payment status (ממתין / שולם פיקדון / שולם)"),
      payment_date: z.string().optional().describe("Payment date (YYYY-MM-DD)"),
      contact_name: z.string().optional().describe("Contact person name"),
      supplier_name: z.string().optional().describe("Supplier name"),
      notes: z.string().optional().describe("Updated notes"),
      eta: z.string().optional().describe("Updated ETA (YYYY-MM-DD)"),
      etd: z.string().optional().describe("Updated ETD (YYYY-MM-DD)"),
      shipping: z.string().optional().describe("Shipping info"),
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
}
