/**
 * Builds the goods-receipt mail (מייל קליטת סחורה) that goes to the receiving
 * clerk when a shipment lands.
 *
 * The layout deliberately copies the Outlook mail this replaces: a short RTL
 * greeting, then one banded table whose columns run right-to-left — supplier
 * code, supplier name, product code, product name, quantity, receipt date,
 * destination warehouse, who took delivery. Mail clients ignore most CSS, so
 * every rule here is inline and the table carries its own border attributes.
 */

export interface GoodsReceiptLine {
  supplier_code: string;
  supplier_name: string;
  product_code: string;
  product_name: string;
  qty: string;
  receipt_date: string;
  warehouse: string;
  received_by: string;
}

export interface GoodsReceiptEmailInput {
  greetingName?: string;
  lines: GoodsReceiptLine[];
  note?: string;
  senderName?: string;
  orderNumber?: string | null;
}

const HEADERS: { key: keyof GoodsReceiptLine; label: string }[] = [
  { key: "supplier_code", label: "קוד ספק" },
  { key: "supplier_name", label: "שם ספק" },
  { key: "product_code", label: "קוד מוצר" },
  { key: "product_name", label: "שם מוצר" },
  { key: "qty", label: "כמות" },
  { key: "receipt_date", label: "תאריך קבלה" },
  { key: "warehouse", label: "לאן לקלוט" },
  { key: "received_by", label: "מי קיבל" },
];

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** "הגעת סחורה - M305, M712" — the product codes are what the clerk searches by. */
export function buildGoodsReceiptSubject(lines: GoodsReceiptLine[]): string {
  const codes = [...new Set(lines.map(l => (l.product_code || l.product_name).trim()).filter(Boolean))];
  return codes.length > 0 ? `הגעת סחורה - ${codes.join(", ")}` : "הגעת סחורה";
}

export function buildGoodsReceiptHtml(input: GoodsReceiptEmailInput): string {
  const { greetingName, lines, note, senderName, orderNumber } = input;

  const headerCells = HEADERS.map(h =>
    `<th style="background:#2f5597;color:#ffffff;font-weight:700;padding:8px 12px;border:1px solid #1f3864;white-space:nowrap">${escapeHtml(h.label)}</th>`
  ).join("");

  const bodyRows = lines.map((line, i) => {
    const background = i % 2 === 0 ? "#ffffff" : "#f2f5fb";
    const cells = HEADERS.map(h =>
      `<td style="padding:8px 12px;border:1px solid #b4c6e7;color:#111827">${escapeHtml(line[h.key] ?? "")}</td>`
    ).join("");
    return `<tr style="background:${background}">${cells}</tr>`;
  }).join("");

  const greeting = greetingName ? `היי ${escapeHtml(greetingName)},` : "היי,";

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#ffffff;direction:rtl;text-align:right;font-family:Arial,'Segoe UI',sans-serif;color:#111827">
  <p style="margin:0 0 16px;font-size:15px">${greeting}</p>
  <p style="margin:0 0 20px;font-size:15px">הגיעה אלינו סחורה מחו״ל – מצרף לך את החשבונית ואת הנתונים.</p>

  <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px;direction:rtl">
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>

  ${note ? `<p style="margin:20px 0 0;font-size:14px;color:#374151;white-space:pre-wrap">${escapeHtml(note)}</p>` : ""}
  ${orderNumber ? `<p style="margin:20px 0 0;font-size:12px;color:#6b7280">מספר הזמנה במערכת: ${escapeHtml(orderNumber)}</p>` : ""}
  ${senderName ? `<p style="margin:24px 0 0;font-size:14px;color:#111827">תודה,<br>${escapeHtml(senderName)}</p>` : ""}
</body>
</html>`;
}
