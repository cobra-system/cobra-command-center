import type { WarehouseZone } from "@/data/warehouseZones";
import type { ZoneInventoryData } from "@/hooks/useWarehouseInventory";

import { format } from "date-fns";
const GRID_COLS = 24;
const GRID_ROWS = 20;

// ── Print full floor plan ─────────────────────────────────────────────────────

export function printFloorPlan(
  zones: WarehouseZone[],
  zoneInventoryMap: Map<string, ZoneInventoryData>,
) {
  const cellW = 36; // px per cell
  const cellH = 30;
  const svgW = GRID_COLS * cellW;
  const svgH = GRID_ROWS * cellH;

  const zonesHtml = zones
    .map((zone) => {
      const [rowStart, rowEnd] = zone.gridRow.split(" / ").map(Number);
      const [colStart, colEnd] = zone.gridColumn.split(" / ").map(Number);
      const rowSpan = rowEnd - rowStart;
      const colSpan = colEnd - colStart;

      // RTL: col 1 is on the right side
      const x = (GRID_COLS - colEnd) * cellW;
      const y = (rowStart - 1) * cellH;
      const w = colSpan * cellW;
      const h = rowSpan * cellH;

      const inv = zoneInventoryMap.get(zone.id);
      const productCount = inv?.products.length ?? 0;

      const nameLines = zone.name.split("\n");
      const textY = h / 2 - (nameLines.length - 1) * 7;
      const textEls = nameLines
        .map(
          (line, i) =>
            `<tspan x="${w / 2}" dy="${i === 0 ? 0 : 13}">${escapeXml(line)}</tspan>`,
        )
        .join("");

      return `
        <g transform="translate(${x},${y})">
          <rect x="1" y="1" width="${w - 2}" height="${h - 2}"
            fill="${zone.color}" rx="3" stroke="rgba(0,0,0,0.15)" stroke-width="1"/>
          <text x="${w / 2}" y="${textY}"
            text-anchor="middle" fill="${zone.textColor}"
            font-family="sans-serif" font-size="9" font-weight="bold">
            ${textEls}
          </text>
          ${
            productCount > 0 && !zone.isNonProduct
              ? `<text x="${w / 2}" y="${h - 6}" text-anchor="middle"
                  fill="${zone.textColor}" font-family="sans-serif"
                  font-size="7" opacity="0.8">${productCount} מוצרים</text>`
              : ""
          }
        </g>`;
    })
    .join("\n");

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`
    <html dir="rtl">
      <head>
        <title>מפת מחסן לוגיסטי — קוברה</title>
        <style>
          body { margin: 0; padding: 16px; font-family: sans-serif; direction: rtl; }
          h2 { font-size: 14px; margin: 0 0 8px; }
          svg { border: 1px solid #ccc; display: block; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h2>מחסן לוגיסטר קוברה — ${new format(Date(), "dd/MM/yyyy")}</h2>
        <svg width="${svgW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 ${svgW} ${svgH}">
          <rect width="${svgW}" height="${svgH}" fill="#f9fafb"/>
          ${zonesHtml}
        </svg>
      </body>
    </html>
  `);
  win.document.close();
  win.print();
}

// ── Print zone label (with QR placeholder) ───────────────────────────────────

export function printZoneLabel(
  zone: WarehouseZone,
  inventoryData?: ZoneInventoryData,
) {
  const products = inventoryData?.products ?? [];
  const zoneName = zone.name.replace(/\n/g, " ");

  const rows = products
    .map(
      (p) =>
        `<tr>
          <td>${escapeHtml(p.name)}</td>
          <td style="font-family:monospace">${escapeHtml(p.sku)}</td>
          <td style="text-align:center">${p.quantity}</td>
        </tr>`,
    )
    .join("");

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`
    <html dir="rtl">
      <head>
        <title>תווית אזור — ${escapeHtml(zoneName)}</title>
        <style>
          body { font-family: sans-serif; padding: 24px; direction: rtl; max-width: 400px; }
          .zone-header {
            background: ${zone.color};
            color: ${zone.textColor};
            padding: 12px 16px;
            border-radius: 8px;
            margin-bottom: 16px;
          }
          h1 { font-size: 20px; margin: 0 0 4px; }
          .meta { font-size: 11px; opacity: 0.8; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { background: #f3f4f6; padding: 6px 8px; text-align: right; }
          td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; }
          .qr-placeholder {
            width: 80px; height: 80px; border: 2px dashed #ccc;
            display: flex; align-items: center; justify-content: center;
            font-size: 10px; color: #9ca3af; margin: 12px 0;
          }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="zone-header">
          <h1>${escapeHtml(zoneName)}</h1>
          <div class="meta">
            ${zone.zoneType} · שורה ${zone.gridRow} · עמודה ${zone.gridColumn}
          </div>
        </div>
        <div class="qr-placeholder">QR</div>
        ${
          products.length > 0
            ? `<table>
                <thead>
                  <tr><th>מוצר</th><th>SKU</th><th>מלאי</th></tr>
                </thead>
                <tbody>${rows}</tbody>
               </table>`
            : "<p style='color:#9ca3af;font-size:13px'>אין מוצרים מוגדרים לאזור</p>"
        }
      </body>
    </html>
  `);
  win.document.close();
  win.print();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
