import { describe, it, expect } from "vitest";
import { findHeaderRow, parseNumericCell, parseOrderRows, type SheetRows } from "./spreadsheet";

const hebrewSheet: SheetRows = [
  ["ספק:", "אלקטרוניקה בע\"מ", null, null],
  ["תאריך:", "14/07/2026", null, null],
  ["מספר הזמנה:", "PO-8891", null, null],
  [null, null, null, null],
  ["מק\"ט", "תיאור", "כמות", "מחיר יחידה", "סה\"כ"],
  ["ABC-123", "מצלמת אבטחה", 5, 10, 50],
  ["XYZ-9", "כבל רשת", 2, 25, 50],
  ["", "", "", "", ""],
  ["", "", "", "סה\"כ", 100],
];

const englishSheet: SheetRows = [
  ["Proforma Invoice", null, null, null],
  ["Supplier:", "Shenzhen Optics Ltd", null, null],
  ["PI No:", "PI-2026-114", null, null],
  ["Item Code", "Description", "Qty", "Unit Price", "Amount", "Currency"],
  ["CAM-01", "IP Camera 4MP", 100, "12.50", "1250.00", "USD"],
  ["CBL-02", "Cat6 cable 5m", 50, "1.20", "60.00", "USD"],
];

describe("parseNumericCell", () => {
  it("reads numbers, numeric strings and money strings", () => {
    expect(parseNumericCell(12.5)).toBe(12.5);
    expect(parseNumericCell("1,250.00")).toBe(1250);
    expect(parseNumericCell("$12.50")).toBe(12.5);
    expect(parseNumericCell("n/a")).toBeNull();
    expect(parseNumericCell(null)).toBeNull();
  });
});

describe("findHeaderRow", () => {
  it("locates the item table header in a Hebrew sheet", () => {
    const header = findHeaderRow(hebrewSheet);
    expect(header?.index).toBe(4);
    expect(header?.columns).toMatchObject({ code: 0, description: 1, qty: 2, unitPrice: 3, lineTotal: 4 });
  });

  it("locates the item table header in an English sheet", () => {
    const header = findHeaderRow(englishSheet);
    expect(header?.index).toBe(3);
    expect(header?.columns).toMatchObject({ code: 0, description: 1, qty: 2, unitPrice: 3, currency: 5 });
  });

  it("returns null when there is no recognisable table", () => {
    expect(findHeaderRow([["שלום"], ["טקסט חופשי"]])).toBeNull();
  });
});

describe("parseOrderRows", () => {
  it("parses a Hebrew order sheet with its header scalars", () => {
    const doc = parseOrderRows(hebrewSheet, "order.xlsx");
    expect(doc.source).toBe("spreadsheet");
    expect(doc.supplierName).toBe("אלקטרוניקה בע\"מ");
    expect(doc.orderDate).toBe("2026-07-14");
    expect(doc.poNumber).toBe("PO-8891");
    expect(doc.items).toHaveLength(2);
    expect(doc.items[0]).toMatchObject({ code: "ABC-123", description: "מצלמת אבטחה", qty: 5, unitPrice: 10, lineTotal: 50 });
    expect(doc.subtotal).toBe(100);
    expect(doc.warnings).toEqual([]);
  });

  it("parses an English PI and picks up the currency", () => {
    const doc = parseOrderRows(englishSheet, "pi.xlsx");
    expect(doc.supplierName).toBe("Shenzhen Optics Ltd");
    expect(doc.piNumber).toBe("PI-2026-114");
    expect(doc.items).toHaveLength(2);
    expect(doc.items[0]).toMatchObject({ code: "CAM-01", qty: 100, unitPrice: 12.5, lineTotal: 1250 });
    expect(doc.currency).toBe("USD");
    expect(doc.subtotal).toBe(1310);
  });

  it("computes a missing line total from qty × unit price", () => {
    const doc = parseOrderRows([
      ["מק\"ט", "תיאור", "כמות", "מחיר"],
      ["A-1", "פריט", 3, 7],
    ], "x.xlsx");
    expect(doc.items[0].lineTotal).toBe(21);
  });

  it("flags rows with no quantity", () => {
    const doc = parseOrderRows([
      ["מק\"ט", "תיאור", "כמות", "מחיר"],
      ["A-1", "פריט", null, 7],
    ], "x.xlsx");
    expect(doc.items).toHaveLength(1);
    expect(doc.warnings.join(" ")).toContain("אין כמות");
  });

  it("warns instead of throwing when the file has no item table", () => {
    const doc = parseOrderRows([["hello"], ["world"]], "notes.xlsx");
    expect(doc.items).toEqual([]);
    expect(doc.warnings.join(" ")).toContain("לא זוהתה טבלת פריטים");
  });
});
