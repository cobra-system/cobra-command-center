import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerShippingTools(server: McpServer) {
  // ── Shipment Groups ──────────────────────────────────────────────────────────

  server.tool(
    "create_shipment_group",
    "יצירת קבוצת משלוח — Create a shipment group to link multiple orders on the same vessel",
    {
      name: z.string().describe("Group name, e.g. 'MSC ISABELLA - March 2026'"),
      vessel_name: z.string().optional().describe("Vessel/ship name"),
      departure_date: z.string().optional().describe("ETD from origin port (YYYY-MM-DD)"),
      arrival_date: z.string().optional().describe("ETA at destination port (YYYY-MM-DD)"),
      booking_number: z.string().optional().describe("Shared booking/BL number for the whole shipment"),
      tclog_reference: z.string().optional().describe("tclog reference for the shipment"),
      notes: z.string().optional().describe("Additional notes"),
    },
    async ({ name, vessel_name, departure_date, arrival_date, booking_number, tclog_reference, notes }) => {
      const { data, error } = await supabase
        .from("shipment_groups")
        .insert({
          name,
          vessel_name: vessel_name || null,
          departure_date: departure_date || null,
          arrival_date: arrival_date || null,
          booking_number: booking_number || null,
          tclog_reference: tclog_reference || null,
          notes: notes || null,
        })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Shipment group created:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "list_shipment_groups",
    "רשימת קבוצות משלוח — List shipment groups with linked orders",
    {
      limit: z.number().default(20).describe("Max results"),
    },
    async ({ limit }) => {
      const { data: groups, error } = await supabase
        .from("shipment_groups")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      // For each group, fetch linked orders
      const groupsWithOrders = await Promise.all(
        (groups || []).map(async (group: Record<string, unknown>) => {
          const { data: orders } = await supabase
            .from("orders")
            .select("id, supplier_name, status, total_price, pi_number, eta")
            .eq("shipment_group_id", group.id as string);
          return { ...group, orders: orders || [] };
        })
      );

      return { content: [{ type: "text" as const, text: JSON.stringify(groupsWithOrders, null, 2) }] };
    }
  );

  server.tool(
    "get_shipment_group",
    "פרטי קבוצת משלוח — Get a shipment group with all linked orders",
    {
      id: z.string().uuid().describe("Shipment group UUID"),
    },
    async ({ id }) => {
      const [groupRes, ordersRes] = await Promise.all([
        supabase.from("shipment_groups").select("*").eq("id", id).single(),
        supabase.from("orders").select("*, order_payments(*)").eq("shipment_group_id", id),
      ]);

      if (groupRes.error) return { content: [{ type: "text" as const, text: `Error: ${groupRes.error.message}` }] };

      const result = {
        ...groupRes.data,
        orders: ordersRes.data || [],
        total_value: (ordersRes.data || []).reduce(
          (sum: number, o: Record<string, unknown>) => sum + (Number(o.total_price) || 0), 0
        ),
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "link_order_to_shipment",
    "קישור הזמנות לקבוצת משלוח — Link one or more orders to a shipment group",
    {
      shipment_group_id: z.string().uuid().describe("Shipment group UUID"),
      order_ids: z.array(z.string().uuid()).describe("Array of order UUIDs to link"),
    },
    async ({ shipment_group_id, order_ids }) => {
      const { data, error } = await supabase
        .from("orders")
        .update({ shipment_group_id })
        .in("id", order_ids)
        .select("id, supplier_name, status, pi_number");

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      return {
        content: [{
          type: "text" as const,
          text: `Linked ${(data || []).length} orders to shipment group:\n${JSON.stringify(data, null, 2)}`,
        }],
      };
    }
  );

  server.tool(
    "update_shipment_group",
    "עדכון קבוצת משלוח — Update shipment group details (vessel, dates, booking)",
    {
      id: z.string().uuid().describe("Shipment group UUID"),
      name: z.string().optional().describe("Group name"),
      vessel_name: z.string().optional().describe("Vessel/ship name"),
      departure_date: z.string().optional().describe("ETD (YYYY-MM-DD)"),
      arrival_date: z.string().optional().describe("ETA (YYYY-MM-DD)"),
      booking_number: z.string().optional().describe("Booking/BL number"),
      tclog_reference: z.string().optional().describe("tclog reference"),
      notes: z.string().optional().describe("Notes"),
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
        .from("shipment_groups")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Shipment group updated:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  // ── DHL Tracking ─────────────────────────────────────────────────────────────

  server.tool(
    "track_shipment_dhl",
    "מעקב משלוח DHL — Track a DHL shipment using the DHL Shipment Tracking API v2",
    {
      tracking_number: z.string().describe("DHL tracking number (waybill number)"),
    },
    async ({ tracking_number }) => {
      const apiKey = process.env.DHL_API_KEY;

      if (!apiKey) {
        return {
          content: [{
            type: "text" as const,
            text: [
              "⚠️  DHL_API_KEY environment variable is not set.",
              "",
              "To enable DHL tracking:",
              "1. Register at https://developer.dhl.com/",
              "2. Create an app and subscribe to 'Shipment Tracking' API",
              "3. Add DHL_API_KEY to the 'env' section in .mcp.json:",
              '   "DHL_API_KEY": "your-api-key-here"',
              "",
              `Tracking number provided: ${tracking_number}`,
              "You can track manually at: https://www.dhl.com/il-en/home/tracking.html",
            ].join("\n"),
          }],
        };
      }

      try {
        const url = `https://api.dhl.com/track/shipments?trackingNumber=${encodeURIComponent(tracking_number)}`;
        const response = await fetch(url, {
          headers: {
            "DHL-API-Key": apiKey,
            "Accept": "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          return {
            content: [{
              type: "text" as const,
              text: `DHL API error (${response.status}): ${errorText}`,
            }],
          };
        }

        const json = await response.json() as Record<string, unknown>;
        const shipments = (json.shipments as Record<string, unknown>[]) || [];

        if (shipments.length === 0) {
          return { content: [{ type: "text" as const, text: `No DHL shipment found for tracking number: ${tracking_number}` }] };
        }

        const shipment = shipments[0];
        const events = (shipment.events as Record<string, unknown>[]) || [];
        const latestEvent = events[0];
        const status = (shipment.status as Record<string, unknown>) || {};
        const estimatedDelivery = (shipment.estimatedTimeOfDelivery as string) || null;

        const summary = {
          tracking_number,
          current_status: status.description || status.status,
          location: (latestEvent?.location as Record<string, unknown>)?.address,
          latest_event: latestEvent?.description,
          latest_event_time: latestEvent?.timestamp,
          estimated_delivery: estimatedDelivery,
          total_events: events.length,
          recent_events: events.slice(0, 5).map((e: Record<string, unknown>) => ({
            time: e.timestamp,
            location: (e.location as Record<string, unknown>)?.address,
            description: e.description,
          })),
        };

        return { content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }] };
      } catch (err) {
        return {
          content: [{
            type: "text" as const,
            text: `Failed to connect to DHL API: ${err instanceof Error ? err.message : String(err)}`,
          }],
        };
      }
    }
  );

  server.tool(
    "update_order_eta_from_dhl",
    "עדכון ETA מ-DHL — Fetch DHL ETA and propose update (dry_run=true by default — does NOT save without confirmation)",
    {
      order_id: z.string().uuid().describe("Order UUID to update"),
      tracking_number: z.string().describe("DHL tracking number"),
      dry_run: z.boolean().default(true).describe(
        "Default true — returns the proposed ETA change WITHOUT saving. " +
        "Set to false to actually update the order. " +
        "Always review the proposed change before setting dry_run=false."
      ),
    },
    async ({ order_id, tracking_number, dry_run }) => {
      const apiKey = process.env.DHL_API_KEY;

      if (!apiKey) {
        return {
          content: [{
            type: "text" as const,
            text: "DHL_API_KEY not configured. See track_shipment_dhl for setup instructions.",
          }],
        };
      }

      try {
        const url = `https://api.dhl.com/track/shipments?trackingNumber=${encodeURIComponent(tracking_number)}`;
        const response = await fetch(url, {
          headers: { "DHL-API-Key": apiKey, "Accept": "application/json" },
        });

        if (!response.ok) {
          return { content: [{ type: "text" as const, text: `DHL API error (${response.status})` }] };
        }

        const json = await response.json() as Record<string, unknown>;
        const shipments = (json.shipments as Record<string, unknown>[]) || [];

        if (shipments.length === 0) {
          return { content: [{ type: "text" as const, text: `No DHL data found for tracking number: ${tracking_number}` }] };
        }

        const dhlEta = shipments[0].estimatedTimeOfDelivery as string | null;
        const dhlStatus = ((shipments[0].status as Record<string, unknown>)?.description as string) || "";
        const dhlEvents = (shipments[0].events as Record<string, unknown>[]) || [];
        const latestEvent = dhlEvents[0];

        if (!dhlEta) {
          return { content: [{ type: "text" as const, text: `DHL has no estimated delivery date for ${tracking_number}.\nCurrent status: ${dhlStatus}` }] };
        }

        const newEta = dhlEta.split("T")[0];

        const { data: currentOrder } = await supabase.from("orders").select("eta, notes, supplier_name, pi_number").eq("id", order_id).single();
        const oldEta = currentOrder?.eta ? (currentOrder.eta as string).split("T")[0] : null;

        const proposal = {
          order_id,
          supplier: currentOrder?.supplier_name,
          pi_number: currentOrder?.pi_number,
          current_eta_in_cobra: oldEta || "not set",
          dhl_proposed_eta: newEta,
          eta_changed: oldEta !== newEta,
          dhl_status: dhlStatus,
          dhl_latest_event: latestEvent ? {
            time: latestEvent.timestamp,
            location: (latestEvent.location as Record<string, unknown>)?.address,
            description: latestEvent.description,
          } : null,
        };

        if (!proposal.eta_changed) {
          return {
            content: [{
              type: "text" as const,
              text: `✅ ETA unchanged: ${newEta}\nDHL status: ${dhlStatus}\n\nNo update needed.`,
            }],
          };
        }

        // DRY RUN: return proposal without saving
        if (dry_run) {
          return {
            content: [{
              type: "text" as const,
              text: [
                "🔍 DRY RUN — no changes saved.",
                "",
                `Proposed ETA change:`,
                `  Current ETA in COBRA: ${oldEta || "not set"}`,
                `  DHL proposed ETA:     ${newEta}`,
                `  DHL status:           ${dhlStatus}`,
                "",
                "To apply this update, call again with dry_run=false:",
                `  update_order_eta_from_dhl(order_id="${order_id}", tracking_number="${tracking_number}", dry_run=false)`,
                "",
                "Full proposal:",
                JSON.stringify(proposal, null, 2),
              ].join("\n"),
            }],
          };
        }

        // APPLY: save old notes to history and update ETA
        if (currentOrder) {
          await supabase.from("order_notes_history").insert({
            order_id,
            note_text: currentOrder.notes as string | null,
            changed_at: new Date().toISOString(),
            change_reason: `ETA updated from DHL tracking: ${oldEta} → ${newEta}`,
          });
        }

        const { data: updatedOrder, error } = await supabase
          .from("orders")
          .update({
            eta: newEta,
            tracking_number,
            notes: `${(currentOrder?.notes as string) || ""}\n[${new Date().toISOString().split("T")[0]}] DHL ETA updated: ${newEta} (was: ${oldEta || "not set"}). Status: ${dhlStatus}`.trim(),
          })
          .eq("id", order_id)
          .select()
          .single();

        if (error) return { content: [{ type: "text" as const, text: `Error updating order: ${error.message}` }] };

        return {
          content: [{
            type: "text" as const,
            text: `✅ Order ETA updated from DHL:\n  Old ETA: ${oldEta || "not set"}\n  New ETA: ${newEta}\n  DHL Status: ${dhlStatus}\n\nUpdated order:\n${JSON.stringify(updatedOrder, null, 2)}`,
          }],
        };
      } catch (err) {
        return {
          content: [{
            type: "text" as const,
            text: `Failed to connect to DHL API: ${err instanceof Error ? err.message : String(err)}`,
          }],
        };
      }
    }
  );

  // ── MSC Vessel Tracking (stub) ───────────────────────────────────────────────

  server.tool(
    "track_vessel_msc",
    "מעקב אוניית MSC — Get MSC vessel tracking instructions (MSC has no public API)",
    {
      vessel_name: z.string().optional().describe("Vessel name (e.g. MSC ISABELLA)"),
      booking_number: z.string().optional().describe("MSC booking or BL number"),
    },
    async ({ vessel_name, booking_number }) => {
      const lines: string[] = [
        "ℹ️  MSC does not provide a public tracking API.",
        "",
        "To track an MSC shipment, use one of these methods:",
        "",
        "1. MSC Website (requires login):",
        "   https://www.msc.com/track-a-shipment",
        "",
        "2. Via tclog (freight forwarder):",
        "   Contact tclog directly — they have access to MSC's system",
        "   and can provide a live status update.",
        "",
        "3. Via VesselFinder (public, no login):",
        "   https://www.vesselfinder.com/",
        "   Search by vessel name to see current position.",
        "",
      ];

      if (vessel_name) {
        lines.push(`Vessel name provided: ${vessel_name}`);
        lines.push(`VesselFinder search URL: https://www.vesselfinder.com/?name=${encodeURIComponent(vessel_name)}`);
      }
      if (booking_number) {
        lines.push(`\nBooking/BL number provided: ${booking_number}`);
        lines.push("Use this number on the MSC website or send it to tclog for status.");
      }

      lines.push("");
      lines.push("Note: When MSC/tclog provides an API key in the future, set MSC_API_KEY in .mcp.json to enable automatic tracking.");

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );

  // ── Bank SWIFT Correlation (stub) ────────────────────────────────────────────

  server.tool(
    "find_swift_for_order",
    "חיפוש SWIFT להזמנה — Match a SWIFT bank transfer to an order (stub — awaiting Bank Leumi API)",
    {
      order_id: z.string().uuid().optional().describe("Order UUID to match against"),
      amount: z.number().optional().describe("Payment amount to search for"),
      supplier_name: z.string().optional().describe("Supplier/beneficiary name"),
      date_from: z.string().optional().describe("Search from date (YYYY-MM-DD)"),
      date_to: z.string().optional().describe("Search to date (YYYY-MM-DD)"),
    },
    async ({ order_id, amount, supplier_name, date_from, date_to }) => {
      const lines: string[] = [
        "ℹ️  Bank Leumi does not currently provide a public API for transaction lookup.",
        "",
        "To correlate a SWIFT transfer with an order:",
        "",
        "1. Search in Bank Leumi Online:",
        "   Filter by date range and amount to find the wire transfer.",
        "   The SWIFT reference appears in the transaction details.",
        "",
        "2. Once you find the SWIFT reference, record it in COBRA:",
        "   Use the update_order_payment tool with the swift_reference field.",
        "",
        "3. Or use match_swift_to_payment to search existing order_payments by amount.",
        "",
      ];

      if (order_id || amount || supplier_name) {
        lines.push("Search parameters provided:");
        if (order_id) lines.push(`  Order ID: ${order_id}`);
        if (amount) lines.push(`  Amount: ${amount}`);
        if (supplier_name) lines.push(`  Supplier: ${supplier_name}`);
        if (date_from) lines.push(`  From: ${date_from}`);
        if (date_to) lines.push(`  To: ${date_to}`);
        lines.push("");
      }

      // Search existing order_payments for a possible match
      if (amount || order_id) {
        let query = supabase
          .from("order_payments")
          .select("id, order_id, payment_type, amount, currency, due_date, swift_reference, status")
          .eq("status", "ממתין");

        if (order_id) query = query.eq("order_id", order_id);
        if (amount) {
          // Match within 1% tolerance
          const tolerance = amount * 0.01;
          query = query.gte("amount", amount - tolerance).lte("amount", amount + tolerance);
        }

        const { data: matches } = await query;

        if (matches && matches.length > 0) {
          lines.push("Possible matches in COBRA order_payments:");
          lines.push(JSON.stringify(matches, null, 2));
          lines.push("");
          lines.push("If this is the correct payment, use update_order_payment to add the swift_reference.");
        } else {
          lines.push("No matching pending order_payments found in COBRA.");
        }
      }

      lines.push("Note: When Bank Leumi API access is available, set BANK_LEUMI_API_KEY and BANK_LEUMI_ACCOUNT_ID in .mcp.json for automatic correlation.");

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );
}
