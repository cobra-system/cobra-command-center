import { describe, it, expect } from "vitest";
import { classifyDocument } from "./classify";

const MT103 = ":20:LMI26031500123\n:32A:260315USD70000,00\n:59:/398566\nNINGBO SUNRISE\n:70:PAYMENT FOR PI SR-PI-26031";

describe("classifyDocument", () => {
  it("recognises an MT103 as a SWIFT with high confidence", () => {
    const c = classifyDocument({ fileName: "scan001.pdf", text: MT103 });
    expect(c.kind).toBe("SWIFT");
    expect(c.confidence).toBe("high");
  });

  it("recognises a Hebrew bank transfer confirmation", () => {
    const c = classifyDocument({
      fileName: "doc.pdf",
      text: "בנק לאומי לישראל\nאישור ביצוע העברה במט\"ח\nתאריך ערך: 15/03/2026\nסכום: 70,000 USD",
    });
    expect(c.kind).toBe("SWIFT");
  });

  it("uses the file name when the PDF is a scan with no text", () => {
    expect(classifyDocument({ fileName: "SWIFT_deposit.pdf", text: "" }).kind).toBe("SWIFT");
  });

  it("recognises a proforma invoice as a new order", () => {
    const c = classifyDocument({ fileName: "SR-PI-26031.pdf", text: "PROFORMA INVOICE\nPI No.: SR-PI-26031\nTotal USD 233,000" });
    expect(c.kind).toBe("NEW_ORDER");
    expect(c.confidence).toBe("high");
  });

  it("recognises a SAP purchase order", () => {
    const c = classifyDocument({ fileName: "po.pdf", text: "הזמנת רכש 4500123\nמספר ע.מ 512345678\nקוד פריט" });
    expect(c.kind).toBe("NEW_ORDER");
  });

  it("does not mistake a packing list that prints a PI number for an order", () => {
    const c = classifyDocument({
      fileName: "PL_26031.pdf",
      text: "PACKING LIST\nPI No.: SR-PI-26031\nContainer No: MSKU1234567\nVessel: MSC ANNA",
    });
    expect(c.kind).toBe("SHIPPING");
    expect(c.subtype).toBe("PACKING_LIST");
  });

  it("picks the dossier subtype from the document title", () => {
    expect(classifyDocument({ fileName: "x.pdf", text: "BILL OF LADING\nShipper: NINGBO" }).subtype).toBe("BL");
    expect(classifyDocument({ fileName: "x.pdf", text: "רשימון יבוא מספר 26024532019850" }).subtype).toBe("DECLARATION");
    expect(classifyDocument({ fileName: "Freight_Tax_Invoice_460509.pdf", text: "" }).subtype).toBe("FREIGHT_INVOICE");
  });

  it("falls back to forwarder file-name habits", () => {
    const c = classifyDocument({ fileName: "HAWB_460509.pdf", text: "" });
    expect(c.kind).toBe("SHIPPING");
    expect(c.subtype).toBe("BL");
  });

  it("returns UNKNOWN rather than guessing", () => {
    const c = classifyDocument({ fileName: "IMG_4021.jpg", text: "" });
    expect(c.kind).toBe("UNKNOWN");
    expect(classifyDocument({ fileName: "notes.pdf", text: "meeting notes about lunch" }).kind).toBe("UNKNOWN");
  });
});
