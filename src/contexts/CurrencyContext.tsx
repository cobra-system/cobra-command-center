import React, { createContext, useContext, useCallback, type ReactNode } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";

export type DisplayCurrency = "USD" | "ILS";

/** Default rate — override via Settings → Account → שער חליפין */
export const DEFAULT_ILS_PER_USD = 3.7;

const CURRENCY_SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", ILS: "₪" };

interface CurrencyState {
  displayCurrency: DisplayCurrency;
  setDisplayCurrency: (c: DisplayCurrency) => void;
  ilsPerUsd: number;
  setIlsPerUsd: (rate: number) => void;
  /** Convert amount (in sourceCurrency) → display currency number (not formatted) */
  toDisplayAmount: (amount: number | null | undefined, sourceCurrency?: string) => number;
  /** Format with display currency symbol, no conversion needed if already in display currency */
  formatPrice: (amount: number | null | undefined, sourceCurrency?: string) => string;
  /** Same as formatPrice but abbreviates large numbers (K / M) */
  formatPriceCompact: (amount: number | null | undefined, sourceCurrency?: string) => string;
}

const CurrencyContext = createContext<CurrencyState | null>(null);

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be within CurrencyProvider");
  return ctx;
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [displayCurrency, setDisplayCurrency] = usePersistedState<DisplayCurrency>(
    "cobra-display-currency",
    "ILS"
  );
  const [ilsPerUsd, setIlsPerUsdRaw] = usePersistedState<number>(
    "cobra-ils-per-usd",
    DEFAULT_ILS_PER_USD
  );

  const setIlsPerUsd = useCallback((rate: number) => {
    if (rate > 0) setIlsPerUsdRaw(rate);
  }, [setIlsPerUsdRaw]);

  const toDisplayAmount = useCallback(
    (amount: number | null | undefined, sourceCurrency = "USD"): number => {
      if (amount == null || isNaN(amount)) return 0;
      const src = sourceCurrency.toUpperCase();
      if (src === displayCurrency) return amount;
      if (src === "ILS" && displayCurrency === "USD") return amount / ilsPerUsd;
      if (src === "USD" && displayCurrency === "ILS") return amount * ilsPerUsd;
      if (src === "EUR" && displayCurrency === "USD") return amount * 1.08;
      if (src === "EUR" && displayCurrency === "ILS") return amount * 1.08 * ilsPerUsd;
      return amount;
    },
    [displayCurrency, ilsPerUsd]
  );

  const formatPrice = useCallback(
    (amount: number | null | undefined, sourceCurrency = "USD"): string => {
      if (amount == null || isNaN(amount)) return "—";
      const converted = toDisplayAmount(amount, sourceCurrency);
      const sym = CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency;
      return `${sym}${Math.round(converted).toLocaleString()}`;
    },
    [displayCurrency, toDisplayAmount]
  );

  const formatPriceCompact = useCallback(
    (amount: number | null | undefined, sourceCurrency = "USD"): string => {
      if (amount == null || isNaN(amount)) return "—";
      const converted = toDisplayAmount(amount, sourceCurrency);
      const sym = CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency;
      const abs = Math.abs(converted);
      if (abs >= 1_000_000) return `${sym}${(converted / 1_000_000).toFixed(1)}M`;
      if (abs >= 1_000) return `${sym}${(converted / 1_000).toFixed(0)}K`;
      return `${sym}${Math.round(converted).toLocaleString()}`;
    },
    [displayCurrency, toDisplayAmount]
  );

  return (
    <CurrencyContext.Provider value={{
      displayCurrency, setDisplayCurrency,
      ilsPerUsd, setIlsPerUsd,
      toDisplayAmount, formatPrice, formatPriceCompact,
    }}>
      {children}
    </CurrencyContext.Provider>
  );
}
