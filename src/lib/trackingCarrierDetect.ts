// Heuristic to guess the shipping carrier from the tracking number format.
// Used for two purposes:
//   1. Pre-filling the carrier selector when the user enters a tracking number.
//   2. Backfilling tracking_carrier on existing rows where the data is unambiguous.
//
// Patterns observed in production data:
//   - DHL Express: 10 numeric digits (high confidence). 11–12 digits also exist
//     for some DHL numeric AWBs (lower confidence).
//   - TCLOG: 6 numeric digits starting with "4" (e.g. 459697, 460178, 460562).
//   - When tracking_number === tclog_reference verbatim → user copied the same
//     value into both fields; almost always TCLOG.

export type CarrierGuess =
  | { carrier: "dhl"; confidence: "high" | "low" }
  | { carrier: "tclog"; confidence: "high" | "low" }
  | null;

function strip(n: string): string {
  return n.replace(/[\s-]/g, "");
}

export function detectCarrier(
  trackingNumber: string | null | undefined,
  tclogReference?: string | null,
): CarrierGuess {
  if (!trackingNumber) return null;
  const n = strip(trackingNumber);
  if (n.length === 0) return null;

  if (tclogReference) {
    const t = strip(tclogReference);
    if (t.length > 0 && n === t) return { carrier: "tclog", confidence: "high" };
  }

  if (/^\d{10}$/.test(n)) return { carrier: "dhl", confidence: "high" };
  if (/^\d{11,12}$/.test(n)) return { carrier: "dhl", confidence: "low" };
  if (/^4\d{5}$/.test(n)) return { carrier: "tclog", confidence: "low" };
  return null;
}

const CARRIER_HE: Record<"dhl" | "tclog", string> = {
  dhl: "DHL",
  tclog: "TCLOG",
};

export function carrierLabel(c: "dhl" | "tclog" | "other" | null | undefined): string {
  if (!c) return "—";
  if (c === "other") return "אחר";
  return CARRIER_HE[c];
}
