import { describe, it, expect } from "vitest";
import { sanitizeFileName, swiftDocumentName } from "./swiftDocuments";

describe("sanitizeFileName", () => {
  it("keeps plain ASCII names intact", () => {
    expect(sanitizeFileName("swift-confirmation.pdf")).toBe("swift-confirmation.pdf");
  });

  it("replaces Hebrew and spaces with a single underscore run", () => {
    expect(sanitizeFileName("בקשה להעברה 70000.pdf")).toBe("_70000.pdf");
  });

  it("collapses repeated separators", () => {
    expect(sanitizeFileName("a   b///c.pdf")).toBe("a_b_c.pdf");
  });
});

describe("swiftDocumentName", () => {
  it("builds a name from the installment", () => {
    expect(swiftDocumentName({ payment_type: "Deposit", amount: 70000, currency: "USD" })).toBe("SWIFT מקדמה 70,000 USD");
  });

  it("omits the amount when there is none", () => {
    expect(swiftDocumentName({ payment_type: "Balance", amount: 0, currency: "EUR" })).toBe("SWIFT יתרה");
  });

  it("falls back to the file name without extension when there is no payment", () => {
    expect(swiftDocumentName(null, "wire_confirmation.pdf")).toBe("wire_confirmation");
  });

  it("falls back to SWIFT with no payment and no file name", () => {
    expect(swiftDocumentName(null)).toBe("SWIFT");
  });
});
