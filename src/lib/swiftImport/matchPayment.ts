/**
 * Match a parsed SWIFT confirmation to the installment it settles.
 *
 * The bank confirms "70,000 USD left on 15/03" — the payment schedule says which
 * installment that was. Amount and currency identify it; when two installments
 * carry the same amount, the one still waiting and closest to its due date wins.
 * A near-miss is normal and not a mismatch: correspondent-bank fees and rounding
 * routinely shave a few dollars off what actually arrives.
 */
import type { OrderPayment } from "@/contexts/types";
import type { ParsedSwift } from "./parseSwift";

/** Fees and FX rounding move the amount by a little; more than this is a different payment. */
export const AMOUNT_TOLERANCE = 0.02;

export interface SwiftMatch {
  payment: OrderPayment;
  /** Amount matched to the agora/cent. */
  exact: boolean;
  /** Relative difference between the SWIFT and the installment (0 = identical). */
  difference: number;
  reason: string;
}

const daysBetween = (a?: string | null, b?: string | null): number => {
  if (!a || !b) return Number.MAX_SAFE_INTEGER;
  const diff = new Date(a).getTime() - new Date(b).getTime();
  return Number.isNaN(diff) ? Number.MAX_SAFE_INTEGER : Math.abs(diff) / 86_400_000;
};

/**
 * Best installment for this SWIFT, or null when nothing is close enough.
 * `null` is a legitimate answer — a transfer that pays no scheduled installment
 * (a new payment, or one entered on another order) must not be forced onto one.
 */
export function matchSwiftToPayment(swift: ParsedSwift, payments: OrderPayment[]): SwiftMatch | null {
  if (swift.amount == null || !payments.length) return null;

  const candidates = payments
    .filter(p => !swift.currency || !p.currency || p.currency === swift.currency)
    .map(p => {
      const amount = Number(p.amount) || 0;
      const difference = amount > 0 ? Math.abs(amount - swift.amount!) / amount : 1;
      return { payment: p, difference };
    })
    .filter(c => c.difference <= AMOUNT_TOLERANCE);

  if (!candidates.length) return null;

  candidates.sort((a, b) => {
    // Still-waiting installments first — a paid one is unlikely to be paid again.
    const aPending = a.payment.status === "ממתין" ? 0 : 1;
    const bPending = b.payment.status === "ממתין" ? 0 : 1;
    if (aPending !== bPending) return aPending - bPending;
    if (Math.abs(a.difference - b.difference) > 1e-9) return a.difference - b.difference;
    return daysBetween(a.payment.due_date, swift.valueDate) - daysBetween(b.payment.due_date, swift.valueDate);
  });

  const best = candidates[0];
  const exact = best.difference < 1e-9;
  const label = best.payment.payment_type === "Deposit" ? "מקדמה"
    : best.payment.payment_type === "Balance" ? "יתרה" : "תשלום מלא";
  const reason = exact
    ? `סכום זהה לתשלום "${label}"`
    : `סכום קרוב לתשלום "${label}" (הפרש ${(best.difference * 100).toFixed(1)}% — כנראה עמלות בנק)`;

  return { payment: best.payment, exact, difference: best.difference, reason };
}

/** What a confirmed SWIFT means for the installment it settles. */
export function paymentUpdateFromSwift(swift: ParsedSwift): {
  status: string;
  paid_date: string;
  swift_reference: string | null;
} {
  return {
    status: "שולם",
    paid_date: swift.valueDate || new Date().toISOString().split("T")[0],
    swift_reference: swift.reference,
  };
}

/** Totals after this SWIFT is applied, for showing the user the effect before saving. */
export function totalsAfterSwift(payments: OrderPayment[], swift: ParsedSwift, matchedId?: string): {
  paid: number;
  remaining: number;
} {
  let paid = 0;
  let scheduled = 0;
  for (const p of payments) {
    const amount = Number(p.amount) || 0;
    scheduled += amount;
    const settled = p.status === "שולם" || p.id === matchedId;
    if (settled) paid += p.id === matchedId ? (swift.amount ?? amount) : amount;
  }
  return { paid, remaining: scheduled - paid };
}
