import { describe, it, expect } from "vitest";
import { fixHebrew, isoDate, parseSapPoLines, toNumber, type PdfTextLine } from "./sapPdf";

const HEBREW = /[֐-׿]/;

/** Build a token the way the SAP PDF stores it: Hebrew glyphs in visual order. */
function tok(text: string, x0: number, x1: number, y: number): PdfTextLine {
  const raw = HEBREW.test(text) ? [...text].reverse().join("") : text;
  return { x0, x1, y, raw, norm: fixHebrew(raw) };
}

/** A minimal but complete stand-in for the fixed SAP purchase-order template. */
function sampleLines(): PdfTextLine[] {
  return [
    tok("הזמנת רכש", 400, 470, 800), tok("12345", 300, 340, 800),
    tok("תאריך", 400, 440, 780), tok("14/07/26", 300, 350, 780),
    tok("לכבוד", 560, 590, 760), tok("אלקטרוניקה בע\"מ", 400, 520, 760),
    tok("מספר ע.מ", 560, 600, 745), tok("514789632", 460, 520, 745),
    tok("תנאי תשלום", 560, 610, 730), tok("שוטף+90", 470, 520, 730),
    tok("סוכן", 560, 590, 720), tok("דני כהן", 460, 520, 720),
    tok("הזמנה עבור מחסן מרכזי", 300, 450, 715),

    // table header
    tok("קוד פריט", 505, 550, 650), tok("תאור", 300, 340, 650),
    tok("כמות", 200, 230, 650), tok("מחיר", 120, 150, 650),

    // item 1
    tok("1", 565, 572, 600), tok("ABC-123", 508, 545, 600), tok("MFR-9", 455, 480, 600),
    tok("מצלמת אבטחה", 300, 430, 600), tok("01/09/26", 170, 200, 600), tok("5", 205, 212, 600),
    tok("10.00", 120, 145, 600), tok("50.00", 60, 90, 600),

    // item 2
    tok("2", 565, 572, 580), tok("XYZ-9", 508, 540, 580), tok("MFR-4", 455, 480, 580),
    tok("כבל רשת", 320, 420, 580), tok("2", 205, 212, 580),
    tok("25.00", 120, 145, 580), tok("50.00", 60, 90, 580),

    // totals
    tok("חייב מע\"מ", 300, 360, 500), tok("100.00", 60, 95, 500),
    tok("18.00", 150, 180, 480),
    tok("118.00", 60, 100, 460),
  ];
}

describe("fixHebrew / isoDate / toNumber", () => {
  it("de-reverses visual Hebrew and repairs the ð glitch", () => {
    expect(fixHebrew([..."מצלמה"].reverse().join(""))).toBe("מצלמה");
    expect(fixHebrew([..."נמסר"].reverse().join("").replace("נ", "ð"))).toBe("נמסר");
  });

  it("leaves latin text alone", () => {
    expect(fixHebrew("ABC-123")).toBe("ABC-123");
  });

  it("normalises SAP day/month/year dates", () => {
    expect(isoDate("14/07/26")).toBe("2026-07-14");
    expect(isoDate("1/2/2026")).toBe("2026-02-01");
    expect(isoDate("not a date")).toBeNull();
    expect(isoDate(null)).toBeNull();
  });

  it("parses money-ish numbers only", () => {
    expect(toNumber("1,234.50")).toBe(1234.5);
    expect(toNumber("₪99.00")).toBe(99);
    expect(toNumber("abc")).toBeNull();
    expect(toNumber("")).toBeNull();
  });
});

describe("parseSapPoLines", () => {
  const doc = parseSapPoLines(sampleLines(), "po-12345.pdf");

  it("reads the header scalars", () => {
    expect(doc.source).toBe("sap-pdf");
    expect(doc.poNumber).toBe("12345");
    expect(doc.orderDate).toBe("2026-07-14");
    expect(doc.supplierName).toBe("אלקטרוניקה בע\"מ");
    expect(doc.supplierVat).toBe("514789632");
    expect(doc.paymentTerms).toBe("שוטף+90");
    expect(doc.agent).toBe("דני כהן");
    expect(doc.notes).toContain("הזמנה עבור");
  });

  it("reads the line items with codes, quantities and prices", () => {
    expect(doc.items).toHaveLength(2);
    const [first, second] = doc.items;
    expect(first.code).toBe("ABC-123");
    expect(first.mfrSku).toBe("MFR-9");
    expect(first.description).toBe("מצלמת אבטחה");
    expect(first.qty).toBe(5);
    expect(first.unitPrice).toBe(10);
    expect(first.lineTotal).toBe(50);
    expect(first.deliveryDate).toBe("2026-09-01");
    expect(second.code).toBe("XYZ-9");
    expect(second.qty).toBe(2);
    expect(second.deliveryDate).toBeNull();
  });

  it("reads the totals and reconciles them without warnings", () => {
    expect(doc.subtotal).toBe(100);
    expect(doc.vatRate).toBe(18);
    expect(doc.vatAmount).toBe(18);
    expect(doc.total).toBe(118);
    expect(doc.warnings).toEqual([]);
  });

  it("warns when the line items do not add up to the subtotal", () => {
    const lines = sampleLines().map(l =>
      l.y === 500 && l.raw === "100.00" ? { ...l, raw: "180.00" } : l
    );
    const broken = parseSapPoLines(lines, "po.pdf");
    expect(broken.warnings.join(" ")).toContain("לא תואם");
  });

  it("warns instead of failing when no item rows are found", () => {
    const headerOnly = sampleLines().filter(l => l.y >= 650);
    const empty = parseSapPoLines(headerOnly, "po.pdf");
    expect(empty.items).toEqual([]);
    expect(empty.warnings.join(" ")).toContain("לא זוהו שורות פריטים");
  });
});
