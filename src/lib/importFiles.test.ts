import { describe, it, expect } from "vitest";
import {
  deriveFileNumber,
  guessSubtype,
  guessDocumentNumber,
  sumImportCosts,
  lineAmountIls,
  isCostBearing,
  type ImportCostLine,
} from "./importFiles";

/**
 * The fixtures below are a real dossier: Total Care file 460509, a sea shipment
 * from Shenzhen iStarVideo that arrived in Ashdod on 16/05/26. Using the actual
 * file names and amounts keeps these tests honest about the shapes the parser
 * and the totals really have to survive.
 */

describe("guessSubtype", () => {
  it("classifies every document in a real dossier", () => {
    expect(guessSubtype("Commercial_Invoice_460509.pdf")).toBe("COMMERCIAL_INVOICE");
    expect(guessSubtype("Packing_List_460509.pdf")).toBe("PACKING_LIST");
    expect(guessSubtype("HAWB_460509.pdf")).toBe("BL");
    expect(guessSubtype("WG_Declaration_26024532019850.pdf")).toBe("DECLARATION");
    expect(guessSubtype("Freight_Tax_Invoice_460509.pdf")).toBe("FREIGHT_INVOICE");
    expect(guessSubtype("MASOF_207_Supplier_Invoice_1255982.pdf")).toBe("TERMINAL_INVOICE");
    expect(guessSubtype("Inv_197112.pdf")).toBe("FORWARDER_INVOICE");
  });

  it("prefers the specific invoice kind over the generic one", () => {
    // "Freight_Tax_Invoice" matches both /freight/ and /invoice/; the freight
    // rule comes first, so the generic forwarder-invoice rule must not win.
    expect(guessSubtype("Freight_Tax_Invoice_460509.pdf")).toBe("FREIGHT_INVOICE");
    expect(guessSubtype("Terminal_Invoice.pdf")).toBe("TERMINAL_INVOICE");
  });

  it("reads Hebrew file names", () => {
    expect(guessSubtype("רשימון יבוא 26024532019850.pdf")).toBe("DECLARATION");
    expect(guessSubtype("רשימת אריזה.pdf")).toBe("PACKING_LIST");
    expect(guessSubtype("שטר מטען.pdf")).toBe("BL");
  });

  it("falls back to OTHER when nothing matches", () => {
    expect(guessSubtype("scan_001.pdf")).toBe("OTHER");
    expect(guessSubtype("")).toBe("OTHER");
  });
});

describe("guessDocumentNumber", () => {
  it("takes the last long digit run in the name", () => {
    expect(guessDocumentNumber("Inv_197112.pdf")).toBe("197112");
    expect(guessDocumentNumber("MASOF_207_Supplier_Invoice_1255982.pdf")).toBe("1255982");
    expect(guessDocumentNumber("WG_Declaration_26024532019850.pdf")).toBe("26024532019850");
  });

  it("returns empty when there is no number to take", () => {
    expect(guessDocumentNumber("packing list.pdf")).toBe("");
    // "207" is only three digits — too short to be a document number.
    expect(guessDocumentNumber("MASOF_207.pdf")).toBe("");
  });
});


describe("deriveFileNumber", () => {
  /** The seven attachments of Total Care file 460509, as they arrive. */
  const REAL_BATCH = [
    "Commercial_Invoice_460509.pdf",
    "Packing_List_460509.pdf",
    "HAWB_460509.pdf",
    "WG_Declaration_26024532019850.pdf",
    "Freight_Tax_Invoice_460509.pdf",
    "MASOF_207_Supplier_Invoice_1255982.pdf",
    "Inv_197112.pdf",
  ];

  it("picks the forwarder file number shared across a real batch", () => {
    // 460509 is on four files; the declaration, terminal and summary invoice
    // numbers appear once each and must not win.
    expect(deriveFileNumber(REAL_BATCH)).toBe("460509");
  });

  it("ignores a 14-digit declaration number", () => {
    expect(deriveFileNumber([
      "WG_Declaration_26024532019850.pdf",
      "WG_Declaration_26024532019850_copy.pdf",
    ])).toBeNull();
  });

  it("ignores a short code like the 207 terminal number", () => {
    expect(deriveFileNumber(["MASOF_207_a.pdf", "MASOF_207_b.pdf"])).toBeNull();
  });

  it("returns null when nothing repeats", () => {
    expect(deriveFileNumber(["Inv_197112.pdf"])).toBeNull();
    expect(deriveFileNumber(["scan1.pdf", "scan2.pdf"])).toBeNull();
    expect(deriveFileNumber([])).toBeNull();
  });

  it("counts a number once per file", () => {
    // Two files, one of which repeats 460509 — still two votes, not three,
    // so a single noisy name cannot outvote a genuinely shared number.
    expect(deriveFileNumber([
      "460509_Invoice_460509.pdf",
      "Packing_460509.pdf",
    ])).toBe("460509");
  });

  it("survives a partial batch arriving later", () => {
    // The last three attachments turn up a day after the first four; they
    // still resolve to the same dossier.
    expect(deriveFileNumber(REAL_BATCH.slice(0, 3))).toBe("460509");
  });
});

describe("lineAmountIls", () => {
  it("uses the converted amount when the document supplied one", () => {
    expect(lineAmountIls({ amount: 1009.36, amount_ils: 3240.05, currency: "USD" })).toBe(3240.05);
  });

  it("uses the amount directly when it is already in shekels", () => {
    expect(lineAmountIls({ amount: 1620.01, amount_ils: null, currency: "ILS" })).toBe(1620.01);
  });

  it("refuses to guess a rate for an unconverted foreign amount", () => {
    expect(lineAmountIls({ amount: 20, amount_ils: null, currency: "USD" })).toBeNull();
  });
});

describe("isCostBearing", () => {
  it("excludes recoverable VAT and lines nested in another invoice", () => {
    expect(isCostBearing({ is_recoverable: false, included_in_document_id: null })).toBe(true);
    expect(isCostBearing({ is_recoverable: true, included_in_document_id: null })).toBe(false);
    expect(isCostBearing({ is_recoverable: false, included_in_document_id: "doc-1" })).toBe(false);
  });
});

/** Build a cost line with sensible defaults for the fields a test ignores. */
function line(partial: Partial<ImportCostLine>): ImportCostLine {
  return {
    id: Math.random().toString(36).slice(2),
    import_file_id: "file-1",
    document_id: null,
    line_code: null,
    label: "charge",
    category: "other",
    amount: 0,
    currency: "ILS",
    amount_ils: null,
    is_recoverable: false,
    included_in_document_id: null,
    notes: null,
    created_at: "2026-05-26T00:00:00Z",
    ...partial,
  };
}

describe("sumImportCosts", () => {
  /**
   * Total Care summary invoice 197112. Its lines are the whole cost of the
   * shipment: import VAT (reclaimed), the charges that make up landed cost,
   * and — critically — freight and terminal amounts that are ALSO issued as
   * their own standalone invoices in the same dossier.
   */
  const SUMMARY_DOC = "doc-197112";

  const dossier: ImportCostLine[] = [
    line({ label: 'מע"מ למכס', category: "vat", amount: 122522, is_recoverable: true }),
    line({ label: "אגרת מחשב ובטחון", category: "fees", amount: 91 }),
    line({ label: "הובלה משילוח לעמילות", category: "freight", amount: 5872.64 }),
    line({ label: "מיסי נמל", category: "fees", amount: 33 }),
    line({ label: "עמילות מכס", category: "clearance", amount: 235 }),
    line({ label: "הובלה יבשתית", category: "inland", amount: 1500 }),
    line({ label: "פורמאליות", category: "fees", amount: 45 }),
    line({ label: "שער עולמי", category: "fees", amount: 20, currency: "USD", amount_ils: 60.07 }),
    line({ label: "מסוף ימי חייב", category: "terminal", amount: 1620.01 }),
  ];

  it("computes landed cost without the recoverable VAT", () => {
    const totals = sumImportCosts(dossier);
    // 91 + 5872.64 + 33 + 235 + 1500 + 45 + 60.07 + 1620.01
    expect(totals.landed).toBeCloseTo(9456.72, 2);
    expect(totals.recoverable).toBe(122522);
  });

  it("reports cash out as landed cost plus the reclaimed VAT", () => {
    const totals = sumImportCosts(dossier);
    expect(totals.cashOut).toBeCloseTo(131978.72, 2);
  });

  it("does not count a charge twice when it is restated in the summary invoice", () => {
    // The dossier also contains freight invoice 196833 and terminal invoice
    // 1255982 as separate documents. Both are already inside invoice 197112,
    // so they are recorded pointing at it and must not move the landed total.
    const withNested = [
      ...dossier,
      line({ label: "Freight invoice 196833", category: "freight", amount: 5872.64, included_in_document_id: SUMMARY_DOC }),
      line({ label: "Terminal invoice 1255982", category: "terminal", amount: 1620.01, included_in_document_id: SUMMARY_DOC }),
    ];

    const totals = sumImportCosts(withNested);
    expect(totals.landed).toBeCloseTo(9456.72, 2);
    expect(totals.duplicated).toBeCloseTo(7492.65, 2);
    // Without the nesting flag this would have been ~7,492 too high.
    expect(totals.landed).toBeLessThan(sumImportCosts(
      withNested.map(l => ({ ...l, included_in_document_id: null }))
    ).landed);
  });

  it("skips a foreign-currency line that was never converted", () => {
    const totals = sumImportCosts([
      line({ label: "converted", amount: 20, currency: "USD", amount_ils: 60.07 }),
      line({ label: "unconverted", amount: 500, currency: "USD" }),
    ]);
    // Only the converted line counts — 500 USD is not silently added as ₪500.
    expect(totals.landed).toBeCloseTo(60.07, 2);
  });

  it("returns zeroes for an empty dossier", () => {
    expect(sumImportCosts([])).toEqual({ landed: 0, recoverable: 0, duplicated: 0, cashOut: 0 });
  });
});
