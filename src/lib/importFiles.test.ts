import { describe, it, expect } from "vitest";
import {
  IMPORT_DOC_SUBTYPES,
  deriveFileNumber,
  importStorageKey,
  sanitizeFileName,
  guessSubtype,
  guessDocumentNumber,
  sumImportCosts,
  shippingUnitCost,
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


describe("importStorageKey", () => {
  /**
   * The bug this guards: sanitizeFileName strips every non-ASCII character, so
   * every Hebrew name collapses to "_.pdf". Keyed on a timestamp plus that
   * name, a batch of Hebrew-named attachments uploaded inside one millisecond
   * produced identical paths and storage rejected all but the first — a drop
   * of ten files quietly landed two.
   */
  const HEBREW_BATCH = [
    "חשבונית הובלה.pdf",
    "רשימת אריזה.pdf",
    "שטר מטען.pdf",
    "חשבונית מסוף.pdf",
    "רשימון יבוא.pdf",
  ];

  it("collapses Hebrew names to one string — the reason keys cannot use them", () => {
    const sanitized = new Set(HEBREW_BATCH.map(sanitizeFileName));
    expect(sanitized.size).toBe(1);
    expect(sanitized.has("_.pdf")).toBe(true);
  });

  it("still gives every file in a Hebrew batch a distinct key", () => {
    const keys = HEBREW_BATCH.map(name => importStorageKey("file-1", name));
    expect(new Set(keys).size).toBe(HEBREW_BATCH.length);
  });

  it("gives the same file name a fresh key each call", () => {
    // Two uploads of the same document must not overwrite one another.
    const a = importStorageKey("file-1", "שטר מטען.pdf");
    const b = importStorageKey("file-1", "שטר מטען.pdf");
    expect(a).not.toBe(b);
  });

  it("files the object under its dossier and keeps ASCII names readable", () => {
    const key = importStorageKey("file-1", "Commercial_Invoice_460509.pdf");
    expect(key.startsWith("imports/file-1/")).toBe(true);
    expect(key.endsWith("_Commercial_Invoice_460509.pdf")).toBe(true);
  });
});


describe("IMPORT_DOC_SUBTYPES", () => {
  /**
   * Mirrors the CHECK on purchase_documents.document_subtype, as set by
   * supabase/migrations/20260830000002_extend_document_subtypes_for_imports.sql.
   *
   * These two lists drifting apart is not a cosmetic problem: the app wrote
   * COMMERCIAL_INVOICE, DECLARATION and the rest while the database still only
   * allowed the original nine, so every insert of those kinds was rejected and
   * the documents were lost. A batch of ten filed two.
   *
   * If this test fails, one of the two was changed alone — add the value to
   * the constraint in a migration, or take it out of the app.
   */
  const DB_ALLOWED_SUBTYPES = [
    "PI", "PO", "SWIFT", "BL", "PACKING_LIST", "INVOICE", "COA", "CUSTOMS", "OTHER",
    "COMMERCIAL_INVOICE", "DECLARATION", "FREIGHT_INVOICE", "TERMINAL_INVOICE",
    "FORWARDER_INVOICE", "INSURANCE", "CERTIFICATE_OF_ORIGIN",
  ];

  it("only contains values the database constraint accepts", () => {
    const rejected = IMPORT_DOC_SUBTYPES.filter(s => !DB_ALLOWED_SUBTYPES.includes(s));
    expect(rejected).toEqual([]);
  });

  it("covers every kind guessSubtype can return", () => {
    // guessSubtype's fallback and every hint target must be writable, or a
    // correctly classified document fails to save.
    const guessed = [
      "Commercial_Invoice_460509.pdf", "Packing_List_460509.pdf", "HAWB_460509.pdf",
      "WG_Declaration_26024532019850.pdf", "Freight_Tax_Invoice_460509.pdf",
      "MASOF_207_Supplier_Invoice_1255982.pdf", "Inv_197112.pdf",
      "Certificate_of_Origin.pdf", "Insurance_policy.pdf", "scan_001.pdf",
    ].map(guessSubtype);

    for (const subtype of guessed) {
      expect(DB_ALLOWED_SUBTYPES).toContain(subtype);
    }
  });
});


describe("DHL dossiers", () => {
  /**
   * A third forwarder, and the one that breaks naive naming. DHL sends four
   * files named after the air waybill:
   *
   *   5060974542_awb.pdf       the air waybill
   *   5060974542_sad.pdf       the customs declaration (Single Administrative Document)
   *   5060974542_ppwk.pdf      "paperwork" — actually the shipper's commercial invoice
   *   5060974542_proforma.pdf  "proforma" — actually DHL's own clearance charges bill
   *
   * The last two read backwards from what they contain, which is why they are
   * pinned by name rather than left to the generic invoice rule.
   */
  const DHL_BATCH = [
    "5060974542_ppwk.pdf",
    "5060974542_proforma.pdf",
    "5060974542_sad.pdf",
    "5060974542_awb.pdf",
  ];

  it("groups the batch under the 10-digit air waybill", () => {
    // At the previous 8-digit ceiling this returned null and the whole batch
    // landed under a generated placeholder.
    expect(deriveFileNumber(DHL_BATCH)).toBe("5060974542");
  });

  it("still refuses the 14-digit declaration number", () => {
    expect(deriveFileNumber([
      "WG_Declaration_26044752943862.pdf",
      "WG_Declaration_26044752943862_v2.pdf",
    ])).toBeNull();
  });

  it("classifies every file in the batch", () => {
    expect(guessSubtype("5060974542_awb.pdf")).toBe("BL");
    expect(guessSubtype("5060974542_sad.pdf")).toBe("DECLARATION");
    expect(guessSubtype("5060974542_ppwk.pdf")).toBe("COMMERCIAL_INVOICE");
    expect(guessSubtype("5060974542_proforma.pdf")).toBe("FORWARDER_INVOICE");
  });

  it("does not fire the SAD rule inside an unrelated word", () => {
    // "sad" inside a longer word must not claim the file as a declaration:
    // the first name still resolves on its own merits, the second matches
    // nothing at all.
    expect(guessSubtype("sadna_packing_list.pdf")).toBe("PACKING_LIST");
    expect(guessSubtype("upsadown.pdf")).toBe("OTHER");
    expect(guessSubtype("sadna.pdf")).toBe("OTHER");
  });

  it("leaves the other forwarders' batches classified as before", () => {
    // Adding DHL's rules must not disturb Total Care or Swissport naming.
    expect(guessSubtype("Freight_Tax_Invoice_460509.pdf")).toBe("FREIGHT_INVOICE");
    expect(guessSubtype("MASOF_207_Supplier_Invoice_1255982.pdf")).toBe("TERMINAL_INVOICE");
    expect(guessSubtype("Commercial_Invoice_460509.pdf")).toBe("COMMERCIAL_INVOICE");
    expect(guessSubtype("Inv_197112.pdf")).toBe("FORWARDER_INVOICE");
    expect(deriveFileNumber([
      "Commercial_Invoice_460509.pdf",
      "Packing_List_460509.pdf",
      "HAWB_460509.pdf",
      "WG_Declaration_26024532019850.pdf",
    ])).toBe("460509");
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
    expect(sumImportCosts([])).toEqual({
      landed: 0, shipping: 0, customs: 0, recoverable: 0, duplicated: 0, cashOut: 0,
    });
  });
});

describe("shipping vs customs split", () => {
  /**
   * Total Care file 460509 again. The point of the split: ₪9,456.72 of landed
   * cost is not all "shipping" — ₪404 of it is brokerage and statutory fees
   * that follow from what was imported, not from how it travelled. Comparing
   * an air shipment to a sea one on the mixed figure is meaningless.
   */
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

  it("counts only the transport charges as shipping", () => {
    const totals = sumImportCosts(dossier);
    // freight 5872.64 + inland 1500 + terminal 1620.01
    expect(totals.shipping).toBeCloseTo(8992.65, 2);
  });

  it("counts brokerage and statutory fees as customs", () => {
    const totals = sumImportCosts(dossier);
    // fees 91 + 33 + 45 + 60.07, clearance 235
    expect(totals.customs).toBeCloseTo(464.07, 2);
  });

  it("keeps the split adding back up to landed cost", () => {
    const totals = sumImportCosts(dossier);
    expect(totals.shipping + totals.customs).toBeCloseTo(totals.landed, 2);
  });

  it("leaves recoverable VAT out of both sides", () => {
    const totals = sumImportCosts(dossier);
    expect(totals.recoverable).toBe(122522);
    expect(totals.shipping).toBeLessThan(totals.recoverable);
  });

  it("excludes a charge restated in the summary invoice from shipping too", () => {
    const withNested = [
      ...dossier,
      line({ label: "Freight invoice 196833", category: "freight", amount: 5872.64, included_in_document_id: "doc-197112" }),
    ];
    expect(sumImportCosts(withNested).shipping).toBeCloseTo(8992.65, 2);
  });
});

describe("shippingUnitCost", () => {
  /** The real shipment: 2,091 kg over 9.176 CBM, arriving by sea. */
  const sea = { gross_weight_kg: 2091, volume_cbm: 9.176, shipment_mode: "SEA" };

  it("leads with the per-CBM rate for a sea shipment", () => {
    const unit = shippingUnitCost(8992.65, sea);
    expect(unit.headline?.unit).toBe("CBM");
    expect(unit.headline?.value).toBeCloseTo(980.02, 1);
    expect(unit.perKg).toBeCloseTo(4.3, 1);
  });

  it("leads with the per-kg rate for air, which is sold by weight", () => {
    const unit = shippingUnitCost(8992.65, { ...sea, shipment_mode: "AIR" });
    expect(unit.headline?.unit).toBe("kg");
    expect(unit.headline?.value).toBeCloseTo(4.3, 1);
  });

  it("falls back to the measure it has", () => {
    const noVolume = shippingUnitCost(1000, { gross_weight_kg: 100, volume_cbm: null, shipment_mode: "SEA" });
    expect(noVolume.headline).toEqual({ value: 10, unit: "kg" });

    const noWeight = shippingUnitCost(1000, { gross_weight_kg: null, volume_cbm: 5, shipment_mode: "AIR" });
    expect(noWeight.headline).toEqual({ value: 200, unit: "CBM" });
  });

  it("refuses to invent a rate with nothing to divide by", () => {
    const none = shippingUnitCost(1000, { gross_weight_kg: null, volume_cbm: null, shipment_mode: "SEA" });
    expect(none.headline).toBeNull();
    expect(none.perKg).toBeNull();
    expect(none.perCbm).toBeNull();

    // A zero measure must not divide either.
    const zero = shippingUnitCost(1000, { gross_weight_kg: 0, volume_cbm: 0, shipment_mode: "SEA" });
    expect(zero.headline).toBeNull();
  });
});
