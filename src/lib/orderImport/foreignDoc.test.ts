import { describe, it, expect } from "vitest";
import {
  numberVariants, rowNumbers, reconcileRow, parseLooseDate, parseForeignDocLines, tokensToLines,
} from "./foreignDoc";
import type { PdfTextLine } from "./sapPdf";

const CHINESE_PI = `
NINGBO SUNRISE AUTO PARTS CO., LTD
PROFORMA INVOICE
Proforma Invoice No.: SR-PI-26031          Date: 14/03/2026
To (Buyer): Cobra Systems Ltd, Netanya, Israel
Terms of Payment: 30% T/T deposit, 70% balance against copy of B/L
Price Term: FOB Ningbo
Estimated Shipment Date: 25/04/2026
1    SR-4410       Hydraulic hose 3/8" 2m             500    12.50        6250.00
2    SR-2210       Quick coupler NPT 1/2"             1200   3.20         3840.00
3    SR-9001       Mounting bracket steel zinc        300    7.85         2355.00
Total Quantity:  2000 PCS
Total Amount USD: 12,445.00
`.trim().split("\n");

const ITALIAN_CONFIRMATION = `
TECNOPLAST S.R.L. - Via Garibaldi 44, 20121 Milano, Italia
ORDER CONFIRMATION / CONFERMA D'ORDINE
Nr. ordine: OC/2026/0417        Data: 03.02.2026
Resa: CIF Ashdod
Pagamento: 50% anticipo, 50% a 60 giorni data fattura
10   TP-8850     Guarnizione in gomma NBR         2.400      1,85         4.440,00
20   TP-8851     Tappo filettato M12              850        3,40         2.890,00
30   TP-9002     Kit montaggio completo           120       27,50         3.300,00
Totale imponibile EUR   10.630,00
`.trim().split("\n");

describe("numberVariants", () => {
  it("reads both thousands conventions", () => {
    expect(numberVariants("1,234.56")).toEqual([1234.56]);
    expect(numberVariants("1.234,56")).toEqual([1234.56]);
    expect(numberVariants("12,50")).toEqual([12.5]);
    expect(numberVariants("6250.00")).toEqual([6250]);
  });

  it("offers both readings of a genuinely ambiguous token", () => {
    expect(numberVariants("2.400")).toEqual([2.4, 2400]);
    expect(numberVariants("1,200")).toEqual([1200]);
  });

  it("rejects what is not a number", () => {
    expect(numberVariants("SR-4410")).toEqual([]);
    expect(numberVariants("")).toEqual([]);
  });
});

describe("rowNumbers", () => {
  it("skips digits that belong to a part code or a fraction", () => {
    const found = rowNumbers('1    SR-4410  Hydraulic hose 3/8" 2m   500  12.50  6250.00');
    const values = found.flatMap(n => n.values);
    expect(values).not.toContain(4410);
    expect(values).not.toContain(8);
    expect(values).toContain(500);
    expect(values).toContain(6250);
  });
});

describe("reconcileRow", () => {
  it("picks the triple that multiplies out, not a stray fraction", () => {
    const best = reconcileRow(rowNumbers('2  SR-2210  Quick coupler NPT 1/2"  1200  3.20  3840.00'));
    expect(best).toMatchObject({ qty: 1200, unitPrice: 3.2, lineTotal: 3840 });
  });

  it("returns null when nothing on the line reconciles", () => {
    expect(reconcileRow(rowNumbers("Port of Loading: Ningbo   Destination: Ashdod"))).toBeNull();
  });
});

describe("parseLooseDate", () => {
  it("reads day-first and flags the ambiguity", () => {
    expect(parseLooseDate("03.02.2026")).toEqual({ iso: "2026-02-03", ambiguous: true });
    expect(parseLooseDate("25/04/2026")).toEqual({ iso: "2026-04-25", ambiguous: false });
    expect(parseLooseDate("2026-03-14")).toEqual({ iso: "2026-03-14", ambiguous: false });
    expect(parseLooseDate("14 Mar 2026")).toEqual({ iso: "2026-03-14", ambiguous: false });
  });
});

describe("parseForeignDocLines", () => {
  it("reads a Chinese proforma invoice whose items sum to the stated total", () => {
    const doc = parseForeignDocLines(CHINESE_PI, "pi.pdf");
    expect(doc.piNumber).toBe("SR-PI-26031");
    expect(doc.currency).toBe("USD");
    expect(doc.orderDate).toBe("2026-03-14");
    expect(doc.deliveryDate).toBe("2026-04-25");
    expect(doc.items).toHaveLength(3);
    expect(doc.items[1]).toMatchObject({ code: "SR-2210", qty: 1200, unitPrice: 3.2, lineTotal: 3840 });
    expect(doc.subtotal).toBeCloseTo(12445, 2);
    expect(doc.total).toBeCloseTo(12445, 2);
    expect(doc.notes).toContain("FOB");
  });

  it("does not mistake a piece count for the money total", () => {
    const doc = parseForeignDocLines(CHINESE_PI, "pi.pdf");
    expect(doc.total).not.toBe(2000);
    expect(doc.warnings.join(" ")).not.toContain("לא תואם");
  });

  it("reads an Italian order confirmation in European number format", () => {
    const doc = parseForeignDocLines(ITALIAN_CONFIRMATION, "oc.xlsx");
    expect(doc.piNumber).toBe("OC/2026/0417");
    expect(doc.currency).toBe("EUR");
    expect(doc.orderDate).toBe("2026-02-03");
    expect(doc.items).toHaveLength(3);
    // 2.400 is 2400 here — the only reading that makes the row reconcile.
    expect(doc.items[0]).toMatchObject({ qty: 2400, unitPrice: 1.85, lineTotal: 4440 });
    expect(doc.subtotal).toBeCloseTo(10630, 2);
    expect(doc.total).toBeCloseTo(10630, 2);
    expect(doc.warnings.join(" ")).toContain("דו-משמעי");
  });

  it("warns when the item rows do not add up to the document total", () => {
    const doc = parseForeignDocLines([
      "PROFORMA INVOICE  PI No.: X-9001   Date: 01/03/2026",
      "1  AB-1  Widget   10   5.00   50.00",
      "Total Amount USD: 120.00",
    ], "short.pdf");
    expect(doc.items).toHaveLength(1);
    expect(doc.warnings.join(" ")).toContain("לא תואם");
  });

  it("says what is missing when no row reconciles", () => {
    const doc = parseForeignDocLines(["Dear customer", "please find our offer attached"], "note.pdf");
    expect(doc.items).toHaveLength(0);
    expect(doc.warnings.join(" ")).toContain("לא זוהו שורות פריטים");
  });
});

describe("tokensToLines", () => {
  it("groups positioned tokens into lines, top of the page first", () => {
    const token = (x: number, y: number, raw: string): PdfTextLine =>
      ({ x0: x, x1: x + raw.length * 5, y, raw, norm: raw });
    const lines = tokensToLines([
      token(300, 700, "INVOICE"),
      token(40, 660, "Item"),
      token(200, 661, "Qty"),
      token(320, 659, "Price"),
    ]);
    expect(lines).toEqual(["INVOICE", "Item Qty Price"]);
  });
});
