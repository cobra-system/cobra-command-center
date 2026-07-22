import React, { createContext, useContext, useCallback, type ReactNode } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";

/** Default exchange rate — override via Settings → Account → שער חליפין */
export const DEFAULT_ILS_PER_USD = 3.7;

const CURRENCY_SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", ILS: "₪" };

interface CurrencyState {
  ilsPerUsd: number;
  setIlsPerUsd: (rate: number) => void;
  /** Convert amount (in sourceCurrency) → USD number, for aggregation across currencies */
  toDisplayAmount: (amount: number | null | undefined, sourceCurrency?: string) => number;
  /** Format in the given currency (no conversion) */
  formatPrice: (amount: number | null | undefined, currency?: string) => string;
  /** Same as formatPrice but abbreviates large numbers (K / M) — assumes USD */
  formatPriceCompact: (amount: number | null | undefined, currency?: string) => string;
}

const CurrencyContext = createContext<CurrencyState | null>(null);

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be within CurrencyProvider");
  return ctx;
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [ilsPerUsd, setIlsPerUsdRaw] = usePersistedState<number>(
    "cobra-ils-per-usd",
    DEFAULT_ILS_PER_USD
  );

  const setIlsPerUsd = useCallback((rate: number) => {
    if (rate > 0) setIlsPerUsdRaw(rate);
  }, [setIlsPerUsdRaw]);

  /** Converts any currency to USD (for summing mixed-currency totals) */
  const toDisplayAmount = useCallback(
    (amount: number | null | undefined, sourceCurrency = "USD"): number => {
      if (amount == null || isNaN(amount)) return 0;
      const src = sourceCurrency.toUpperCase();
      if (src === "USD") return amount;
      if (src === "ILS") return amount / ilsPerUsd;
      if (src === "EUR") return amount * 1.08;
      return amount;
    },
    [ilsPerUsd]
  );

  /** Format a price in its own currency — no conversion */
  const formatPrice = useCallback(
    (amount: number | null | undefined, currency = "USD"): string => {
      if (amount == null || isNaN(amount)) return "—";
      const sym = CURRENCY_SYMBOLS[currency.toUpperCase()] ?? currency;
      return `${sym}${Math.round(amount).toLocaleString()}`;
    },
    []
  );

  const formatPriceCompact = useCallback(
    (amount: number | null | undefined, currency = "USD"): string => {
      if (amount == null || isNaN(amount)) return "—";
      const sym = CURRENCY_SYMBOLS[currency.toUpperCase()] ?? currency;
      const abs = Math.abs(amount);
      if (abs >= 1_000_000) return `${sym}${(amount / 1_000_000).toFixed(1)}M`;
      if (abs >= 1_000) return `${sym}${(amount / 1_000).toFixed(0)}K`;
      return `${sym}${Math.round(amount).toLocaleString()}`;
    },
    []
  );

  return (
    <CurrencyContext.Provider value={{
      ilsPerUsd, setIlsPerUsd,
      toDisplayAmount, formatPrice, formatPriceCompact,
    }}>
      {children}
    </CurrencyContext.Provider>
  );
}
