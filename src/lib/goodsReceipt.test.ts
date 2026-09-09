import { describe, it, expect } from "vitest";
import {
  buildGoodsReceiptSubject,
  formatReceiptDate,
  isLikelyInvoice,
  warehouseLabel,
  type GoodsReceiptLine,
} from "./goodsReceipt";

const line = (over: Partial<GoodsReceiptLine>): GoodsReceiptLine => ({
  key: "k",
  supplier_code: "54538",
  supplier_name: "AutoStar / Just Supply",
  product_code: "M305",
  product_name: "Blindspot",
  qty: "200",
  receipt_date: "22/08/2026",
  warehouse: "מחסן 011",
  received_by: "אורטל",
  ...over,
});

describe("buildGoodsReceiptSubject", () => {
  it("uses the product codes", () => {
    expect(buildGoodsReceiptSubject([line({})])).toBe("הגעת סחורה - M305");
  });

  it("lists several products once each", () => {
    const lines = [line({ key: "a" }), line({ key: "b", product_code: "M712" }), line({ key: "c" })];
    expect(buildGoodsReceiptSubject(lines)).toBe("הגעת סחורה - M305, M712");
  });

  it("falls back to the product name when there is no code", () => {
    expect(buildGoodsReceiptSubject([line({ product_code: "" })])).toBe("הגעת סחורה - Blindspot");
  });

  it("degrades to a bare subject when nothing identifies the goods", () => {
    expect(buildGoodsReceiptSubject([line({ product_code: "", product_name: "" })])).toBe("הגעת סחורה");
  });
});

describe("formatReceiptDate", () => {
  it("pads day and month", () => {
    expect(formatReceiptDate(new Date(2026, 7, 2))).toBe("02/08/2026");
  });
});

describe("warehouseLabel", () => {
  it("prefers the SAP code the clerk books against", () => {
    expect(warehouseLabel({ name: "פריזבי קרסו", sap_code: "011" })).toBe("מחסן 011");
  });

  it("falls back to the centre name", () => {
    expect(warehouseLabel({ name: "יחידת היבואנים", sap_code: null })).toBe("יחידת היבואנים");
  });
});

describe("isLikelyInvoice", () => {
  it("matches the document subtype", () => {
    expect(isLikelyInvoice({ document_subtype: "COMMERCIAL_INVOICE" })).toBe(true);
  });

  it("matches a PI document", () => {
    expect(isLikelyInvoice({ type: "PI" })).toBe(true);
  });

  it("matches on the file name", () => {
    expect(isLikelyInvoice({ document_name: "Autostar updated PI to LD XM-A260420.pdf" })).toBe(true);
    expect(isLikelyInvoice({ document_name: "חשבונית ספק.pdf" })).toBe(true);
  });

  it("does not match unrelated paperwork", () => {
    expect(isLikelyInvoice({ document_subtype: "BL", document_name: "bill of lading.pdf" })).toBe(false);
  });
});
