import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

/**
 * Import files (תיקי יבוא) — the customs-broker dossier for one shipment.
 *
 * Tables: import_files, import_file_orders, import_cost_lines, and the
 * purchase_documents rows carrying import_file_id.
 *
 * Two rules govern the money and both are easy to get wrong:
 *   - Recoverable VAT is paid then reclaimed, so it never enters landed cost.
 *   - A forwarder's summary invoice restates its freight and terminal invoices;
 *     lines marked included_in_document_id must not be counted again.
 * get_import_file_costs applies both rather than leaving it to the caller.
 */

const COST_CATEGORIES = [
  "freight", "origin", "terminal", "customs_duty", "vat",
  "clearance", "inland", "storage", "insurance", "fees", "other",
] as const;

const DOC_SUBTYPES = [
  "COMMERCIAL_INVOICE", "PACKING_LIST", "BL", "DECLARATION",
  "FREIGHT_INVOICE", "TERMINAL_INVOICE", "FORWARDER_INVOICE",
  "INSURANCE", "CERTIFICATE_OF_ORIGIN", "OTHER",
] as const;

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const fail = (message: string) => text(`Error: ${message}`);

/** A line's ILS value, or null when it is foreign currency and unconverted. */
function amountIls(line: { amount: number; amount_ils: number | null; currency: string }): number | null {
  if (line.amount_ils !== null && line.amount_ils !== undefined) return Number(line.amount_ils);
  if (line.currency === "ILS") return Number(line.amount);
  return null;
}

export function registerImportFileTools(server: McpServer) {
  server.tool(
    "create_import_file",
    "יצירת תיק יבוא — Create an import dossier (customs broker file) for a shipment",
    {
      file_number: z.string().describe("Forwarder's file number, e.g. 460509 — appears on every document in the dossier"),
      forwarder_name: z.string().optional().describe("Forwarder / customs broker, e.g. Total Care Logistics"),
      shipment_mode: z.enum(["SEA", "AIR", "LAND", "COURIER"]).default("SEA").describe("Shipment mode"),
      declaration_number: z.string().optional().describe("Customs declaration number (מספר רשימון)"),
      declaration_date: z.string().optional().describe("Declaration date (YYYY-MM-DD)"),
      bl_number: z.string().optional().describe("Master bill of lading / AWB number"),
      house_bl_number: z.string().optional().describe("House bill of lading number"),
      container_number: z.string().optional().describe("Container number, e.g. YMMU6158726"),
      vessel_name: z.string().optional().describe("Vessel or flight name, e.g. YM WISH"),
      port_of_loading: z.string().optional().describe("Port of loading"),
      port_of_discharge: z.string().optional().describe("Port of discharge"),
      etd: z.string().optional().describe("Departure date (YYYY-MM-DD)"),
      arrival_date: z.string().optional().describe("Arrival date (YYYY-MM-DD)"),
      release_date: z.string().optional().describe("Customs release date (YYYY-MM-DD)"),
      supplier_id: z.string().uuid().optional().describe("Matched Cobra supplier UUID"),
      supplier_name: z.string().optional().describe("Supplier name as printed on the documents"),
      supplier_invoice_number: z.string().optional().describe("Supplier invoice / PI number"),
      goods_value: z.number().optional().describe("Goods value in the supplier's currency"),
      goods_currency: z.enum(["USD", "EUR", "ILS"]).default("USD").describe("Goods currency"),
      exchange_rate: z.number().optional().describe("Exchange rate fixed by the customs declaration"),
      customs_value_ils: z.number().optional().describe("Customs value in ILS (ערך לצרכי מס)"),
      gross_weight_kg: z.number().optional().describe("Gross weight in kg"),
      volume_cbm: z.number().optional().describe("Volume in CBM"),
      package_count: z.number().int().optional().describe("Number of packages"),
      order_id: z.string().uuid().optional().describe("Order to link the dossier to on creation"),
      notes: z.string().optional().describe("Free-text notes"),
    },
    async ({ order_id, ...fields }) => {
      const { data, error } = await supabase
        .from("import_files")
        .insert({ ...fields, status: order_id ? "matched" : "draft" })
        .select()
        .single();

      if (error) {
        return fail(
          error.code === "23505"
            ? `An import file numbered ${fields.file_number} already exists for forwarder ${fields.forwarder_name ?? "(none)"}`
            : error.message
        );
      }

      if (order_id) {
        const { error: linkError } = await supabase.from("import_file_orders").insert({
          import_file_id: data.id,
          order_id,
          matched_by: "manual",
          match_reason: "created via MCP with order_id",
        });
        if (linkError) {
          return text(`Import file created (${data.id}) but linking to the order failed: ${linkError.message}`);
        }
      }

      return text(`Import file created:\n${JSON.stringify(data, null, 2)}`);
    }
  );

  server.tool(
    "list_import_files",
    "רשימת תיקי יבוא — List import dossiers, filtered by any shipment identifier",
    {
      search: z.string().optional().describe("Match file number, declaration, container, B/L, vessel or supplier invoice"),
      order_id: z.string().uuid().optional().describe("Only dossiers linked to this order"),
      supplier_id: z.string().uuid().optional().describe("Filter by supplier UUID"),
      status: z.enum(["draft", "matched", "complete"]).optional().describe("Filter by dossier status"),
      limit: z.number().default(50).describe("Max results"),
    },
    async ({ search, order_id, supplier_id, status, limit }) => {
      let fileIds: string[] | null = null;

      if (order_id) {
        const { data: links, error } = await supabase
          .from("import_file_orders")
          .select("import_file_id")
          .eq("order_id", order_id);
        if (error) return fail(error.message);
        fileIds = (links ?? []).map(l => l.import_file_id);
        if (fileIds.length === 0) return text("No import files linked to that order.");
      }

      let query = supabase
        .from("import_files")
        .select("*")
        .is("deleted_at", null)
        .order("arrival_date", { ascending: false, nullsFirst: false })
        .limit(limit);

      if (fileIds) query = query.in("id", fileIds);
      if (supplier_id) query = query.eq("supplier_id", supplier_id);
      if (status) query = query.eq("status", status);
      if (search) {
        query = query.or(
          [
            `file_number.ilike.%${search}%`,
            `declaration_number.ilike.%${search}%`,
            `container_number.ilike.%${search}%`,
            `bl_number.ilike.%${search}%`,
            `house_bl_number.ilike.%${search}%`,
            `vessel_name.ilike.%${search}%`,
            `supplier_invoice_number.ilike.%${search}%`,
          ].join(",")
        );
      }

      const { data, error } = await query;
      if (error) return fail(error.message);
      return text(`Found ${data?.length ?? 0} import files:\n${JSON.stringify(data, null, 2)}`);
    }
  );

  server.tool(
    "get_import_file",
    "פרטי תיק יבוא — Get one import dossier with its documents, costs and linked orders",
    {
      import_file_id: z.string().uuid().describe("Import file UUID"),
    },
    async ({ import_file_id }) => {
      const { data: file, error } = await supabase
        .from("import_files")
        .select("*")
        .eq("id", import_file_id)
        .single();
      if (error) return fail(error.message);

      const [docsRes, costsRes, ordersRes] = await Promise.all([
        supabase.from("purchase_documents")
          .select("id, document_name, document_subtype, document_number, file_url, total_price, currency, created_at")
          .eq("import_file_id", import_file_id),
        supabase.from("import_cost_lines").select("*").eq("import_file_id", import_file_id),
        supabase.from("import_file_orders")
          .select("order_id, allocation_share, matched_by, match_reason, orders(order_number, supplier_name, total_price)")
          .eq("import_file_id", import_file_id),
      ]);

      return text(JSON.stringify({
        import_file: file,
        documents: docsRes.data ?? [],
        cost_lines: costsRes.data ?? [],
        linked_orders: ordersRes.data ?? [],
      }, null, 2));
    }
  );

  server.tool(
    "update_import_file",
    "עדכון תיק יבוא — Update fields on an import dossier",
    {
      import_file_id: z.string().uuid().describe("Import file UUID"),
      file_number: z.string().optional(),
      forwarder_name: z.string().optional(),
      shipment_mode: z.enum(["SEA", "AIR", "LAND", "COURIER"]).optional(),
      declaration_number: z.string().optional(),
      declaration_date: z.string().optional().describe("YYYY-MM-DD"),
      bl_number: z.string().optional(),
      house_bl_number: z.string().optional(),
      container_number: z.string().optional(),
      vessel_name: z.string().optional(),
      port_of_loading: z.string().optional(),
      port_of_discharge: z.string().optional(),
      etd: z.string().optional().describe("YYYY-MM-DD"),
      arrival_date: z.string().optional().describe("YYYY-MM-DD"),
      release_date: z.string().optional().describe("YYYY-MM-DD"),
      supplier_id: z.string().uuid().optional(),
      supplier_name: z.string().optional(),
      supplier_invoice_number: z.string().optional(),
      goods_value: z.number().optional(),
      goods_currency: z.enum(["USD", "EUR", "ILS"]).optional(),
      exchange_rate: z.number().optional(),
      customs_value_ils: z.number().optional(),
      gross_weight_kg: z.number().optional(),
      volume_cbm: z.number().optional(),
      package_count: z.number().int().optional(),
      status: z.enum(["draft", "matched", "complete"]).optional(),
      notes: z.string().optional(),
    },
    async ({ import_file_id, ...updates }) => {
      const payload = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
      if (Object.keys(payload).length === 0) return fail("No fields to update");

      const { data, error } = await supabase
        .from("import_files")
        .update(payload)
        .eq("id", import_file_id)
        .select()
        .single();

      if (error) return fail(error.message);
      return text(`Import file updated:\n${JSON.stringify(data, null, 2)}`);
    }
  );

  server.tool(
    "link_import_file_to_order",
    "שיוך תיק יבוא להזמנה — Link an import dossier to an order (a dossier may cover several orders)",
    {
      import_file_id: z.string().uuid().describe("Import file UUID"),
      order_id: z.string().uuid().describe("Order UUID"),
      allocation_share: z.number().min(0).max(1).optional().describe("Share of the dossier's costs belonging to this order (0-1); omit to split by goods value"),
      match_reason: z.string().optional().describe("What the match was based on, e.g. 'container+vessel' — recorded to score the future auto-matcher"),
    },
    async ({ import_file_id, order_id, allocation_share, match_reason }) => {
      const { data, error } = await supabase
        .from("import_file_orders")
        .insert({
          import_file_id,
          order_id,
          allocation_share: allocation_share ?? null,
          matched_by: "manual",
          match_reason: match_reason ?? null,
        })
        .select()
        .single();

      if (error) {
        return fail(error.code === "23505" ? "That import file is already linked to this order" : error.message);
      }

      await supabase.from("import_files").update({ status: "matched" }).eq("id", import_file_id);
      return text(`Linked:\n${JSON.stringify(data, null, 2)}`);
    }
  );

  server.tool(
    "unlink_import_file_from_order",
    "ניתוק תיק יבוא מהזמנה — Remove the link between a dossier and an order (the dossier itself is kept)",
    {
      import_file_id: z.string().uuid().describe("Import file UUID"),
      order_id: z.string().uuid().describe("Order UUID"),
    },
    async ({ import_file_id, order_id }) => {
      const { error } = await supabase
        .from("import_file_orders")
        .delete()
        .eq("import_file_id", import_file_id)
        .eq("order_id", order_id);
      if (error) return fail(error.message);
      return text("Unlinked.");
    }
  );

  server.tool(
    "add_import_cost_line",
    "הוספת שורת עלות לתיק יבוא — Add a charge to an import dossier",
    {
      import_file_id: z.string().uuid().describe("Import file UUID"),
      label: z.string().describe("Charge description, e.g. הובלה משילוח לעמילות"),
      category: z.enum(COST_CATEGORIES).default("other").describe("Charge category"),
      amount: z.number().describe("Charge amount"),
      currency: z.enum(["ILS", "USD", "EUR"]).default("ILS").describe("Charge currency"),
      amount_ils: z.number().optional().describe("Amount converted to ILS — required for a foreign-currency charge, or it is skipped in totals"),
      line_code: z.string().optional().describe("Issuer's own line code, e.g. '14' on a Total Care invoice"),
      document_id: z.string().uuid().optional().describe("purchase_documents UUID this charge was read off"),
      is_recoverable: z.boolean().default(false).describe("TRUE for import VAT — paid then reclaimed, so excluded from landed cost"),
      included_in_document_id: z.string().uuid().optional().describe("Set when this charge is already a line inside another document (a forwarder summary invoice), so it is not counted twice"),
      notes: z.string().optional(),
    },
    async ({ import_file_id, amount, currency, amount_ils, ...rest }) => {
      const { data, error } = await supabase
        .from("import_cost_lines")
        .insert({
          import_file_id,
          amount,
          currency,
          // An ILS charge needs no conversion — store it in both places so
          // totals never special-case the base currency.
          amount_ils: currency === "ILS" ? amount : (amount_ils ?? null),
          document_id: rest.document_id ?? null,
          included_in_document_id: rest.included_in_document_id ?? null,
          line_code: rest.line_code ?? null,
          notes: rest.notes ?? null,
          label: rest.label,
          category: rest.category,
          is_recoverable: rest.is_recoverable,
        })
        .select()
        .single();

      if (error) return fail(error.message);
      return text(`Cost line added:\n${JSON.stringify(data, null, 2)}`);
    }
  );

  server.tool(
    "delete_import_cost_line",
    "מחיקת שורת עלות — Delete a cost line from an import dossier",
    {
      cost_line_id: z.string().uuid().describe("Cost line UUID"),
    },
    async ({ cost_line_id }) => {
      const { error } = await supabase.from("import_cost_lines").delete().eq("id", cost_line_id);
      if (error) return fail(error.message);
      return text("Cost line deleted.");
    }
  );

  server.tool(
    "get_import_file_costs",
    "עלות נחיתה של תיק יבוא — Landed cost for a dossier, with recoverable VAT and nested invoice lines excluded",
    {
      import_file_id: z.string().uuid().describe("Import file UUID"),
    },
    async ({ import_file_id }) => {
      const [fileRes, linesRes] = await Promise.all([
        supabase.from("import_files").select("file_number, goods_value, goods_currency, customs_value_ils").eq("id", import_file_id).single(),
        supabase.from("import_cost_lines").select("*").eq("import_file_id", import_file_id),
      ]);

      if (fileRes.error) return fail(fileRes.error.message);
      if (linesRes.error) return fail(linesRes.error.message);

      const lines = linesRes.data ?? [];
      let landed = 0, recoverable = 0, duplicated = 0;
      const unconverted: string[] = [];
      const byCategory: Record<string, number> = {};

      for (const line of lines) {
        const ils = amountIls(line);
        if (ils === null) {
          unconverted.push(`${line.label} (${line.amount} ${line.currency})`);
          continue;
        }
        if (line.included_in_document_id) {
          duplicated += ils;
        } else if (line.is_recoverable) {
          recoverable += ils;
        } else {
          landed += ils;
          byCategory[line.category] = (byCategory[line.category] ?? 0) + ils;
        }
      }

      const goodsIls = fileRes.data?.customs_value_ils ? Number(fileRes.data.customs_value_ils) : null;

      return text(JSON.stringify({
        file_number: fileRes.data?.file_number,
        goods_value_ils: goodsIls,
        landed_cost_ils: Number(landed.toFixed(2)),
        landed_cost_by_category: Object.fromEntries(
          Object.entries(byCategory).map(([k, v]) => [k, Number(v.toFixed(2))])
        ),
        recoverable_vat_ils: Number(recoverable.toFixed(2)),
        total_cash_out_ils: Number((landed + recoverable).toFixed(2)),
        excluded_as_duplicated_ils: Number(duplicated.toFixed(2)),
        landed_cost_pct_of_goods: goodsIls ? Number(((landed / goodsIls) * 100).toFixed(2)) : null,
        lines_missing_ils_conversion: unconverted,
      }, null, 2));
    }
  );

  server.tool(
    "list_import_documents",
    "מסמכי תיק יבוא — List the PDFs attached to an import dossier",
    {
      import_file_id: z.string().uuid().describe("Import file UUID"),
      document_subtype: z.enum(DOC_SUBTYPES).optional().describe("Filter by document kind"),
    },
    async ({ import_file_id, document_subtype }) => {
      let query = supabase
        .from("purchase_documents")
        .select("id, document_name, document_subtype, document_number, file_url, total_price, currency, created_at")
        .eq("import_file_id", import_file_id)
        .order("created_at", { ascending: true });

      if (document_subtype) query = query.eq("document_subtype", document_subtype);

      const { data, error } = await query;
      if (error) return fail(error.message);
      return text(`Found ${data?.length ?? 0} documents:\n${JSON.stringify(data, null, 2)}`);
    }
  );

  server.tool(
    "attach_document_to_import_file",
    "צירוף מסמך קיים לתיק יבוא — Attach an existing purchase document to an import dossier",
    {
      document_id: z.string().uuid().describe("purchase_documents UUID"),
      import_file_id: z.string().uuid().describe("Import file UUID"),
      document_subtype: z.enum(DOC_SUBTYPES).optional().describe("Also set the document kind"),
    },
    async ({ document_id, import_file_id, document_subtype }) => {
      const updates: Record<string, string> = { import_file_id };
      if (document_subtype) updates.document_subtype = document_subtype;

      const { data, error } = await supabase
        .from("purchase_documents")
        .update(updates)
        .eq("id", document_id)
        .select("id, document_name, document_subtype, import_file_id")
        .single();

      if (error) return fail(error.message);
      return text(`Document attached:\n${JSON.stringify(data, null, 2)}`);
    }
  );

  server.tool(
    "find_orders_for_import_file",
    "מועמדים לשיוך תיק יבוא — Rank candidate orders for a dossier by shared shipment identifiers",
    {
      import_file_id: z.string().uuid().describe("Import file UUID"),
      limit: z.number().default(10).describe("Max candidates"),
    },
    async ({ import_file_id, limit }) => {
      const { data: file, error } = await supabase
        .from("import_files")
        .select("*")
        .eq("id", import_file_id)
        .single();
      if (error) return fail(error.message);

      // Pull a workable candidate set, then score in memory. Identifiers are
      // formatted inconsistently between forwarders (a B/L may arrive as
      // "RWOE2603160002" while the order holds the house bill "03160002"), so
      // matching is substring-based in both directions rather than equality.
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("id, order_number, pi_number, supplier_name, supplier_id, vessel_name, booking_number, tracking_number, tclog_reference, eta, total_price")
        .is("deleted_at", null)
        .limit(1000);
      if (ordersError) return fail(ordersError.message);

      const norm = (v: string | null | undefined) => (v ?? "").replace(/[\s\-/]/g, "").toUpperCase();
      const overlaps = (a: string | null | undefined, b: string | null | undefined) => {
        const x = norm(a), y = norm(b);
        if (!x || !y || x.length < 4 || y.length < 4) return false;
        return x.includes(y) || y.includes(x);
      };

      const fileBls = [file.bl_number, file.house_bl_number];

      const scored = (orders ?? []).map(order => {
        const reasons: string[] = [];
        let score = 0;

        if (file.supplier_invoice_number && overlaps(order.pi_number, file.supplier_invoice_number)) {
          score += 50; reasons.push("PI number");
        }
        for (const bl of fileBls) {
          if (!bl) continue;
          if (overlaps(order.tracking_number, bl) || overlaps(order.booking_number, bl) || overlaps(order.tclog_reference, bl)) {
            score += 40; reasons.push("bill of lading"); break;
          }
        }
        if (file.container_number && (overlaps(order.tracking_number, file.container_number) || overlaps(order.booking_number, file.container_number))) {
          score += 40; reasons.push("container");
        }
        if (file.vessel_name && order.vessel_name && norm(order.vessel_name) === norm(file.vessel_name)) {
          score += 20; reasons.push("vessel");
        }
        if (file.supplier_id && order.supplier_id === file.supplier_id) {
          score += 10; reasons.push("supplier");
        }
        // An arrival within a fortnight of the order's ETA is weak corroboration
        // on its own, but it separates two otherwise equal candidates.
        if (file.arrival_date && order.eta) {
          const days = Math.abs(
            (new Date(file.arrival_date).getTime() - new Date(order.eta).getTime()) / 86_400_000
          );
          if (days <= 14) { score += 10; reasons.push(`ETA within ${Math.round(days)}d`); }
        }

        return { order, score, reasons };
      })
        .filter(c => c.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      if (scored.length === 0) {
        return text("No candidate orders share an identifier with this dossier. Link manually with link_import_file_to_order.");
      }

      return text(JSON.stringify({
        import_file: {
          file_number: file.file_number,
          supplier_invoice_number: file.supplier_invoice_number,
          bl_number: file.bl_number,
          house_bl_number: file.house_bl_number,
          container_number: file.container_number,
          vessel_name: file.vessel_name,
          arrival_date: file.arrival_date,
        },
        note: "Candidates are ranked suggestions only — confirm before linking. A container often carries several orders, so more than one candidate may be correct.",
        candidates: scored.map(c => ({
          order_id: c.order.id,
          order_number: c.order.order_number,
          supplier_name: c.order.supplier_name,
          pi_number: c.order.pi_number,
          total_price: c.order.total_price,
          score: c.score,
          matched_on: c.reasons,
        })),
      }, null, 2));
    }
  );
}
