// Sends the goods-receipt mail (מייל קליטת סחורה) to the receiving clerk, with
// the supplier's invoice attached.
//
// The client sends structured rows, never HTML: the mail body is rendered here
// from _shared/goodsReceiptEmail.ts so an authenticated caller cannot push
// arbitrary markup out through the company's sending domain. Attachments are
// resolved from purchase_documents by id and re-checked against the order, so a
// caller cannot attach a document belonging to a different order either.
//
// Configuration (env var first, then the app_config table):
//   • resend_api_key / RESEND_API_KEY
//   • resend_from_email / RESEND_FROM_EMAIL
//   • goods_receipt_recipient_email  — default "to", set in Settings
//   • goods_receipt_cc_emails        — default "cc" (comma-separated)

import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { loadEmailConfig, sendEmail, type EmailAttachment } from "../_shared/email.ts";
import {
  buildGoodsReceiptHtml,
  buildGoodsReceiptSubject,
  type GoodsReceiptLine,
} from "../_shared/goodsReceiptEmail.ts";

/** Resend caps a message at 40MB; stay well under it so a send never bounces. */
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface RequestBody {
  order_id: string;
  lines: GoodsReceiptLine[];
  recipient_email?: string;
  cc_emails?: string[];
  greeting_name?: string;
  subject?: string;
  note?: string;
  receipt_date?: string;
  warehouse?: string;
  received_by?: string;
  document_ids?: string[];
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Chunked so a multi-MB PDF does not blow the argument limit of String.fromCharCode. */
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

const str = (value: unknown): string => (value == null ? "" : String(value)).trim();

function normaliseLine(raw: Record<string, unknown>): GoodsReceiptLine {
  return {
    supplier_code: str(raw.supplier_code),
    supplier_name: str(raw.supplier_name),
    product_code: str(raw.product_code),
    product_name: str(raw.product_name),
    qty: str(raw.qty),
    receipt_date: str(raw.receipt_date),
    warehouse: str(raw.warehouse),
    received_by: str(raw.received_by),
  };
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authResult = await verifyAuth(req);
    if ("error" in authResult) return json({ error: authResult.error }, authResult.status);

    const { supabaseAdmin, user } = authResult.auth;
    const body = await req.json() as RequestBody;

    if (!body?.order_id) return json({ error: "order_id נדרש" }, 400);
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      return json({ error: "אין שורות לשליחה" }, 400);
    }

    const lines = body.lines.map(l => normaliseLine(l as unknown as Record<string, unknown>));
    if (lines.some(l => !l.product_name && !l.product_code)) {
      return json({ error: "כל שורה חייבת לכלול קוד מוצר או שם מוצר" }, 400);
    }

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, supplier_name")
      .eq("id", body.order_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (orderErr) return json({ error: `שגיאה בשליפת ההזמנה: ${orderErr.message}` }, 500);
    if (!order) return json({ error: "הזמנה לא נמצאה" }, 404);

    // ---- recipients -------------------------------------------------------
    const { data: configRows } = await supabaseAdmin
      .from("app_config")
      .select("key, value")
      .in("key", ["goods_receipt_recipient_email", "goods_receipt_cc_emails", "goods_receipt_recipient_name"]);
    const config = Object.fromEntries((configRows ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));

    const recipient = str(body.recipient_email) || str(config.goods_receipt_recipient_email);
    if (!recipient) {
      return json({ error: "לא הוגדר נמען לקליטת סחורה — הגדר אותו במסך ההגדרות" }, 400);
    }
    if (!EMAIL_RE.test(recipient)) return json({ error: `כתובת מייל לא תקינה: ${recipient}` }, 400);

    const ccSource = body.cc_emails ?? str(config.goods_receipt_cc_emails).split(",");
    const cc = ccSource.map(str).filter(Boolean);
    const badCc = cc.find(address => !EMAIL_RE.test(address));
    if (badCc) return json({ error: `כתובת עותק לא תקינה: ${badCc}` }, 400);

    // ---- attachments ------------------------------------------------------
    const attachments: EmailAttachment[] = [];
    const attachmentNames: string[] = [];
    const documentIds = (body.document_ids ?? []).filter(Boolean);

    if (documentIds.length > 0) {
      const { data: docs, error: docsErr } = await supabaseAdmin
        .from("purchase_documents")
        .select("id, document_name, file_url")
        .in("id", documentIds)
        .eq("order_id", order.id);
      if (docsErr) return json({ error: `שגיאה בשליפת המסמכים: ${docsErr.message}` }, 500);

      // Only files that live in this project's public storage may be fetched —
      // file_url is free text in the DB, and this endpoint must not be turned
      // into a fetcher for arbitrary URLs.
      const storagePrefix = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/`;
      let totalBytes = 0;

      for (const doc of docs ?? []) {
        if (!doc.file_url || !doc.file_url.startsWith(storagePrefix)) continue;

        const fileRes = await fetch(doc.file_url);
        if (!fileRes.ok) {
          return json({ error: `לא ניתן להוריד את הקובץ "${doc.document_name ?? doc.id}"` }, 502);
        }

        const bytes = new Uint8Array(await fileRes.arrayBuffer());
        totalBytes += bytes.length;
        if (totalBytes > MAX_ATTACHMENT_BYTES) {
          return json({ error: "הקבצים המצורפים גדולים מדי (מעל 15MB)" }, 413);
        }

        const rawName = doc.file_url.split("/").pop() ?? "";
        // A stored name may contain a stray % that is not a valid escape.
        const urlName = (() => { try { return decodeURIComponent(rawName); } catch { return rawName; } })();
        const docName = str(doc.document_name);
        // Keep the document's own name only when it carries an extension —
        // otherwise the mail client cannot tell what kind of file it is.
        const filename = /\.[a-z0-9]{2,5}$/i.test(docName) ? docName : (urlName || `${doc.id}.pdf`);

        attachments.push({ filename, content: toBase64(bytes) });
        attachmentNames.push(filename);
      }
    }

    // ---- send -------------------------------------------------------------
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle();

    const subject = str(body.subject) || buildGoodsReceiptSubject(lines);
    const html = buildGoodsReceiptHtml({
      greetingName: str(body.greeting_name) || str(config.goods_receipt_recipient_name) || undefined,
      lines,
      note: str(body.note) || undefined,
      senderName: profile?.name ?? undefined,
      orderNumber: order.order_number,
    });

    const { apiKey, from } = await loadEmailConfig(supabaseAdmin);
    if (!apiKey) return json({ error: "שירות המייל אינו מוגדר (resend_api_key חסר)" }, 500);

    const messageId = await sendEmail({ to: recipient, cc, subject, html, from, apiKey, attachments });

    const { data: logRow } = await supabaseAdmin
      .from("goods_receipt_emails")
      .insert({
        order_id: order.id,
        sent_by: user.id,
        sent_by_name: profile?.name ?? null,
        recipient_email: recipient,
        cc_emails: cc,
        subject,
        receipt_date: str(body.receipt_date) || null,
        warehouse: str(body.warehouse) || null,
        received_by: str(body.received_by) || null,
        note: str(body.note) || null,
        lines,
        attachment_names: attachmentNames,
        provider_message_id: messageId,
      })
      .select("id")
      .maybeSingle();

    return json({ ok: true, id: logRow?.id ?? null, recipient, cc, attachments: attachmentNames });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
