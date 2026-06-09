import React, { createContext, useContext, useCallback, type ReactNode } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";

export type DisplayCurrency = "USD" | "ILS";

export const ILS_PER_USD = 3.7;

const CURRENCY_SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", ILS: "₪" };

interface CurrencyState {
  displayCurrency: DisplayCurrency;
  setDisplayCurrency: (c: DisplayCurrency) => void;
  formatPrice: (amount: number | null | undefined, sourceCurrency?: string) => string;
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

  const formatPrice = useCallback(
    (amount: number | null | undefined, sourceCurrency = "USD"): string => {
      if (amount == null || isNaN(amount)) return "—";

      let converted = amount;
      const src = sourceCurrency.toUpperCase();

      if (src !== displayCurrency) {
        if (src === "ILS" && displayCurrency === "USD") {
          converted = amount / ILS_PER_USD;
        } else if (src === "USD" && displayCurrency === "ILS") {
          converted = amount * ILS_PER_USD;
        } else if (src === "EUR" && displayCurrency === "USD") {
          converted = amount * 1.08;
        } else if (src === "EUR" && displayCurrency === "ILS") {
          converted = amount * 1.08 * ILS_PER_USD;
        }
      }

      const sym = CURRENCY_SYMBOLS[displayCurrency] ?? displayCurrency;
      return `${sym}${Math.round(converted).toLocaleString()}`;
    },
    [displayCurrency]
  );

  return (
    <CurrencyContext.Provider value={{ displayCurrency, setDisplayCurrency, formatPrice }}>
      {children}
    </CurrencyContext.Provider>
  );
}
