import type { OrderRequest } from "@/contexts/types";
import { format } from "date-fns";

// Excel-compatible columns mirroring the planning sheet (RTL).
// We use Tab-Separated for clipboard-friendly paste back into Excel and
// CSV-with-BOM for download (Excel treats UTF-8 with BOM as Hebrew correctly).

const COLUMNS: { key: keyof OrderRequest; label: string; format?: (v: unknown) => string }[] = [
  { key: "division", label: "חטיבה" },
  { key: "product_name", label: "תיאור פריט" },
  { key: "supplier", label: "ספק" },
  { key: "product_sku", label: "מק״ט" },
  { key: "division_stock", label: "כמות מלאי תקין בפועל" },
  { key: "quarterly_forecast", label: "צפי רבעון" },
  { key: "utilization_pct", label: "% מימוש" },
  { key: "incoming_orders", label: 'עול"ב' },
  { key: "smoothed_required", label: "נדרש משוכלל" },
  { key: "required_to_order", label: "כמות" },
  { key: "incoming_arrival_date", label: 'תאריך הגעת עול"ב', format: fmtDate },
  { key: "order_execution_date", label: "תאריך ביצוע הזמנה", format: fmtDate },
  { key: "payment_status", label: "סטאטוס תשלום" },
  { key: "actual_ordered_qty", label: "כמות שהוזמנה בפועל" },
  { key: "shipping_type", label: "סוג משלוח" },
  { key: "notes", label: "הערות" },
  { key: "urgency", label: "דחיפות" },
  { key: "status", label: "סטטוס" },
];

function fmtDate(v: unknown): string {
  if (!v) return "";
  try { return format(new Date(String(v)), "dd/MM/yyyy"); } catch { return String(v); }
}

function cell(v: unknown, fmt?: (x: unknown) => string): string {
  if (v === null || v === undefined) return "";
  if (fmt) return fmt(v);
  return String(v);
}

export function downloadCsv(rows: OrderRequest[], filename: string) {
  const lines: string[] = [];
  lines.push(COLUMNS.map(c => c.label).join(","));
  for (const row of rows) {
    lines.push(
      COLUMNS.map(c => {
        const v = cell(row[c.key], c.format);
        // Quote and escape if value contains comma, quote, or newline
        if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
        return v;
      }).join(",")
    );
  }
  // BOM so Excel reads as UTF-8 (Hebrew works)
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Parse a tab-separated paste (typical when copy-pasting from Excel).
// Header is matched by Hebrew label; unknown columns are ignored.
// Each parsed row carries a 'sku' or 'product_name' to allow matching to existing rows.
export interface ParsedExcelRow {
  raw: Record<string, string>;
  patch: Partial<OrderRequest>;
  matchKey?: string; // SKU or product_name used to find target row
}

const LABEL_TO_KEY = new Map<string, keyof OrderRequest>();
for (const c of COLUMNS) LABEL_TO_KEY.set(c.label.trim(), c.key);

function parseNum(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v.replace(/,/g, ""));
  return Number.isNaN(n) ? null : n;
}

function parseDate(v: string): string | null {
  if (!v.trim()) return null;
  // Accept dd/MM/yyyy or yyyy-MM-dd
  const m1 = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return null;
}

const NUMERIC_FIELDS = new Set<keyof OrderRequest>([
  "division_stock", "quarterly_forecast",
  "utilization_pct", "incoming_orders", "smoothed_required",
  "required_to_order", "actual_ordered_qty",
  "quantity",
]);
const DATE_FIELDS = new Set<keyof OrderRequest>([
  "incoming_arrival_date", "order_execution_date",
]);

export function parseTsv(input: string): ParsedExcelRow[] {
  // Split into rows by newline, columns by tab
  const lines = input.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split("\t").map(h => h.trim());
  const rows: ParsedExcelRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split("\t");
    const raw: Record<string, string> = {};
    const patch: Partial<OrderRequest> = {};
    headers.forEach((h, idx) => {
      const v = cells[idx]?.trim() ?? "";
      raw[h] = v;
      const key = LABEL_TO_KEY.get(h);
      if (!key) return;
      if (v === "") return;
      if (NUMERIC_FIELDS.has(key)) {
        (patch as Record<string, unknown>)[key] = parseNum(v);
      } else if (DATE_FIELDS.has(key)) {
        const d = parseDate(v);
        if (d) (patch as Record<string, unknown>)[key] = d;
      } else {
        (patch as Record<string, unknown>)[key] = v;
      }
    });
    const matchKey = (raw["מק״ט"] || raw['מק"ט'] || raw["product_sku"] || raw["product_name"] || raw["תיאור פריט"] || "").trim();
    rows.push({ raw, patch, matchKey });
  }
  return rows;
}
