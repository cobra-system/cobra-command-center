import { describe, it, expect } from "vitest";
import { detectCarrier, carrierLabel } from "./trackingCarrierDetect";

describe("detectCarrier", () => {
  it("returns null for empty input", () => {
    expect(detectCarrier(null)).toBeNull();
    expect(detectCarrier(undefined)).toBeNull();
    expect(detectCarrier("")).toBeNull();
    expect(detectCarrier("   ")).toBeNull();
  });

  it("flags 10-digit numeric as DHL with high confidence", () => {
    expect(detectCarrier("9625622451")).toEqual({ carrier: "dhl", confidence: "high" });
    expect(detectCarrier("1619099064")).toEqual({ carrier: "dhl", confidence: "high" });
  });

  it("flags 11–12 digit numeric as DHL with low confidence", () => {
    expect(detectCarrier("11423172074")).toEqual({ carrier: "dhl", confidence: "low" });
    expect(detectCarrier("123456789012")).toEqual({ carrier: "dhl", confidence: "low" });
  });

  it("flags 6-digit starting with 4 as TCLOG with low confidence", () => {
    expect(detectCarrier("459697")).toEqual({ carrier: "tclog", confidence: "low" });
    expect(detectCarrier("460178")).toEqual({ carrier: "tclog", confidence: "low" });
    expect(detectCarrier("460562")).toEqual({ carrier: "tclog", confidence: "low" });
  });

  it("does not flag 6-digit starting with non-4 as TCLOG", () => {
    expect(detectCarrier("315640")).toBeNull();
    expect(detectCarrier("111040")).toBeNull();
  });

  it("flags identical tracking_number==tclog_reference as TCLOG with high confidence", () => {
    expect(detectCarrier("460178", "460178")).toEqual({ carrier: "tclog", confidence: "high" });
    expect(detectCarrier("460178 ", "460178")).toEqual({ carrier: "tclog", confidence: "high" });
    expect(detectCarrier("460-178", "460178")).toEqual({ carrier: "tclog", confidence: "high" });
  });

  it("identical match wins over 10-digit DHL pattern", () => {
    // Should never happen in practice, but if both look like DHL number AND match TCLOG ref, prefer TCLOG.
    expect(detectCarrier("1234567890", "1234567890")).toEqual({ carrier: "tclog", confidence: "high" });
  });

  it("strips whitespace and dashes when matching length", () => {
    expect(detectCarrier(" 96 25 62 24 51 ")).toEqual({ carrier: "dhl", confidence: "high" });
    expect(detectCarrier("9625-622451")).toEqual({ carrier: "dhl", confidence: "high" });
  });

  it("returns null for alphanumeric or unusual patterns", () => {
    expect(detectCarrier("ABC12345")).toBeNull();
    expect(detectCarrier("12345")).toBeNull();
    expect(detectCarrier("123456789")).toBeNull(); // 9 digits — not standard
  });
});

describe("carrierLabel", () => {
  it("returns Hebrew label for known carriers", () => {
    expect(carrierLabel("dhl")).toBe("DHL");
    expect(carrierLabel("tclog")).toBe("TCLOG");
    expect(carrierLabel("other")).toBe("אחר");
  });

  it("returns em dash for null/undefined", () => {
    expect(carrierLabel(null)).toBe("—");
    expect(carrierLabel(undefined)).toBe("—");
  });
});
