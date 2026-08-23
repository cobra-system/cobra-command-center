import { describe, it, expect } from "vitest";
import type { Product, Supplier } from "@/contexts/types";
import { matchItems, matchProduct, matchSupplier, normalizeCode } from "./match";
import { emptyParsedDoc } from "./types";

const supplier = (over: Partial<Supplier>): Supplier => ({
  id: over.id || "s1",
  company: over.company || "חברה",
  contact_name: over.contact_name || "איש קשר",
  ...over,
});

const product = (over: Partial<Product>): Product => ({
  id: over.id || "p1",
  category: "כללי",
  name: over.name || "מוצר",
  sku: over.sku || "SKU-1",
  product_type: "מוצר",
  stock_qty: 0,
  incoming_qty: 0,
  ...over,
});

const docWith = (fields: Partial<ReturnType<typeof emptyParsedDoc>>) =>
  ({ ...emptyParsedDoc("sap-pdf", "f.pdf"), ...fields });

describe("normalizeCode", () => {
  it("ignores case, spaces and separators", () => {
    expect(normalizeCode("abc-123")).toBe(normalizeCode("ABC 123"));
    expect(normalizeCode("A.B/C")).toBe("abc");
  });
});

describe("matchSupplier", () => {
  const suppliers = [
    supplier({ id: "s1", company: "אלקטרוניקה בע\"מ", sap_code: "514789632" }),
    supplier({ id: "s2", company: "Shenzhen Optics Ltd", supplier_number: "V-1002" }),
    supplier({ id: "s3", company: "אלקטרוניקה ישראל" }),
  ];

  it("prefers the SAP vendor code", () => {
    const m = matchSupplier(docWith({ supplierVat: "514789632", supplierName: "שם אחר לגמרי" }), suppliers);
    expect(m.supplier?.id).toBe("s1");
    expect(m.reason).toBe("sap_code");
  });

  it("falls back to the supplier number", () => {
    const m = matchSupplier(docWith({ supplierVat: "V 1002" }), suppliers);
    expect(m.supplier?.id).toBe("s2");
    expect(m.reason).toBe("supplier_number");
  });

  it("matches an exact company name", () => {
    const m = matchSupplier(docWith({ supplierName: "Shenzhen Optics Ltd" }), suppliers);
    expect(m.supplier?.id).toBe("s2");
    expect(m.reason).toBe("exact_name");
  });

  it("returns no match when the name is ambiguous", () => {
    const m = matchSupplier(docWith({ supplierName: "אלקטרוניקה" }), suppliers);
    expect(m.supplier).toBeNull();
  });

  it("returns no match when there is nothing to match on", () => {
    expect(matchSupplier(docWith({}), suppliers).supplier).toBeNull();
  });
});

describe("matchProduct", () => {
  const products = [
    product({ id: "p1", name: "מצלמת אבטחה", sku: "ABC-123" }),
    product({ id: "p2", name: "כבל רשת", sku: "CBL-1", sap_code: "XYZ9" }),
    product({ id: "p3", name: "מצלמת אבטחה חיצונית", sku: "ABC-999" }),
  ];

  it("matches on SKU regardless of separators", () => {
    const m = matchProduct({ code: "abc123" }, products);
    expect(m.product?.id).toBe("p1");
    expect(m.reason).toBe("sku");
  });

  it("matches on the SAP item code", () => {
    const m = matchProduct({ code: "XYZ-9" }, products);
    expect(m.product?.id).toBe("p2");
    expect(m.reason).toBe("sap_code");
  });

  it("matches an exact name when there is no code", () => {
    const m = matchProduct({ description: "כבל רשת" }, products);
    expect(m.product?.id).toBe("p2");
    expect(m.reason).toBe("exact_name");
  });

  it("leaves ambiguous descriptions unmatched", () => {
    // "מצלמת אבטחה" is contained in two product names — exact wins over fuzzy…
    expect(matchProduct({ description: "מצלמת" }, products).product).toBeNull();
  });

  it("leaves unknown codes unmatched", () => {
    const m = matchProduct({ code: "NOPE-1", description: "פריט לא מוכר" }, products);
    expect(m.product).toBeNull();
    expect(m.reason).toBeNull();
  });

  it("matchItems keeps the parsed line next to its match", () => {
    const matched = matchItems([{ code: "ABC-123", qty: 2 }, { code: "NOPE" }], products);
    expect(matched).toHaveLength(2);
    expect(matched[0].product?.id).toBe("p1");
    expect(matched[0].parsed.qty).toBe(2);
    expect(matched[1].product).toBeNull();
  });
});
