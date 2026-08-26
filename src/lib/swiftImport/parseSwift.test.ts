import { describe, it, expect } from "vitest";
import { parseSwiftText, mt103Date, swiftAmount, documentReference } from "./parseSwift";
import { matchSwiftToPayment, paymentUpdateFromSwift, totalsAfterSwift } from "./matchPayment";
import { swiftBelongsToOrder } from "./findOrder";
import type { OrderPayment } from "@/contexts/types";

const MT103 = `
{1:F01LUMIILITAXXX0000000000}{2:O1031234260315BKCHCNBJAXXX00000000002603151200N}{4:
:20:LMI26031500123
:23B:CRED
:32A:260315USD70000,00
:33B:USD70000,00
:50K:/IL620108000000099999999
COBRA SYSTEMS LTD
12 HAMELACHA ST NETANYA ISRAEL
:57A:BKCHCNBJ92A
:59:/398566120099
NINGBO SUNRISE AUTO PARTS CO LTD
NO 288 ZHONGSHAN ROAD NINGBO
:70:PAYMENT FOR PI SR-PI-26031 DEPOSIT 30PCT
:71A:SHA
-}
`.trim().split("\n");

const HEBREW_CONFIRMATION = `
בנק לאומי לישראל בע"מ
אישור ביצוע העברה במט"ח
מספר העברה: 2603150098
תאריך ערך: 15/03/2026
סכום ההעברה: 70,000.00 USD
מוטב: NINGBO SUNRISE AUTO PARTS CO LTD
בנק המוטב: BANK OF CHINA NINGBO BKCHCNBJ92A
פרטי ההעברה: PI SR-PI-26031
עמלה: SHA
`.trim().split("\n");

/**
 * A real Bank Leumi "תשלום בסוויפט" confirmation, as pdf text — the layout this
 * parser has to get right. Note what differs from a raw MT103: every tag is
 * followed by a printed caption, and the value sits on the next line.
 * Account numbers are masked; everything that drives the parse is verbatim.
 */
const LEUMI_CONFIRMATION = `
תשלום בסוויפט
תאריך: 24.08.26
848-05-1265335GA
103 02       CURR + AMT : USD2258,96
UETR :
TYPE   : 001
NUMBER : 2741082b-8369-47a9-9bc5-f51c2394ba65
S  E  N  D  E  R :
BANK LEUMI LE ISRAEL BM , MERCAZ BITZUIIM ISKI , NESHER 3668034
R E C E I V E R  :
CHASUS33XXX
* JPMORGAN CHASE BANK, N.A.
:20:  TRANSACTION REFERENCE NUMBER:              DATE: 260824
848-05-1265335GA
:23B: BANK OPERATION CODE         :
CRED
:32A: VALUE DATE, CURRENCY CODE, AMOUNT:
260824USD2258,96
:50K: CUSTOMER :
81703040011/
L.D. ISRAEL AUTO EQUIPMENT(1990)LTD
15TH TOZERET HA'ARETS ST.
TEL AVIV CITY 6789109
ISRAEL
:57A: 'ACCOUNT WITH' BANK   :
DHBKHKHHXXX
DBS BANK (HONG KONG) LIMITED
FLOOR 11, THE CENTER
HONG KONG ISLAND HONG KONG
:59: BENEFICIARY CUSTOMER   :
79969001030875/
THL CONSULTING AND SOURCING CO.,LTD
ONE TIME SQUARE,1 MATHESON ST
CAUSEWAY
HONG KONG
:70: DETAILS OF PAYMENT     :
DA20260007
:71A: DETAILS OF CHARGES   :
OUR
`.trim().split("\n");

const payment = (over: Partial<OrderPayment>): OrderPayment => ({
  id: "p1", order_id: "o1", payment_type: "Deposit", amount: 70000, currency: "USD",
  status: "ממתין", percentage: 30, due_date: "2026-03-20", paid_date: null,
  swift_reference: null, notes: null, created_at: "2026-03-01", updated_at: "2026-03-01",
  ...over,
} as OrderPayment);

describe("MT103 primitives", () => {
  it("reads SWIFT dates and comma-decimal amounts", () => {
    expect(mt103Date("260315")).toBe("2026-03-15");
    expect(mt103Date("269915")).toBeNull();
    expect(swiftAmount("70000,00")).toBe(70000);
    expect(swiftAmount("1.234,56")).toBe(1234.56);
  });

  it("pulls the document number out of the remittance line", () => {
    expect(documentReference("PAYMENT FOR PI SR-PI-26031 DEPOSIT 30PCT")).toBe("SR-PI-26031");
    expect(documentReference("INVOICE NO. 998877")).toBe("998877");
  });
});

describe("parseSwiftText — MT103", () => {
  const doc = parseSwiftText(MT103, "mt103.txt");

  it("reads the money and the value date off :32A:", () => {
    expect(doc.isMt103).toBe(true);
    expect(doc.amount).toBe(70000);
    expect(doc.currency).toBe("USD");
    expect(doc.valueDate).toBe("2026-03-15");
  });

  it("reads the reference, the parties and the remittance info", () => {
    expect(doc.reference).toBe("LMI26031500123");
    expect(doc.beneficiary).toContain("NINGBO SUNRISE");
    expect(doc.ordering).toContain("COBRA SYSTEMS");
    expect(doc.beneficiaryBank).toBe("BKCHCNBJ92A");
    expect(doc.charges).toBe("SHA");
    expect(doc.referencedDocument).toBe("SR-PI-26031");
  });

  it("has nothing to warn about when every field was found", () => {
    expect(doc.warnings).toEqual([]);
  });
});

describe("parseSwiftText — a bank's Hebrew confirmation", () => {
  const doc = parseSwiftText(HEBREW_CONFIRMATION, "leumi.pdf");

  it("reads the same facts off Hebrew labels", () => {
    expect(doc.amount).toBe(70000);
    expect(doc.currency).toBe("USD");
    expect(doc.valueDate).toBe("2026-03-15");
    expect(doc.reference).toBe("2603150098");
    expect(doc.beneficiary).toContain("NINGBO SUNRISE");
    expect(doc.beneficiaryBank).toContain("BANK OF CHINA");
    expect(doc.referencedDocument).toBe("SR-PI-26031");
  });
});

describe("parseSwiftText — a real Bank Leumi confirmation", () => {
  const doc = parseSwiftText(LEUMI_CONFIRMATION, "swift.pdf");

  it("reads the money and the value date through the printed captions", () => {
    expect(doc.isMt103).toBe(true);
    expect(doc.amount).toBe(2258.96);
    expect(doc.currency).toBe("USD");
    expect(doc.valueDate).toBe("2026-08-24");
  });

  it("takes the transaction reference, not the date printed beside it", () => {
    expect(doc.reference).toBe("848-05-1265335GA");
  });

  it("reads the parties without their account numbers or addresses", () => {
    expect(doc.beneficiary).toBe("THL CONSULTING AND SOURCING CO.,LTD");
    expect(doc.ordering).toBe("L.D. ISRAEL AUTO EQUIPMENT(1990)LTD");
    expect(doc.beneficiaryBank).toBe("DHBKHKHHXXX");
  });

  it("picks up the payment reference and the charge bearer", () => {
    expect(doc.referencedDocument).toBe("DA20260007");
    expect(doc.charges).toBe("OUR");
  });

  it("has nothing to warn about", () => {
    expect(doc.warnings).toEqual([]);
  });

  it("settles the installment it matches", () => {
    const match = matchSwiftToPayment(doc, [payment({ id: "dep", amount: 2258.96, currency: "USD" })]);
    expect(match?.payment.id).toBe("dep");
    expect(paymentUpdateFromSwift(doc)).toEqual({
      status: "שולם",
      paid_date: "2026-08-24",
      swift_reference: "848-05-1265335GA",
    });
  });
});

describe("parseSwiftText — what it refuses to guess", () => {
  it("warns per field rather than inventing values", () => {
    const doc = parseSwiftText(["אישור העברה", "תודה שבחרתם בבנק"], "empty.pdf");
    expect(doc.amount).toBeNull();
    expect(doc.warnings.join(" ")).toContain("לא זוהה סכום");
    expect(doc.warnings.join(" ")).toContain("לא זוהה מטבע");
  });
});

describe("matchSwiftToPayment", () => {
  const swift = parseSwiftText(MT103, "mt103.txt");

  it("matches the installment with the same amount", () => {
    const match = matchSwiftToPayment(swift, [payment({ id: "a", amount: 30000 }), payment({ id: "b", amount: 70000 })]);
    expect(match?.payment.id).toBe("b");
    expect(match?.exact).toBe(true);
  });

  it("still matches when bank fees shaved a little off", () => {
    const match = matchSwiftToPayment(swift, [payment({ id: "a", amount: 70450 })]);
    expect(match?.payment.id).toBe("a");
    expect(match?.exact).toBe(false);
    expect(match?.reason).toContain("עמלות");
  });

  it("prefers an unpaid installment over one already settled", () => {
    const match = matchSwiftToPayment(swift, [
      payment({ id: "paid", status: "שולם" }),
      payment({ id: "open", status: "ממתין" }),
    ]);
    expect(match?.payment.id).toBe("open");
  });

  it("returns nothing when no installment is close, or the currency differs", () => {
    expect(matchSwiftToPayment(swift, [payment({ amount: 12000 })])).toBeNull();
    expect(matchSwiftToPayment(swift, [payment({ currency: "EUR" })])).toBeNull();
    expect(matchSwiftToPayment(parseSwiftText(["nothing here"]), [payment({})])).toBeNull();
  });
});

describe("applying the SWIFT", () => {
  const swift = parseSwiftText(MT103, "mt103.txt");

  it("marks the installment paid on the value date, with the bank reference", () => {
    expect(paymentUpdateFromSwift(swift)).toEqual({
      status: "שולם",
      paid_date: "2026-03-15",
      swift_reference: "LMI26031500123",
    });
  });

  it("recomputes what is paid and what is left", () => {
    const payments = [payment({ id: "a", amount: 70000 }), payment({ id: "b", amount: 30000, payment_type: "Balance" })];
    expect(totalsAfterSwift(payments, swift, "a")).toEqual({ paid: 70000, remaining: 30000 });
    expect(totalsAfterSwift(payments, swift)).toEqual({ paid: 0, remaining: 100000 });
  });
});

describe("swiftBelongsToOrder", () => {
  const swift = parseSwiftText(LEUMI_CONFIRMATION, "swift.pdf");

  it("recognises the order whose invoice number the SWIFT quotes", () => {
    expect(swiftBelongsToOrder(swift, "DA20260007")).toBe(true);
    expect(swiftBelongsToOrder(swift, "da-2026-0007")).toBe(true);   // separators and case vary
    expect(swiftBelongsToOrder(swift, "DA20260007rev1")).toBe(true); // revisions keep the root
  });

  it("flags a SWIFT uploaded onto a different order", () => {
    expect(swiftBelongsToOrder(swift, "DA20260008")).toBe(false);
  });

  it("says nothing when either side has no number — that is not a mismatch", () => {
    expect(swiftBelongsToOrder(swift, null)).toBeNull();
    expect(swiftBelongsToOrder(parseSwiftText(["אישור העברה"]), "DA20260007")).toBeNull();
  });
});
