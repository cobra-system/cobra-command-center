import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerWasteTools(server: McpServer) {
  // ═══════════════════════════════════════════════════════════════
  // Waste Items
  // ═══════════════════════════════════════════════════════════════

  server.tool(
    "list_waste_items",
    "List waste items with optional filters. Supports filtering by status, product, source, and creator. Note: the search param is accepted but not applied (waste_items has no denormalized product_name column — filter by product_id instead).",
    {
      status: z
        .enum(["pending", "destroyed", "returning", "repairing", "sold"])
        .optional()
        .describe("Filter by item status"),
      product_id: z
        .string()
        .uuid()
        .optional()
        .describe("Filter by product UUID"),
      source: z
        .enum(["manual", "equipment_return"])
        .optional()
        .describe("Filter by source"),
      created_by: z
        .string()
        .uuid()
        .optional()
        .describe("Filter by creator user UUID"),
      search: z
        .string()
        .optional()
        .describe("Accepted but not applied — filter by product_id instead"),
      limit: z
        .number()
        .int()
        .default(100)
        .describe("Max results (default 100)"),
    },
    async ({ status, product_id, source, created_by, limit }) => {
      let query = supabase
        .from("waste_items")
        .select("*, products(name, sku), profiles!repair_technician_id(name)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (status) query = query.eq("status", status);
      if (product_id) query = query.eq("product_id", product_id);
      if (source) query = query.eq("source", source);
      if (created_by) query = query.eq("created_by", created_by);

      const { data, error } = await query;
      if (error)
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
        };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "create_waste_item",
    "Create a new manual waste item entry. Source is always set to 'manual' and status to 'pending'.",
    {
      product_id: z.string().uuid().describe("UUID of the linked product (required)"),
      quantity: z.number().int().min(1).default(1).describe("Quantity (default 1)"),
      condition_notes: z
        .string()
        .optional()
        .describe("Notes on the item's condition"),
      created_by: z
        .string()
        .uuid()
        .optional()
        .describe("UUID of the creating user"),
      created_by_name: z
        .string()
        .optional()
        .describe("Display name of the creating user"),
    },
    async ({ product_id, quantity, condition_notes, created_by, created_by_name }) => {
      const { data, error } = await supabase
        .from("waste_items")
        .insert({
          product_id,
          quantity,
          condition_notes: condition_notes ?? null,
          status: "pending",
          source: "manual",
          created_by: created_by ?? null,
          created_by_name: created_by_name ?? null,
        })
        .select("*, products(name, sku)")
        .single();

      if (error)
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
        };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "update_waste_item",
    "Update any field on a waste item. Only provided (non-undefined) fields are applied.",
    {
      id: z.string().uuid().describe("Waste item UUID (required)"),
      quantity: z.number().int().min(1).optional().describe("Updated quantity"),
      condition_notes: z.string().nullish().describe("Updated condition notes"),
      status: z
        .enum(["pending", "destroyed", "returning", "repairing", "sold"])
        .optional()
        .describe("Updated status"),
      destruction_date: z.string().optional().describe("ISO date of destruction"),
      destruction_certificate_url: z.string().nullish().describe("URL of destruction certificate"),
      repair_technician_id: z.string().uuid().nullish().describe("UUID of assigned repair technician"),
      repair_expected_date: z.string().nullish().describe("Expected repair completion date (ISO)"),
      repair_completed_date: z.string().nullish().describe("Actual repair completion date (ISO)"),
      sale_buyer: z.string().nullish().describe("Buyer name for sale"),
      sale_price: z.number().nullish().describe("Sale price"),
      sale_date: z.string().nullish().describe("Sale date (ISO)"),
    },
    async ({ id, ...fields }) => {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const [k, v] of Object.entries(fields)) {
        if (v !== undefined) updates[k] = v;
      }

      const { data, error } = await supabase
        .from("waste_items")
        .update(updates)
        .eq("id", id)
        .select("*, products(name, sku), profiles!repair_technician_id(name)")
        .single();

      if (error)
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
        };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "delete_waste_item",
    "Soft-delete a waste item (sets deleted_at). Also removes the item from any waste_return_items junction rows.",
    {
      id: z.string().uuid().describe("Waste item UUID"),
    },
    async ({ id }) => {
      // Remove from any return junction first (hard delete from junction)
      const { error: junctionErr } = await supabase
        .from("waste_return_items")
        .delete()
        .eq("waste_item_id", id);

      if (junctionErr)
        return {
          content: [
            {
              type: "text" as const,
              text: `Error removing from return: ${junctionErr.message}`,
            },
          ],
        };

      const { error } = await supabase
        .from("waste_items")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

      if (error)
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
        };
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ success: true, deleted_id: id }),
          },
        ],
      };
    }
  );

  server.tool(
    "set_waste_destroyed",
    "Mark a waste item as destroyed. Sets status to 'destroyed', records the destruction date, and optionally saves the certificate URL.",
    {
      id: z.string().uuid().describe("Waste item UUID"),
      destruction_date: z.string().describe("Date of destruction (ISO date)"),
      destruction_certificate_url: z
        .string()
        .optional()
        .describe("URL to the destruction certificate document"),
    },
    async ({ id, destruction_date, destruction_certificate_url }) => {
      const { data, error } = await supabase
        .from("waste_items")
        .update({
          status: "destroyed",
          destruction_date,
          destruction_certificate_url: destruction_certificate_url ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error)
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
        };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "set_waste_repaired",
    "Mark a waste item's repair as complete. Sets status back to 'pending' (ready for re-disposition) and records the completion date.",
    {
      id: z.string().uuid().describe("Waste item UUID"),
      repair_completed_date: z
        .string()
        .describe("Actual repair completion date (ISO date)"),
    },
    async ({ id, repair_completed_date }) => {
      const { data, error } = await supabase
        .from("waste_items")
        .update({
          status: "pending",
          repair_completed_date,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error)
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
        };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "set_waste_sold",
    "Mark a waste item as sold. Sets status to 'sold' and records buyer, price, and sale date.",
    {
      id: z.string().uuid().describe("Waste item UUID"),
      sale_buyer: z.string().describe("Name of the buyer"),
      sale_price: z
        .number()
        .optional()
        .describe("Sale price (optional)"),
      sale_date: z.string().describe("Date of sale (ISO date)"),
    },
    async ({ id, sale_buyer, sale_price, sale_date }) => {
      const { data, error } = await supabase
        .from("waste_items")
        .update({
          status: "sold",
          sale_buyer,
          sale_price: sale_price ?? null,
          sale_date,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error)
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
        };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  // ═══════════════════════════════════════════════════════════════
  // Supplier Returns
  // ═══════════════════════════════════════════════════════════════

  server.tool(
    "list_waste_returns",
    "List waste supplier returns with optional filters. Includes supplier name and a count of linked waste items.",
    {
      status: z
        .enum(["draft", "shipped", "delivered", "settled"])
        .optional()
        .describe("Filter by return status"),
      supplier_id: z
        .string()
        .uuid()
        .optional()
        .describe("Filter by supplier UUID"),
      limit: z
        .number()
        .int()
        .default(50)
        .describe("Max results (default 50)"),
    },
    async ({ status, supplier_id, limit }) => {
      let query = supabase
        .from("waste_supplier_returns")
        .select("*, suppliers(company), waste_return_items(count)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (status) query = query.eq("status", status);
      if (supplier_id) query = query.eq("supplier_id", supplier_id);

      const { data, error } = await query;
      if (error)
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
        };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "create_waste_return",
    "Create a new supplier return, optionally linking existing waste items. Linked items are updated to status 'returning'.",
    {
      supplier_id: z.string().uuid().describe("Supplier UUID (required)"),
      return_reason: z.string().optional().describe("Reason for the return"),
      tracking_number: z
        .string()
        .optional()
        .describe("Shipping tracking number"),
      notes: z.string().optional().describe("Additional notes"),
      waste_item_ids: z
        .array(z.string().uuid())
        .optional()
        .describe("Waste item UUIDs to include in this return"),
      created_by: z
        .string()
        .uuid()
        .optional()
        .describe("UUID of the creating user"),
      created_by_name: z
        .string()
        .optional()
        .describe("Display name of the creating user"),
    },
    async ({
      supplier_id,
      return_reason,
      tracking_number,
      notes,
      waste_item_ids,
      created_by,
      created_by_name,
    }) => {
      // Step 1: Create the return record
      const { data: ret, error: retErr } = await supabase
        .from("waste_supplier_returns")
        .insert({
          supplier_id,
          return_reason: return_reason ?? null,
          tracking_number: tracking_number ?? null,
          notes: notes ?? null,
          created_by: created_by ?? null,
          created_by_name: created_by_name ?? null,
        })
        .select()
        .single();

      if (retErr)
        return {
          content: [{ type: "text" as const, text: `Error creating return: ${retErr.message}` }],
        };

      // Step 2: Link waste items if provided
      if (waste_item_ids && waste_item_ids.length > 0) {
        const junctionRows = waste_item_ids.map((waste_item_id) => ({
          return_id: ret.id,
          waste_item_id,
        }));

        const { error: junctionErr } = await supabase
          .from("waste_return_items")
          .insert(junctionRows);

        if (junctionErr)
          return {
            content: [
              {
                type: "text" as const,
                text: `Return created (id: ${ret.id}) but failed to link items: ${junctionErr.message}`,
              },
            ],
          };

        const { error: itemErr } = await supabase
          .from("waste_items")
          .update({ status: "returning", updated_at: new Date().toISOString() })
          .in("id", waste_item_ids);

        if (itemErr)
          return {
            content: [
              {
                type: "text" as const,
                text: `Return created and items linked but failed to update item statuses: ${itemErr.message}`,
              },
            ],
          };
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(ret, null, 2) }],
      };
    }
  );

  server.tool(
    "update_waste_return",
    "Update fields on an existing supplier return. Only provided (non-undefined) fields are applied.",
    {
      id: z.string().uuid().describe("Return UUID (required)"),
      tracking_number: z.string().optional().describe("Updated tracking number"),
      tracking_carrier: z.enum(["dhl", "other"]).optional().describe("Shipping carrier"),
      return_reason: z.string().optional().describe("Updated return reason"),
      settlement_type: z.enum(["rma", "credit"]).optional().describe("Settlement type (rma or credit)"),
      rma_expected_return_date: z.string().optional().describe("Expected date for RMA return (ISO date)"),
      credit_amount: z.number().optional().describe("Credit amount if settlement_type is credit"),
      notes: z.string().optional().describe("Updated notes"),
    },
    async ({ id, ...fields }) => {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const [k, v] of Object.entries(fields)) {
        if (v !== undefined) updates[k] = v;
      }

      const { data, error } = await supabase
        .from("waste_supplier_returns")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error)
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
        };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "advance_waste_return_status",
    "Advance a supplier return to its next status stage: draft→shipped→delivered→settled. Validation: draft→shipped requires an existing tracking_number on the record; delivered→settled requires settlement_type.",
    {
      id: z.string().uuid().describe("Return UUID"),
      settlement_type: z
        .enum(["rma", "credit"])
        .optional()
        .describe("Required when advancing to 'settled'"),
      credit_amount: z
        .number()
        .optional()
        .describe("Credit amount (used when settlement_type is credit)"),
      rma_expected_return_date: z
        .string()
        .optional()
        .describe("Expected RMA return date (used when settlement_type is rma)"),
    },
    async ({ id, settlement_type, credit_amount, rma_expected_return_date }) => {
      const { data: current, error: fetchErr } = await supabase
        .from("waste_supplier_returns")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchErr)
        return {
          content: [{ type: "text" as const, text: `Error fetching return: ${fetchErr.message}` }],
        };

      const transitions: Record<string, string> = {
        draft: "shipped",
        shipped: "delivered",
        delivered: "settled",
      };

      const nextStatus = transitions[current.status];
      if (!nextStatus)
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: Cannot advance from status '${current.status}' — already at terminal state.`,
            },
          ],
        };

      // Validation gates
      if (nextStatus === "shipped" && !current.tracking_number)
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: tracking_number is required before advancing to 'shipped'. Update the return with a tracking_number first.",
            },
          ],
        };

      if (nextStatus === "settled" && !settlement_type)
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: settlement_type ('rma' or 'credit') is required to advance to 'settled'.",
            },
          ],
        };

      const updates: Record<string, unknown> = {
        status: nextStatus,
        updated_at: new Date().toISOString(),
      };

      if (nextStatus === "settled") {
        if (settlement_type) updates.settlement_type = settlement_type;
        if (credit_amount !== undefined) updates.credit_amount = credit_amount;
        if (rma_expected_return_date !== undefined)
          updates.rma_expected_return_date = rma_expected_return_date;
      }

      const { data, error } = await supabase
        .from("waste_supplier_returns")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error)
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
        };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "add_items_to_waste_return",
    "Add waste items to an existing supplier return. Duplicate entries are silently ignored. All added items are updated to status 'returning'.",
    {
      return_id: z.string().uuid().describe("Return UUID"),
      waste_item_ids: z
        .array(z.string().uuid())
        .min(1)
        .describe("Waste item UUIDs to add to the return"),
    },
    async ({ return_id, waste_item_ids }) => {
      const junctionRows = waste_item_ids.map((waste_item_id) => ({
        return_id,
        waste_item_id,
      }));

      const { error: junctionErr } = await supabase
        .from("waste_return_items")
        .upsert(junctionRows, { onConflict: "waste_item_id", ignoreDuplicates: true });

      if (junctionErr)
        return {
          content: [
            { type: "text" as const, text: `Error linking items: ${junctionErr.message}` },
          ],
        };

      const { error: itemErr } = await supabase
        .from("waste_items")
        .update({ status: "returning", updated_at: new Date().toISOString() })
        .in("id", waste_item_ids);

      if (itemErr)
        return {
          content: [
            {
              type: "text" as const,
              text: `Items linked to return but failed to update statuses: ${itemErr.message}`,
            },
          ],
        };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              return_id,
              added_item_ids: waste_item_ids,
            }),
          },
        ],
      };
    }
  );

  server.tool(
    "delete_waste_return",
    "Soft-delete a supplier return (sets deleted_at). All linked waste items are reverted to status 'pending' and removed from the junction table.",
    {
      id: z.string().uuid().describe("Return UUID"),
    },
    async ({ id }) => {
      // Fetch linked waste item IDs so we can update their statuses
      const { data: junctionRows, error: fetchErr } = await supabase
        .from("waste_return_items")
        .select("waste_item_id")
        .eq("return_id", id);

      if (fetchErr)
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching linked items: ${fetchErr.message}`,
            },
          ],
        };

      const linkedItemIds = (junctionRows ?? []).map(
        (r: { waste_item_id: string }) => r.waste_item_id
      );

      // Revert item statuses back to pending
      if (linkedItemIds.length > 0) {
        const { error: itemErr } = await supabase
          .from("waste_items")
          .update({ status: "pending", updated_at: new Date().toISOString() })
          .in("id", linkedItemIds);

        if (itemErr)
          return {
            content: [
              {
                type: "text" as const,
                text: `Error reverting item statuses: ${itemErr.message}`,
              },
            ],
          };
      }

      // Remove junction rows
      const { error: junctionDelErr } = await supabase
        .from("waste_return_items")
        .delete()
        .eq("return_id", id);

      if (junctionDelErr)
        return {
          content: [
            {
              type: "text" as const,
              text: `Error removing junction rows: ${junctionDelErr.message}`,
            },
          ],
        };

      // Soft-delete the return
      const { error } = await supabase
        .from("waste_supplier_returns")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

      if (error)
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
        };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              deleted_id: id,
              reverted_item_ids: linkedItemIds,
            }),
          },
        ],
      };
    }
  );
}
