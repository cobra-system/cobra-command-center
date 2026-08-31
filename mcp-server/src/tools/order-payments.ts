import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { unwrapRows } from "../lib/queryResult.js";

const SWIFT_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const PAYMENT_TYPE_HE: Record<string, string> = { Deposit: "מקדמה", Balance: "יתרה", Full: "מלא" };

export function registerOrderPaymentTools(server: McpServer) {
  server.tool(
    "add_order_payment",
    "הוספת תשלום להזמנה — Add a payment installment to an order's payment schedule",
    {
      order_id: z.string().uuid().describe("Order UUID"),
      payment_type: z.enum(["Deposit", "Balance", "Full"]).describe("Payment type: Deposit (upfront), Balance (remaining), Full (single payment)"),
      amount: z.number().describe("Payment amount"),
      currency: z.enum(["USD", "EUR", "ILS"]).default("USD").describe("Currency"),
      percentage: z.number().min(0).max(100).optional().describe("Percentage of order total this payment represents (e.g. 15 for 15%)"),
      due_date: z.string().optional().describe("Payment due date (YYYY-MM-DD)"),
      paid_date: z.string().optional().describe("Date payment was made (YYYY-MM-DD) — leave empty if not yet paid"),
      swift_reference: z.string().optional().describe("SWIFT/wire transfer reference number from bank"),
      status: z.enum(["ממתין", "שולם"]).default("ממתין").describe("Payment status: ממתין (pending), שולם (paid)"),
      notes: z.string().optional().describe("Payment notes"),
    },
    async ({ order_id, payment_type, amount, currency, percentage, due_date, paid_date, swift_reference, status, notes }) => {
      const { data, error } = await supabase
        .from("order_payments")
        .insert({
          order_id,
          payment_type,
          amount,
          currency,
          percentage: percentage ?? null,
          due_date: due_date || null,
          paid_date: paid_date || null,
          swift_reference: swift_reference || null,
          status,
          notes: notes || null,
        })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      return { content: [{ type: "text" as const, text: `Payment added:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "list_order_payments",
    "לוח תשלומים להזמנה — List all payment installments for an order with totals",
    {
      order_id: z.string().uuid().describe("Order UUID"),
    },
    async ({ order_id }) => {
      const [orderRes, paymentsRes, docsRes] = await Promise.all([
        supabase.from("orders").select("id, supplier_name, total_price, pi_number").eq("id", order_id).single(),
        supabase.from("order_payments").select("*").eq("order_id", order_id).order("created_at", { ascending: true }),
        supabase
          .from("purchase_documents")
          .select("id, document_name, file_url, order_payment_id, created_at")
          .eq("order_id", order_id)
          .eq("document_subtype", "SWIFT"),
      ]);

      if (orderRes.error) return { content: [{ type: "text" as const, text: `Error fetching order: ${orderRes.error.message}` }] };

      const swiftDocs = (unwrapRows(docsRes, "docs")) as Record<string, unknown>[];
      const payments = ((unwrapRows(paymentsRes, "payments")) as Record<string, unknown>[]).map((p) => ({
        ...p,
        swift_documents: swiftDocs.filter((d) => d.order_payment_id === p.id),
      }));
      const totalPaid = payments
        .filter((p: Record<string, unknown>) => p.status === "שולם" || p.paid_date)
        .reduce((sum: number, p: Record<string, unknown>) => sum + (Number(p.amount) || 0), 0);
      const totalPending = payments
        .filter((p: Record<string, unknown>) => p.status === "ממתין" && !p.paid_date)
        .reduce((sum: number, p: Record<string, unknown>) => sum + (Number(p.amount) || 0), 0);

      const result = {
        order: orderRes.data,
        payment_schedule: payments,
        unlinked_swift_documents: swiftDocs.filter((d) => !d.order_payment_id),
        summary: {
          total_installments: payments.length,
          total_paid: totalPaid,
          total_pending: totalPending,
          order_total: Number(orderRes.data.total_price) || null,
          remaining_from_order_total: orderRes.data.total_price
            ? Number(orderRes.data.total_price) - totalPaid
            : null,
        },
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_order_payment_schedule",
    "לוח זמנים לתשלומים — Get the full payment schedule for an order (what needs to be paid and when)",
    {
      order_id: z.string().uuid().describe("Order UUID"),
    },
    async ({ order_id }) => {
      const [orderRes, paymentsRes] = await Promise.all([
        supabase.from("orders").select("id, supplier_name, total_price, status, pi_number, eta, etd").eq("id", order_id).single(),
        supabase.from("order_payments").select("*").eq("order_id", order_id).order("created_at", { ascending: true }),
      ]);

      if (orderRes.error) return { content: [{ type: "text" as const, text: `Error: ${orderRes.error.message}` }] };

      const payments = unwrapRows(paymentsRes, "payments");
      const today = new Date().toISOString().split("T")[0];

      type ScheduleEntry = Record<string, unknown> & { is_paid: boolean; is_overdue: unknown; days_until_due: number | null };

      const schedule: ScheduleEntry[] = payments.map((p: Record<string, unknown>) => {
        const isPaid = p.status === "שולם" || Boolean(p.paid_date);
        const isOverdue = !isPaid && p.due_date && (p.due_date as string) < today;
        return {
          ...p,
          is_paid: isPaid,
          is_overdue: isOverdue,
          days_until_due: p.due_date
            ? Math.ceil((new Date(p.due_date as string).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24))
            : null,
        };
      });

      const pendingPayments = schedule.filter((p) => !p.is_paid);
      const overduePayments = schedule.filter((p) => p.is_overdue);
      const paidPayments = schedule.filter((p) => p.is_paid);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            order: orderRes.data,
            schedule,
            pending_count: pendingPayments.length,
            overdue_count: overduePayments.length,
            paid_count: paidPayments.length,
            total_pending_amount: pendingPayments.reduce((s, p) => s + (Number(p.amount as number) || 0), 0),
            total_paid_amount: paidPayments.reduce((s, p) => s + (Number(p.amount as number) || 0), 0),
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    "update_order_payment",
    "עדכון תשלום — Update a payment installment (mark as paid, add SWIFT reference, change amount)",
    {
      id: z.string().uuid().describe("Order payment UUID"),
      status: z.enum(["ממתין", "שולם"]).optional().describe("Payment status"),
      paid_date: z.string().optional().describe("Date payment was made (YYYY-MM-DD)"),
      swift_reference: z.string().optional().describe("SWIFT/wire transfer reference number"),
      amount: z.number().optional().describe("Updated payment amount"),
      due_date: z.string().optional().describe("Updated due date (YYYY-MM-DD)"),
      notes: z.string().optional().describe("Updated notes"),
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
        .from("order_payments")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      return { content: [{ type: "text" as const, text: `Payment updated:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  server.tool(
    "match_swift_to_payment",
    "התאמת SWIFT לתשלום — Search for a pending order payment matching a SWIFT transfer by amount + date window",
    {
      amount: z.number().describe("Payment amount from bank statement"),
      currency: z.enum(["USD", "EUR", "ILS"]).default("USD").describe("Currency"),
      tolerance_percent: z.number().default(2).describe("Amount tolerance % for fuzzy matching (default 2% — accounts for bank fees and exchange rate rounding)"),
      supplier_name: z.string().optional().describe("Supplier/beneficiary name (partial match)"),
      transfer_date: z.string().optional().describe("Actual transfer date from bank statement (YYYY-MM-DD). Used to filter by due_date ±7 days."),
      date_window_days: z.number().default(7).describe("Days around transfer_date to search within (default ±7 days from due_date)"),
      swift_reference: z.string().optional().describe("SWIFT reference if already known — will be saved to matched payment"),
    },
    async ({ amount, currency, tolerance_percent, supplier_name, transfer_date, date_window_days, swift_reference }) => {
      const tolerance = amount * (tolerance_percent / 100);
      const minAmount = amount - tolerance;
      const maxAmount = amount + tolerance;

      let query = supabase
        .from("order_payments")
        .select("*, orders!inner(id, supplier_name, pi_number, status, total_price)")
        .eq("currency", currency)
        .gte("amount", minAmount)
        .lte("amount", maxAmount)
        .eq("status", "ממתין");

      if (supplier_name) {
        query = query.ilike("orders.supplier_name", `%${supplier_name}%`);
      }

      // Date window: filter by due_date ±N days around the transfer date.
      // SWIFT can go out before or after due_date (exchange rate fluctuations,
      // bank processing delays, weekend offsets).
      if (transfer_date) {
        const refDate = new Date(transfer_date);
        const windowMs = date_window_days * 24 * 60 * 60 * 1000;
        const dateFrom = new Date(refDate.getTime() - windowMs).toISOString().split("T")[0];
        const dateTo = new Date(refDate.getTime() + windowMs).toISOString().split("T")[0];
        query = query.gte("due_date", dateFrom).lte("due_date", dateTo);
      }

      const { data: matches, error } = await query;

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      // If no matches with date window, retry without date filter and warn
      let finalMatches = matches || [];
      let dateWindowApplied = Boolean(transfer_date);
      if (finalMatches.length === 0 && transfer_date) {
        const { data: noDateMatches } = await supabase
          .from("order_payments")
          .select("*, orders!inner(id, supplier_name, pi_number, status, total_price)")
          .eq("currency", currency)
          .gte("amount", minAmount)
          .lte("amount", maxAmount)
          .eq("status", "ממתין");
        finalMatches = noDateMatches || [];
        dateWindowApplied = false;
      }

      if (finalMatches.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: [
              `No pending order payments found matching ${amount} ${currency} (±${tolerance_percent}%).`,
              supplier_name ? `Supplier filter: "${supplier_name}"` : "",
              transfer_date ? `Transfer date: ${transfer_date} (±${date_window_days} days)` : "",
              "",
              "Suggestions:",
              "  • Broaden tolerance_percent (default 2%, try 5%)",
              "  • Check the currency",
              "  • Increase date_window_days",
              "  • Verify the amount (SWIFT amount may differ from order amount due to bank fees)",
            ].filter(Boolean).join("\n"),
          }],
        };
      }

      const result: Record<string, unknown> = {
        search: {
          amount, currency, tolerance_percent, supplier_name,
          transfer_date: transfer_date || null,
          date_window_days,
          date_window_applied: dateWindowApplied,
          amount_range: { min: minAmount, max: maxAmount },
        },
        matches_found: finalMatches.length,
        matches: finalMatches,
        note: !dateWindowApplied && transfer_date
          ? `⚠️  No matches within ±${date_window_days} days of ${transfer_date} — showing all pending matches regardless of due_date`
          : undefined,
      };

      // If SWIFT reference provided and exactly one match found, offer to update it
      if (swift_reference && finalMatches.length === 1) {
        const paymentId = (finalMatches[0] as Record<string, unknown>).id as string;
        const { data: updated, error: updateErr } = await supabase
          .from("order_payments")
          .update({ swift_reference })
          .eq("id", paymentId)
          .select()
          .single();

        if (updateErr) {
          result.swift_update_error = updateErr.message;
        } else {
          result.swift_reference_saved = true;
          result.updated_payment = updated;
        }
      } else if (swift_reference && finalMatches.length > 1) {
        result.swift_note = `Multiple matches found — cannot auto-assign SWIFT reference. Use update_order_payment with the specific payment ID.`;
      }

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
  server.tool(
    "upload_swift_document",
    "העלאת אישור SWIFT — Upload a SWIFT/wire-transfer confirmation file and attach it to an order payment installment (it appears in the documents module and on the order's payment schedule)",
    {
      file_path: z.string().describe("Absolute path to the SWIFT file on the local filesystem (PDF, image or Office file)"),
      order_payment_id: z.string().uuid().optional().describe("Payment installment the SWIFT settles. Omit to attach the SWIFT to the order only (it then shows as unlinked on the payment schedule)."),
      order_id: z.string().uuid().optional().describe("Order UUID — required when order_payment_id is not given; otherwise taken from the installment"),
      document_name: z.string().optional().describe("Display name. Defaults to 'SWIFT <type> <amount> <currency>' from the installment, or the filename."),
      swift_reference: z.string().optional().describe("SWIFT reference from the bank — also written to the installment's swift_reference"),
      mark_paid: z.boolean().default(false).describe("Also mark the installment as paid (status=שולם, paid_date=today if not already set)"),
    },
    async ({ file_path, order_payment_id, order_id, document_name, swift_reference, mark_paid }) => {
      // 1. Resolve the installment (and the order it belongs to)
      let payment: Record<string, unknown> | null = null;
      if (order_payment_id) {
        const { data, error } = await supabase.from("order_payments").select("*").eq("id", order_payment_id).single();
        if (error) return { content: [{ type: "text" as const, text: `Error fetching payment: ${error.message}` }] };
        payment = data as Record<string, unknown>;
        order_id = payment.order_id as string;
      }
      if (!order_id) {
        return { content: [{ type: "text" as const, text: "Error: order_id is required when order_payment_id is not provided" }] };
      }

      // 2. Read the file
      let fileBuffer: Buffer;
      try {
        fileBuffer = await readFile(file_path);
      } catch (err) {
        return { content: [{ type: "text" as const, text: `Error reading file at "${file_path}": ${(err as Error).message}` }] };
      }

      // 3. Upload to the documents bucket, mirroring the UI's swift/<order>/ layout
      const originalName = basename(file_path);
      const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_{2,}/g, "_");
      const storagePath = `swift/${order_id}/${Date.now()}_${safeName}`;
      const contentType = SWIFT_MIME[extname(originalName).toLowerCase()] ?? "application/octet-stream";

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, fileBuffer, { contentType, upsert: false });
      if (uploadError) return { content: [{ type: "text" as const, text: `Error uploading to storage: ${uploadError.message}` }] };

      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(storagePath);

      // 4. Default name from the installment: "SWIFT מקדמה 70,000 USD"
      let defaultName = originalName.replace(/\.[^/.]+$/, "");
      if (payment) {
        const typeLabel = PAYMENT_TYPE_HE[payment.payment_type as string] || (payment.payment_type as string);
        const amount = payment.amount ? ` ${Number(payment.amount).toLocaleString("en-US")} ${payment.currency || ""}`.trimEnd() : "";
        defaultName = `SWIFT ${typeLabel}${amount}`;
      }

      // 5. Create the document row
      const { data: doc, error } = await supabase
        .from("purchase_documents")
        .insert({
          document_name: document_name ?? defaultName,
          type: "כללי",
          document_subtype: "SWIFT",
          order_id,
          order_payment_id: order_payment_id ?? null,
          supplier_id: null,
          document_number: swift_reference ?? (payment?.swift_reference as string) ?? null,
          total_price: (payment?.amount as number) ?? null,
          currency: (payment?.currency as string) ?? "USD",
          status: "בוצע",
          quantity: 0,
          file_url: urlData.publicUrl,
        })
        .select()
        .single();

      if (error) {
        await supabase.storage.from("documents").remove([storagePath]);
        return { content: [{ type: "text" as const, text: `File uploaded but DB insert failed (file removed): ${error.message}` }] };
      }

      // 6. Optionally update the installment itself
      let updatedPayment: unknown = null;
      if (order_payment_id && (swift_reference || mark_paid)) {
        const updates: Record<string, unknown> = {};
        if (swift_reference) updates.swift_reference = swift_reference;
        if (mark_paid) {
          updates.status = "שולם";
          if (!payment?.paid_date) updates.paid_date = new Date().toISOString().split("T")[0];
        }
        const { data: updated, error: updateErr } = await supabase
          .from("order_payments").update(updates).eq("id", order_payment_id).select().single();
        if (updateErr) return { content: [{ type: "text" as const, text: `Document saved, but updating the payment failed: ${updateErr.message}\n${JSON.stringify(doc, null, 2)}` }] };
        updatedPayment = updated;
      }

      return {
        content: [{
          type: "text" as const,
          text: `SWIFT document uploaded:\n${JSON.stringify({ document: doc, payment: updatedPayment }, null, 2)}`,
        }],
      };
    }
  );

  server.tool(
    "link_swift_document_to_payment",
    "שיוך מסמך SWIFT לתשלום — Attach an existing document to a payment installment (or detach it with order_payment_id omitted)",
    {
      document_id: z.string().uuid().describe("Purchase document UUID"),
      order_payment_id: z.string().uuid().optional().describe("Payment installment to attach to. Omit to detach the document from its installment."),
      mark_as_swift: z.boolean().default(true).describe("Also set document_subtype=SWIFT on the document"),
    },
    async ({ document_id, order_payment_id, mark_as_swift }) => {
      const updates: Record<string, unknown> = { order_payment_id: order_payment_id ?? null };
      if (mark_as_swift) updates.document_subtype = "SWIFT";

      const { data, error } = await supabase
        .from("purchase_documents")
        .update(updates)
        .eq("id", document_id)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: `Document updated:\n${JSON.stringify(data, null, 2)}` }] };
    }
  );
}
