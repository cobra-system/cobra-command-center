import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerEquipmentTools(server: McpServer) {
  // ═══════════════════════════════════════════════════════════════
  // Installers — מתקינים
  // ═══════════════════════════════════════════════════════════════

  server.tool(
    "list_installers",
    "רשימת מתקינים — List installers, optionally filtered by division/status/coordinator",
    {
      division: z.string().optional().describe("Filter by division: 'AWACS' | 'כפתור' | 'DOORE'"),
      status: z.string().optional().describe("Filter by status: 'פעיל' (active) | 'לא פעיל' (inactive)"),
      coordinator: z.string().optional().describe("Filter by coordinator name"),
      limit: z.number().default(100).describe("Max results"),
    },
    async ({ division, status, coordinator, limit }) => {
      let query = supabase
        .from("installers")
        .select("*")
        .order("name")
        .limit(limit);

      if (division) query = query.eq("division", division);
      if (status) query = query.eq("status", status);
      if (coordinator) query = query.ilike("coordinator", `%${coordinator}%`);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_installer",
    "פרטי מתקין — Get installer details with pickup/return summary",
    {
      id: z.string().uuid().describe("Installer UUID"),
    },
    async ({ id }) => {
      const [instRes, pickupsRes, returnsRes] = await Promise.all([
        supabase.from("installers").select("*").eq("id", id).single(),
        supabase
          .from("equipment_pickups")
          .select("id, pickup_date, notes, equipment_pickup_items(quantity)")
          .eq("installer_id", id)
          .order("pickup_date", { ascending: false }),
        supabase
          .from("equipment_returns")
          .select("id, return_date, notes, equipment_return_items(quantity, reason, is_actually_faulty)")
          .eq("installer_id", id)
          .order("return_date", { ascending: false }),
      ]);

      if (instRes.error) return { content: [{ type: "text" as const, text: `Error: ${instRes.error.message}` }] };

      const totalTaken = (pickupsRes.data ?? []).reduce(
        (sum, p) => sum + ((p.equipment_pickup_items as { quantity: number }[]) ?? []).reduce((s, i) => s + i.quantity, 0),
        0
      );
      const totalReturned = (returnsRes.data ?? []).reduce(
        (sum, r) => sum + ((r.equipment_return_items as { quantity: number; reason: string; is_actually_faulty: boolean | null }[]) ?? []).reduce((s, i) => s + i.quantity, 0),
        0
      );
      const wasteCount = (returnsRes.data ?? []).reduce(
        (sum, r) =>
          sum +
          ((r.equipment_return_items as { quantity: number; reason: string; is_actually_faulty: boolean | null }[]) ?? [])
            .filter((i) => i.is_actually_faulty === false)
            .reduce((s, i) => s + i.quantity, 0),
        0
      );

      const result = {
        ...instRes.data,
        stats: {
          total_items_taken: totalTaken,
          total_items_returned: totalReturned,
          return_percentage: totalTaken > 0 ? Math.round((totalReturned / totalTaken) * 100) : 0,
          waste_count: wasteCount,
          total_pickups: (pickupsRes.data ?? []).length,
          total_returns: (returnsRes.data ?? []).length,
        },
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "create_installer",
    "יצירת מתקין חדש — Create a new installer",
    {
      name: z.string().describe("Installer name"),
      warehouse_number: z.number().optional().describe("Warehouse number"),
      division: z.enum(["AWACS", "כפתור", "DOORE"]).default("AWACS").describe("Division: AWACS, כפתור, DOORE"),
      phone: z.string().optional().describe("Phone number"),
      coordinator: z.string().optional().describe("Coordinator name (e.g. סלין, ליטל)"),
      notes: z.string().optional().describe("Notes"),
    },
    async ({ name, warehouse_number, division, phone, coordinator, notes }) => {
      const { data, error } = await supabase
        .from("installers")
        .insert({
          name,
          warehouse_number: warehouse_number ?? null,
          division,
          phone: phone || null,
          coordinator: coordinator || null,
          notes: notes || null,
        })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_installer",
    "עדכון מתקין — Update installer fields",
    {
      id: z.string().uuid().describe("Installer UUID"),
      name: z.string().optional().describe("Installer name"),
      warehouse_number: z.number().optional().describe("Warehouse number"),
      division: z.enum(["AWACS", "כפתור", "DOORE"]).optional().describe("Division"),
      phone: z.string().optional().describe("Phone number"),
      coordinator: z.string().optional().describe("Coordinator name"),
      status: z.enum(["פעיל", "לא פעיל"]).optional().describe("Status: פעיל (active), לא פעיל (inactive)"),
      notes: z.string().optional().describe("Notes"),
    },
    async ({ id, name, warehouse_number, division, phone, coordinator, status, notes }) => {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (name !== undefined) updates.name = name;
      if (warehouse_number !== undefined) updates.warehouse_number = warehouse_number;
      if (division !== undefined) updates.division = division;
      if (phone !== undefined) updates.phone = phone || null;
      if (coordinator !== undefined) updates.coordinator = coordinator || null;
      if (status !== undefined) updates.status = status;
      if (notes !== undefined) updates.notes = notes || null;

      const { data, error } = await supabase
        .from("installers")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "delete_installer",
    "מחיקת מתקין — Delete an installer and all related pickups/returns (cascade)",
    {
      id: z.string().uuid().describe("Installer UUID"),
    },
    async ({ id }) => {
      const { error } = await supabase.from("installers").delete().eq("id", id);
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Installer ${id} deleted successfully.` }] };
    }
  );

  server.tool(
    "search_installers",
    "חיפוש מתקינים — Search installers by name (partial match)",
    {
      query: z.string().describe("Search text (partial name match)"),
    },
    async ({ query }) => {
      const { data, error } = await supabase
        .from("installers")
        .select("*")
        .ilike("name", `%${query}%`)
        .order("name")
        .limit(20);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ═══════════════════════════════════════════════════════════════
  // Equipment Pickups — הצטיידויות
  // ═══════════════════════════════════════════════════════════════

  server.tool(
    "list_equipment_pickups",
    "רשימת הצטיידויות — List equipment pickups with items, filtered by installer/date",
    {
      installer_id: z.string().uuid().optional().describe("Filter by installer UUID"),
      installer_name: z.string().optional().describe("Filter by installer name (partial match)"),
      date_from: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      date_to: z.string().optional().describe("End date (YYYY-MM-DD)"),
      limit: z.number().default(50).describe("Max results"),
    },
    async ({ installer_id, installer_name, date_from, date_to, limit }) => {
      let installerIds: string[] | null = null;

      if (installer_name) {
        const { data: installers } = await supabase
          .from("installers")
          .select("id")
          .ilike("name", `%${installer_name}%`);
        installerIds = (installers ?? []).map((i) => i.id);
        if (installerIds.length === 0) {
          return { content: [{ type: "text" as const, text: "[]" }] };
        }
      }

      let query = supabase
        .from("equipment_pickups")
        .select("*, installers(name, warehouse_number), equipment_pickup_items(*, products(name, sku))")
        .order("pickup_date", { ascending: false })
        .limit(limit);

      if (installer_id) query = query.eq("installer_id", installer_id);
      if (installerIds) query = query.in("installer_id", installerIds);
      if (date_from) query = query.gte("pickup_date", date_from);
      if (date_to) query = query.lte("pickup_date", date_to);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_equipment_pickup",
    "הצטיידות חדשה — Create a pickup (installer takes equipment) with line items",
    {
      installer_id: z.string().uuid().describe("Installer UUID"),
      pickup_date: z.string().describe("Pickup date (YYYY-MM-DD)"),
      notes: z.string().optional().describe("Notes"),
      source_email_subject: z.string().optional().describe("Source email subject"),
      items: z.array(z.object({
        product_id: z.string().uuid().describe("Product UUID"),
        quantity: z.number().min(1).describe("Quantity taken"),
        serial_numbers: z.array(z.string()).optional().describe("Serial numbers / IMEI"),
      })).min(1).describe("List of items picked up"),
    },
    async ({ installer_id, pickup_date, notes, source_email_subject, items }) => {
      const { data: pickup, error: pickupError } = await supabase
        .from("equipment_pickups")
        .insert({
          installer_id,
          pickup_date,
          notes: notes || null,
          source_email_subject: source_email_subject || null,
        })
        .select()
        .single();

      if (pickupError) return { content: [{ type: "text" as const, text: `Error creating pickup: ${pickupError.message}` }] };

      const pickupItems = items.map((item) => ({
        pickup_id: pickup.id,
        product_id: item.product_id,
        quantity: item.quantity,
        serial_numbers: item.serial_numbers ?? null,
      }));

      const { error: itemsError } = await supabase
        .from("equipment_pickup_items")
        .insert(pickupItems);

      if (itemsError) {
        return { content: [{ type: "text" as const, text: `Pickup created (${pickup.id}) but failed to add items: ${itemsError.message}` }] };
      }

      const result = { ...pickup, items: pickupItems };
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "delete_equipment_pickup",
    "מחיקת הצטיידות — Delete a pickup and all its items (cascade)",
    {
      id: z.string().uuid().describe("Pickup UUID"),
    },
    async ({ id }) => {
      const { error } = await supabase.from("equipment_pickups").delete().eq("id", id);
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Pickup ${id} deleted successfully.` }] };
    }
  );

  server.tool(
    "get_equipment_pickup",
    "פרטי הצטיידות — Get a single pickup with all items and product details",
    {
      id: z.string().uuid().describe("Pickup UUID"),
    },
    async ({ id }) => {
      const [pickupRes, itemsRes] = await Promise.all([
        supabase.from("equipment_pickups").select("*, installers(name, warehouse_number, division)").eq("id", id).single(),
        supabase.from("equipment_pickup_items").select("*, products(name, sku)").eq("pickup_id", id),
      ]);
      if (pickupRes.error) return { content: [{ type: "text" as const, text: `Error: ${pickupRes.error.message}` }] };
      const result = { ...pickupRes.data, items: itemsRes.data ?? [] };
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "update_equipment_pickup",
    "עדכון הצטיידות — Update pickup header fields (date, notes)",
    {
      id: z.string().uuid().describe("Pickup UUID"),
      pickup_date: z.string().optional().describe("Pickup date (YYYY-MM-DD)"),
      notes: z.string().optional().describe("Notes"),
      source_email_subject: z.string().optional().describe("Source email subject"),
    },
    async ({ id, pickup_date, notes, source_email_subject }) => {
      const updates: Record<string, unknown> = {};
      if (pickup_date !== undefined) updates.pickup_date = pickup_date;
      if (notes !== undefined) updates.notes = notes || null;
      if (source_email_subject !== undefined) updates.source_email_subject = source_email_subject || null;

      const { data, error } = await supabase.from("equipment_pickups").update(updates).eq("id", id).select().single();
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "add_pickup_item",
    "הוספת פריט להצטיידות — Add an item to an existing pickup",
    {
      pickup_id: z.string().uuid().describe("Pickup UUID"),
      product_id: z.string().uuid().describe("Product UUID"),
      quantity: z.number().min(1).describe("Quantity"),
      serial_numbers: z.array(z.string()).optional().describe("Serial numbers / IMEI"),
    },
    async ({ pickup_id, product_id, quantity, serial_numbers }) => {
      const { data, error } = await supabase
        .from("equipment_pickup_items")
        .insert({ pickup_id, product_id, quantity, serial_numbers: serial_numbers ?? null })
        .select("*, products(name, sku)")
        .single();
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_pickup_item",
    "עדכון פריט הצטיידות — Update a pickup item (quantity, serial numbers)",
    {
      item_id: z.string().uuid().describe("Pickup item UUID"),
      product_id: z.string().uuid().optional().describe("Change product"),
      quantity: z.number().min(1).optional().describe("New quantity"),
      serial_numbers: z.array(z.string()).optional().describe("Updated serial numbers"),
    },
    async ({ item_id, product_id, quantity, serial_numbers }) => {
      const updates: Record<string, unknown> = {};
      if (product_id !== undefined) updates.product_id = product_id;
      if (quantity !== undefined) updates.quantity = quantity;
      if (serial_numbers !== undefined) updates.serial_numbers = serial_numbers;

      const { data, error } = await supabase.from("equipment_pickup_items").update(updates).eq("id", item_id).select("*, products(name, sku)").single();
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "remove_pickup_item",
    "הסרת פריט מהצטיידות — Remove an item from a pickup",
    {
      item_id: z.string().uuid().describe("Pickup item UUID"),
    },
    async ({ item_id }) => {
      const { error } = await supabase.from("equipment_pickup_items").delete().eq("id", item_id);
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Pickup item ${item_id} removed.` }] };
    }
  );

  // ═══════════════════════════════════════════════════════════════
  // Equipment Returns — החזרות
  // ═══════════════════════════════════════════════════════════════

  server.tool(
    "list_equipment_returns",
    "רשימת החזרות — List equipment returns with items, filtered by installer/date/faulty",
    {
      installer_id: z.string().uuid().optional().describe("Filter by installer UUID"),
      installer_name: z.string().optional().describe("Filter by installer name (partial match)"),
      date_from: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      date_to: z.string().optional().describe("End date (YYYY-MM-DD)"),
      is_actually_faulty: z.boolean().optional().describe("Filter by faulty status: true=faulty, false=not faulty (waste)"),
      limit: z.number().default(50).describe("Max results"),
    },
    async ({ installer_id, installer_name, date_from, date_to, is_actually_faulty, limit }) => {
      let installerIds: string[] | null = null;

      if (installer_name) {
        const { data: installers } = await supabase
          .from("installers")
          .select("id")
          .ilike("name", `%${installer_name}%`);
        installerIds = (installers ?? []).map((i) => i.id);
        if (installerIds.length === 0) {
          return { content: [{ type: "text" as const, text: "[]" }] };
        }
      }

      // Build return items filter
      let itemFilter = "*, products(name, sku)";
      if (is_actually_faulty !== undefined) {
        itemFilter = `*, products(name, sku)`;
      }

      let query = supabase
        .from("equipment_returns")
        .select(`*, installers(name, warehouse_number), equipment_return_items(${itemFilter})`)
        .order("return_date", { ascending: false })
        .limit(limit);

      if (installer_id) query = query.eq("installer_id", installer_id);
      if (installerIds) query = query.in("installer_id", installerIds);
      if (date_from) query = query.gte("return_date", date_from);
      if (date_to) query = query.lte("return_date", date_to);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      // Post-filter by is_actually_faulty if needed
      let result = data ?? [];
      if (is_actually_faulty !== undefined) {
        result = result.map((r) => ({
          ...r,
          equipment_return_items: ((r as Record<string, unknown>).equipment_return_items as Array<{ is_actually_faulty: boolean | null }> ?? []).filter(
            (i) => i.is_actually_faulty === is_actually_faulty
          ),
        })).filter((r) => (r.equipment_return_items as unknown[]).length > 0);
      }

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "create_equipment_return",
    "החזרה חדשה — Create a return (installer returns equipment) with line items",
    {
      installer_id: z.string().uuid().describe("Installer UUID"),
      return_date: z.string().describe("Return date (YYYY-MM-DD)"),
      notes: z.string().optional().describe("Notes"),
      items: z.array(z.object({
        product_id: z.string().uuid().describe("Product UUID"),
        quantity: z.number().min(1).describe("Quantity returned"),
        reason: z.enum(["תקלת התקנה", "מוצר פגום", "לא תואם רכב", "עודף", "אחר"]).default("אחר").describe("Return reason"),
        reason_detail: z.string().optional().describe("Detailed reason"),
        sticker_label: z.string().optional().describe("Sticker content on the product"),
        serial_numbers: z.array(z.string()).optional().describe("Serial numbers / IMEI"),
      })).min(1).describe("List of returned items"),
    },
    async ({ installer_id, return_date, notes, items }) => {
      const { data: ret, error: retError } = await supabase
        .from("equipment_returns")
        .insert({
          installer_id,
          return_date,
          notes: notes || null,
        })
        .select()
        .single();

      if (retError) return { content: [{ type: "text" as const, text: `Error creating return: ${retError.message}` }] };

      const returnItems = items.map((item) => ({
        return_id: ret.id,
        product_id: item.product_id,
        quantity: item.quantity,
        reason: item.reason,
        reason_detail: item.reason_detail || null,
        sticker_label: item.sticker_label || null,
        serial_numbers: item.serial_numbers ?? null,
      }));

      const { error: itemsError } = await supabase
        .from("equipment_return_items")
        .insert(returnItems);

      if (itemsError) {
        return { content: [{ type: "text" as const, text: `Return created (${ret.id}) but failed to add items: ${itemsError.message}` }] };
      }

      const result = { ...ret, items: returnItems };
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "delete_equipment_return",
    "מחיקת החזרה — Delete a return and all its items (cascade)",
    {
      id: z.string().uuid().describe("Return UUID"),
    },
    async ({ id }) => {
      const { error } = await supabase.from("equipment_returns").delete().eq("id", id);
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Return ${id} deleted successfully.` }] };
    }
  );

  server.tool(
    "get_equipment_return",
    "פרטי החזרה — Get a single return with all items and product details",
    {
      id: z.string().uuid().describe("Return UUID"),
    },
    async ({ id }) => {
      const [retRes, itemsRes] = await Promise.all([
        supabase.from("equipment_returns").select("*, installers(name, warehouse_number, division)").eq("id", id).single(),
        supabase.from("equipment_return_items").select("*, products(name, sku)").eq("return_id", id),
      ]);
      if (retRes.error) return { content: [{ type: "text" as const, text: `Error: ${retRes.error.message}` }] };
      const result = { ...retRes.data, items: itemsRes.data ?? [] };
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "update_equipment_return",
    "עדכון החזרה — Update return header fields (date, notes)",
    {
      id: z.string().uuid().describe("Return UUID"),
      return_date: z.string().optional().describe("Return date (YYYY-MM-DD)"),
      notes: z.string().optional().describe("Notes"),
    },
    async ({ id, return_date, notes }) => {
      const updates: Record<string, unknown> = {};
      if (return_date !== undefined) updates.return_date = return_date;
      if (notes !== undefined) updates.notes = notes || null;

      const { data, error } = await supabase.from("equipment_returns").update(updates).eq("id", id).select().single();
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "add_return_item",
    "הוספת פריט להחזרה — Add an item to an existing return",
    {
      return_id: z.string().uuid().describe("Return UUID"),
      product_id: z.string().uuid().describe("Product UUID"),
      quantity: z.number().min(1).describe("Quantity"),
      reason: z.enum(["תקלת התקנה", "מוצר פגום", "לא תואם רכב", "עודף", "אחר"]).default("אחר").describe("Return reason"),
      reason_detail: z.string().optional().describe("Detailed reason"),
      sticker_label: z.string().optional().describe("Sticker label text"),
      serial_numbers: z.array(z.string()).optional().describe("Serial numbers / IMEI"),
    },
    async ({ return_id, product_id, quantity, reason, reason_detail, sticker_label, serial_numbers }) => {
      const { data, error } = await supabase
        .from("equipment_return_items")
        .insert({
          return_id,
          product_id,
          quantity,
          reason,
          reason_detail: reason_detail || null,
          sticker_label: sticker_label || null,
          serial_numbers: serial_numbers ?? null,
        })
        .select("*, products(name, sku)")
        .single();
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_return_item",
    "עדכון פריט החזרה — Update a return item (quantity, reason, sticker, serial numbers)",
    {
      item_id: z.string().uuid().describe("Return item UUID"),
      product_id: z.string().uuid().optional().describe("Change product"),
      quantity: z.number().min(1).optional().describe("New quantity"),
      reason: z.enum(["תקלת התקנה", "מוצר פגום", "לא תואם רכב", "עודף", "אחר"]).optional().describe("Return reason"),
      reason_detail: z.string().optional().describe("Detailed reason"),
      sticker_label: z.string().optional().describe("Sticker label text"),
      serial_numbers: z.array(z.string()).optional().describe("Updated serial numbers"),
    },
    async ({ item_id, product_id, quantity, reason, reason_detail, sticker_label, serial_numbers }) => {
      const updates: Record<string, unknown> = {};
      if (product_id !== undefined) updates.product_id = product_id;
      if (quantity !== undefined) updates.quantity = quantity;
      if (reason !== undefined) updates.reason = reason;
      if (reason_detail !== undefined) updates.reason_detail = reason_detail || null;
      if (sticker_label !== undefined) updates.sticker_label = sticker_label || null;
      if (serial_numbers !== undefined) updates.serial_numbers = serial_numbers;

      const { data, error } = await supabase.from("equipment_return_items").update(updates).eq("id", item_id).select("*, products(name, sku)").single();
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "remove_return_item",
    "הסרת פריט מהחזרה — Remove an item from a return",
    {
      item_id: z.string().uuid().describe("Return item UUID"),
    },
    async ({ item_id }) => {
      const { error } = await supabase.from("equipment_return_items").delete().eq("id", item_id);
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Return item ${item_id} removed.` }] };
    }
  );

  // ═══════════════════════════════════════════════════════════════
  // Return item inspection — בדיקת פריטים מוחזרים
  // ═══════════════════════════════════════════════════════════════

  server.tool(
    "update_return_item_faulty_status",
    "עדכון סטטוס בלאי — Mark a returned item as faulty (true), not faulty/waste (false), or unchecked (null)",
    {
      return_item_id: z.string().uuid().describe("Return item UUID"),
      is_actually_faulty: z.boolean().nullable().describe("true=actually faulty, false=not faulty (waste), null=unchecked"),
      checked_by: z.string().uuid().optional().describe("Profile UUID of who checked"),
    },
    async ({ return_item_id, is_actually_faulty, checked_by }) => {
      const { data, error } = await supabase
        .from("equipment_return_items")
        .update({
          is_actually_faulty,
          checked_at: is_actually_faulty !== null ? new Date().toISOString() : null,
          checked_by: checked_by || null,
        })
        .eq("id", return_item_id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "bulk_update_return_items_faulty",
    "עדכון סטטוס בלאי בכמות — Mark multiple returned items as faulty/not-faulty/unchecked at once",
    {
      items: z.array(z.object({
        return_item_id: z.string().uuid().describe("Return item UUID"),
        is_actually_faulty: z.boolean().nullable().describe("true=faulty, false=waste, null=unchecked"),
      })).min(1).describe("List of items to update"),
      checked_by: z.string().uuid().optional().describe("Profile UUID of who checked"),
    },
    async ({ items, checked_by }) => {
      const results: { id: string; success: boolean; error?: string }[] = [];
      for (const item of items) {
        const { error } = await supabase
          .from("equipment_return_items")
          .update({
            is_actually_faulty: item.is_actually_faulty,
            checked_at: item.is_actually_faulty !== null ? new Date().toISOString() : null,
            checked_by: checked_by || null,
          })
          .eq("id", item.return_item_id);
        results.push({ id: item.return_item_id, success: !error, error: error?.message });
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  // ═══════════════════════════════════════════════════════════════
  // Reports — דוחות הצטיידות
  // ═══════════════════════════════════════════════════════════════

  server.tool(
    "get_waste_report",
    "דוח בזבוז — Get all returned items marked as NOT faulty (waste). These are items installers returned claiming they're broken, but are actually fine",
    {
      date_from: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      date_to: z.string().optional().describe("End date (YYYY-MM-DD)"),
      installer_id: z.string().uuid().optional().describe("Filter by installer UUID"),
      division: z.string().optional().describe("Filter by division"),
      limit: z.number().default(100).describe("Max results"),
    },
    async ({ date_from, date_to, installer_id, division, limit }) => {
      let query = supabase
        .from("equipment_return_items")
        .select("*, products(name, sku), equipment_returns!inner(return_date, installer_id, installers(name, warehouse_number, division))")
        .eq("is_actually_faulty", false)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (date_from) query = query.gte("equipment_returns.return_date", date_from);
      if (date_to) query = query.lte("equipment_returns.return_date", date_to);
      if (installer_id) query = query.eq("equipment_returns.installer_id", installer_id);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      // Post-filter by division if needed
      let result = data ?? [];
      if (division) {
        result = result.filter((item) => {
          const ret = (item as Record<string, unknown>).equipment_returns as Record<string, unknown>;
          const inst = ret?.installers as Record<string, unknown>;
          return inst?.division === division;
        });
      }

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_installer_history",
    "היסטוריית מתקין — Get full pickup and return history for a specific installer with product names",
    {
      installer_id: z.string().uuid().describe("Installer UUID"),
      date_from: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      date_to: z.string().optional().describe("End date (YYYY-MM-DD)"),
    },
    async ({ installer_id, date_from, date_to }) => {
      const instRes = await supabase.from("installers").select("*").eq("id", installer_id).single();
      if (instRes.error) return { content: [{ type: "text" as const, text: `Error: ${instRes.error.message}` }] };

      let pickQuery = supabase
        .from("equipment_pickups")
        .select("*, equipment_pickup_items(*, products(name, sku))")
        .eq("installer_id", installer_id)
        .order("pickup_date", { ascending: false });

      let retQuery = supabase
        .from("equipment_returns")
        .select("*, equipment_return_items(*, products(name, sku))")
        .eq("installer_id", installer_id)
        .order("return_date", { ascending: false });

      if (date_from) {
        pickQuery = pickQuery.gte("pickup_date", date_from);
        retQuery = retQuery.gte("return_date", date_from);
      }
      if (date_to) {
        pickQuery = pickQuery.lte("pickup_date", date_to);
        retQuery = retQuery.lte("return_date", date_to);
      }

      const [pickRes, retRes] = await Promise.all([pickQuery, retQuery]);

      const result = {
        installer: instRes.data,
        pickups: pickRes.data ?? [],
        returns: retRes.data ?? [],
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_return_reasons_summary",
    "סיכום סיבות החזרה — Get breakdown of return reasons by count and percentage",
    {
      date_from: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      date_to: z.string().optional().describe("End date (YYYY-MM-DD)"),
      division: z.string().optional().describe("Filter by division"),
      installer_id: z.string().uuid().optional().describe("Filter by specific installer"),
    },
    async ({ date_from, date_to, division, installer_id }) => {
      // Get installers for division filter
      let installerIds: string[] | null = null;
      if (division || installer_id) {
        if (installer_id) {
          installerIds = [installer_id];
        } else {
          const { data: insts } = await supabase.from("installers").select("id").eq("division", division!);
          installerIds = (insts ?? []).map((i) => i.id);
          if (installerIds.length === 0) {
            return { content: [{ type: "text" as const, text: JSON.stringify({ reasons: [], total_items: 0 }, null, 2) }] };
          }
        }
      }

      let retQuery = supabase
        .from("equipment_returns")
        .select("installer_id, equipment_return_items(quantity, reason)");

      if (installerIds) retQuery = retQuery.in("installer_id", installerIds);
      if (date_from) retQuery = retQuery.gte("return_date", date_from);
      if (date_to) retQuery = retQuery.lte("return_date", date_to);

      const { data, error } = await retQuery;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      type RetItem = { quantity: number; reason: string };
      const reasonMap = new Map<string, number>();
      let totalItems = 0;
      (data ?? []).forEach((r) => {
        ((r.equipment_return_items as RetItem[]) ?? []).forEach((item) => {
          reasonMap.set(item.reason, (reasonMap.get(item.reason) ?? 0) + item.quantity);
          totalItems += item.quantity;
        });
      });

      const reasons = Array.from(reasonMap.entries())
        .map(([reason, count]) => ({
          reason,
          count,
          percentage: totalItems > 0 ? Math.round((count / totalItems) * 100) : 0,
        }))
        .sort((a, b) => b.count - a.count);

      return { content: [{ type: "text" as const, text: JSON.stringify({ reasons, total_items: totalItems }, null, 2) }] };
    }
  );

  server.tool(
    "get_top_returned_products",
    "מוצרים מוחזרים מובילים — Get top returned products by quantity",
    {
      date_from: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      date_to: z.string().optional().describe("End date (YYYY-MM-DD)"),
      division: z.string().optional().describe("Filter by division"),
      top_n: z.number().default(10).describe("Number of top products to return"),
    },
    async ({ date_from, date_to, division, top_n }) => {
      let installerIds: string[] | null = null;
      if (division) {
        const { data: insts } = await supabase.from("installers").select("id").eq("division", division);
        installerIds = (insts ?? []).map((i) => i.id);
        if (installerIds.length === 0) {
          return { content: [{ type: "text" as const, text: JSON.stringify([], null, 2) }] };
        }
      }

      let retQuery = supabase
        .from("equipment_returns")
        .select("installer_id, equipment_return_items(product_id, quantity)");

      if (installerIds) retQuery = retQuery.in("installer_id", installerIds);
      if (date_from) retQuery = retQuery.gte("return_date", date_from);
      if (date_to) retQuery = retQuery.lte("return_date", date_to);

      const { data, error } = await retQuery;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      type RetItem = { product_id: string; quantity: number };
      const productMap = new Map<string, number>();
      (data ?? []).forEach((r) => {
        ((r.equipment_return_items as RetItem[]) ?? []).forEach((item) => {
          productMap.set(item.product_id, (productMap.get(item.product_id) ?? 0) + item.quantity);
        });
      });

      const sorted = Array.from(productMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, top_n);

      // Resolve product names
      const productIds = sorted.map((s) => s[0]);
      const { data: products } = await supabase.from("products").select("id, name, sku").in("id", productIds);
      const nameMap = new Map((products ?? []).map((p) => [p.id, { name: p.name, sku: p.sku }]));

      const result = sorted.map(([pid, qty]) => ({
        product_id: pid,
        product_name: nameMap.get(pid)?.name ?? pid,
        product_sku: nameMap.get(pid)?.sku ?? "",
        total_returned: qty,
      }));

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_unchecked_return_items",
    "פריטים שלא נבדקו — Get return items that haven't been inspected yet (is_actually_faulty = null)",
    {
      installer_id: z.string().uuid().optional().describe("Filter by installer"),
      date_from: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      limit: z.number().default(50).describe("Max results"),
    },
    async ({ installer_id, date_from, limit }) => {
      let query = supabase
        .from("equipment_return_items")
        .select("*, products(name, sku), equipment_returns!inner(return_date, installer_id, installers(name, warehouse_number))")
        .is("is_actually_faulty", null)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (installer_id) query = query.eq("equipment_returns.installer_id", installer_id);
      if (date_from) query = query.gte("equipment_returns.return_date", date_from);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ═══════════════════════════════════════════════════════════════
  // Equipment Analytics — סטטיסטיקות הצטיידות
  // ═══════════════════════════════════════════════════════════════

  server.tool(
    "get_equipment_stats",
    "סטטיסטיקות הצטיידות — Get aggregated equipment stats (return rates by installer/division) for a date range",
    {
      date_from: z.string().optional().describe("Start date (YYYY-MM-DD), defaults to 30 days ago"),
      date_to: z.string().optional().describe("End date (YYYY-MM-DD), defaults to today"),
      division: z.string().optional().describe("Filter by division: 'AWACS' | 'כפתור' | 'DOORE'"),
    },
    async ({ date_from, date_to, division }) => {
      const now = new Date();
      const from = date_from || new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().split("T")[0];
      const to = date_to || now.toISOString().split("T")[0];

      let instQuery = supabase.from("installers").select("id, name, warehouse_number, division").eq("status", "פעיל");
      if (division) instQuery = instQuery.eq("division", division);
      const { data: installers } = await instQuery;

      const installerIds = (installers ?? []).map((i) => i.id);
      if (installerIds.length === 0) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ installers: [], totals: {} }, null, 2) }] };
      }

      const [pickupsRes, returnsRes] = await Promise.all([
        supabase
          .from("equipment_pickups")
          .select("installer_id, equipment_pickup_items(quantity)")
          .in("installer_id", installerIds)
          .gte("pickup_date", from)
          .lte("pickup_date", to),
        supabase
          .from("equipment_returns")
          .select("installer_id, equipment_return_items(quantity, is_actually_faulty)")
          .in("installer_id", installerIds)
          .gte("return_date", from)
          .lte("return_date", to),
      ]);

      type PickupData = { installer_id: string; equipment_pickup_items: { quantity: number }[] };
      type ReturnData = { installer_id: string; equipment_return_items: { quantity: number; is_actually_faulty: boolean | null }[] };

      const pickups = (pickupsRes.data ?? []) as PickupData[];
      const returns = (returnsRes.data ?? []) as ReturnData[];

      let grandTaken = 0, grandReturned = 0, grandWaste = 0;

      const perInstaller = (installers ?? []).map((inst) => {
        const taken = pickups
          .filter((p) => p.installer_id === inst.id)
          .reduce((sum, p) => sum + p.equipment_pickup_items.reduce((s, i) => s + i.quantity, 0), 0);
        const returned = returns
          .filter((r) => r.installer_id === inst.id)
          .reduce((sum, r) => sum + r.equipment_return_items.reduce((s, i) => s + i.quantity, 0), 0);
        const waste = returns
          .filter((r) => r.installer_id === inst.id)
          .reduce(
            (sum, r) =>
              sum + r.equipment_return_items.filter((i) => i.is_actually_faulty === false).reduce((s, i) => s + i.quantity, 0),
            0
          );
        grandTaken += taken;
        grandReturned += returned;
        grandWaste += waste;

        return {
          ...inst,
          items_taken: taken,
          items_returned: returned,
          return_percentage: taken > 0 ? Math.round((returned / taken) * 100) : 0,
          waste_count: waste,
        };
      }).sort((a, b) => b.return_percentage - a.return_percentage);

      const result = {
        period: { from, to },
        totals: {
          items_taken: grandTaken,
          items_returned: grandReturned,
          return_percentage: grandTaken > 0 ? Math.round((grandReturned / grandTaken) * 100) : 0,
          waste_count: grandWaste,
        },
        installers: perInstaller,
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
