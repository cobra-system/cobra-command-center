import { describe, it, expect } from "vitest";
import { normalizeTokens, parseSapPoLines, type PdfTextLine } from "./sapPdf";
import { matchItems, matchSupplier } from "./match";
import type { Product, Supplier } from "@/contexts/types";

/**
 * Text tokens pdfjs actually returns for a real Cobra SAP purchase order
 * (PO 315728, די.סי.פאק) — the exact input the browser importer works from.
 * Guards the parser against regressions on the template that is in use today:
 * split "₪" tokens, the two-token "שוטף+60", the free-text comment row next to
 * the VAT totals, and the generic 9999 item code.
 */
const TOKENS: Omit<PdfTextLine, "norm">[] = [
  {"x0":531,"x1":562,"y":746,"raw":"לכבוד:"},
  {"x0":455,"x1":527,"y":746,"raw":"די.סי.פאק בע\"מ"},
  {"x0":120,"x1":147,"y":748,"raw":"תאריך:"},
  {"x0":41,"x1":73,"y":748,"raw":"16/08/26"},
  {"x0":477,"x1":527,"y":729,"raw":"קיבוץ חורשים"},
  {"x0":477,"x1":527,"y":711,"raw":"קיבוץ חורשים"},
  {"x0":454,"x1":476,"y":711,"raw":"45865"},
  {"x0":493,"x1":527,"y":703,"raw":"ISRAEL"},
  {"x0":127,"x1":147,"y":729,"raw":"שעה:"},
  {"x0":41,"x1":62,"y":729,"raw":"13:06"},
  {"x0":106,"x1":147,"y":709,"raw":"מספר ע.מ.:"},
  {"x0":41,"x1":79,"y":709,"raw":"511211559"},
  {"x0":41,"x1":62,"y":657,"raw":"50420"},
  {"x0":301,"x1":366,"y":648,"raw":"הזמðת רכש"},
  {"x0":245,"x1":286,"y":648,"raw":"315728"},
  {"x0":41,"x1":98,"y":638,"raw":"די.סי.פאק בע\"מ"},
  {"x0":567,"x1":571,"y":618,"raw":"#"},
  {"x0":523,"x1":556,"y":618,"raw":"קוד פריט"},
  {"x0":457,"x1":496,"y":618,"raw":"מק\"ט יצרן"},
  {"x0":415,"x1":437,"y":618,"raw":"תיאור"},
  {"x0":203,"x1":257,"y":618,"raw":"תאריך אספקה"},
  {"x0":177,"x1":196,"y":618,"raw":"כמות"},
  {"x0":138,"x1":157,"y":618,"raw":"מחיר"},
  {"x0":86,"x1":107,"y":618,"raw":"סה\"כ"},
  {"x0":567,"x1":571,"y":599,"raw":"1"},
  {"x0":540,"x1":557,"y":599,"raw":"9999"},
  {"x0":378,"x1":437,"y":599,"raw":"K-EL4017438-0"},
  {"x0":213,"x1":245,"y":599,"raw":"16/08/26"},
  {"x0":177,"x1":197,"y":599,"raw":"1,000"},
  {"x0":142,"x1":156,"y":599,"raw":"2.30"},
  {"x0":133,"x1":140,"y":599,"raw":"₪"},
  {"x0":78,"x1":108,"y":599,"raw":"2,300.00"},
  {"x0":69,"x1":76,"y":599,"raw":"₪"},
  {"x0":523,"x1":577,"y":575,"raw":"תאריך אספקה"},
  {"x0":431,"x1":463,"y":575,"raw":"16/08/26"},
  {"x0":157,"x1":216,"y":570,"raw":"סה\"כ חייב מע\"מ"},
  {"x0":78,"x1":108,"y":570,"raw":"2,300.00"},
  {"x0":69,"x1":76,"y":570,"raw":"₪"},
  {"x0":557,"x1":576,"y":537,"raw":"סוכן:"},
  {"x0":469,"x1":507,"y":537,"raw":"-ללא סוכן-"},
  {"x0":530,"x1":577,"y":518,"raw":"תðאי תשלום:"},
  {"x0":482,"x1":507,"y":518,"raw":"שוטף+"},
  {"x0":473,"x1":481,"y":518,"raw":"60"},
  {"x0":469,"x1":576,"y":489,"raw":"הזמðה לתל אביב תוצרת הארץ"},
  {"x0":459,"x1":467,"y":489,"raw":"15"},
  {"x0":197,"x1":216,"y":484,"raw":"מע\"מ"},
  {"x0":171,"x1":179,"y":484,"raw":"%"},
  {"x0":147,"x1":167,"y":484,"raw":"18.00"},
  {"x0":84,"x1":108,"y":484,"raw":"414.00"},
  {"x0":76,"x1":83,"y":484,"raw":"₪"},
  {"x0":195,"x1":217,"y":465,"raw":"סה\"כ"},
  {"x0":78,"x1":108,"y":465,"raw":"2,714.00"},
  {"x0":69,"x1":76,"y":465,"raw":"₪"},
  {"x0":218,"x1":392,"y":50,"raw":"ל.ד. ישראל אוטו אקוויפמðט בע\"מ"},
  {"x0":303,"x1":363,"y":34,"raw":"רח' תוצרת הארץ"},
  {"x0":292,"x1":300,"y":34,"raw":"15"},
  {"x0":257,"x1":292,"y":34,"raw":", תל-אביב"},
  {"x0":234,"x1":255,"y":34,"raw":"67891"},
  {"x0":345,"x1":358,"y":26,"raw":"טל:"},
  {"x0":302,"x1":342,"y":26,"raw":"03-6911124"},
  {"x0":281,"x1":300,"y":26,"raw":"פקס:"},
  {"x0":238,"x1":278,"y":26,"raw":"03-6911127"},
  {"x0":252,"x1":344,"y":17,"raw":"email: info@cobra.co.il"},
  {"x0":563,"x1":576,"y":30,"raw":"דף:"},
  {"x0":552,"x1":557,"y":30,"raw":"1"},
  {"x0":105,"x1":157,"y":30,"raw":"מפיק המסמך:"},
  {"x0":1,"x1":98,"y":30,"raw":"דðיאל- קוברה מðהל פרויקט"}
];

const LINES = normalizeTokens(TOKENS);

describe("real SAP purchase order (315728) as pdfjs returns it", () => {
  const doc = parseSapPoLines(LINES, "po-315728.pdf");

  it("keeps pdfjs's logical Hebrew instead of re-reversing it", () => {
    expect(LINES.find(l => l.raw === "לכבוד:")?.norm).toBe("לכבוד:");
  });

  it("reads the order header", () => {
    expect(doc.poNumber).toBe("315728");
    expect(doc.orderDate).toBe("2026-08-16");
    expect(doc.supplierName).toBe('די.סי.פאק בע"מ');
    expect(doc.supplierVat).toBe("511211559");
    expect(doc.supplierCode).toBe("50420");
    expect(doc.paymentTerms).toBe("שוטף+60");
    expect(doc.deliveryDate).toBe("2026-08-16");
  });

  it("carries the free-text comment into the notes, without the totals column", () => {
    expect(doc.notes).toBe("הזמנה לתל אביב תוצרת הארץ 15");
  });

  it("drops SAP's \"no agent\" placeholder", () => {
    expect(doc.agent).toBeUndefined();
  });

  it("reads the line item, including prices split from their ₪ token", () => {
    expect(doc.items).toHaveLength(1);
    expect(doc.items[0]).toMatchObject({
      code: "9999",
      description: "K-EL4017438-0",
      qty: 1000,
      unitPrice: 2.3,
      lineTotal: 2300,
      deliveryDate: "2026-08-16",
    });
  });

  it("reconciles the totals", () => {
    expect(doc.subtotal).toBe(2300);
    expect(doc.vatRate).toBe(18);
    expect(doc.vatAmount).toBe(414);
    expect(doc.total).toBe(2714);
    expect(doc.warnings).toEqual([]);
  });

  it("matches the supplier by its SAP vendor code", () => {
    const suppliers: Supplier[] = [
      { id: "s1", company: "ספק אחר", contact_name: "x" },
      { id: "s2", company: "די.סי.פאק", contact_name: "y", sap_code: "50420" },
    ];
    const m = matchSupplier(doc, suppliers);
    expect(m.supplier?.id).toBe("s2");
    expect(m.reason).toBe("sap_code");
  });

  it("never binds a generic 9999 line to a product by its code", () => {
    const products: Product[] = [{
      id: "p1", category: "כללי", name: "פריט 9999", sku: "9999",
      product_type: "מוצר", stock_qty: 0, incoming_qty: 0,
    }];
    const [line] = matchItems(doc.items, products);
    expect(line.generic).toBe(true);
    expect(line.product).toBeNull();
  });

  it("still binds a generic line when its description is a known SKU", () => {
    const products: Product[] = [{
      id: "p2", category: "כללי", name: "אריזת קרטון", sku: "K-EL4017438-0",
      product_type: "מוצר", stock_qty: 0, incoming_qty: 0,
    }];
    const [line] = matchItems(doc.items, products);
    expect(line.generic).toBe(true);
    expect(line.product?.id).toBe("p2");
    expect(line.reason).toBe("sku");
  });
});
