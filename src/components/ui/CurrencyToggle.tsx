import { useCurrency } from "@/contexts/CurrencyContext";

interface Props {
  className?: string;
}

export function CurrencyToggle({ className }: Props) {
  const { displayCurrency, setDisplayCurrency } = useCurrency();
  const isILS = displayCurrency === "ILS";

  return (
    <button
      onClick={() => setDisplayCurrency(isILS ? "USD" : "ILS")}
      className={`text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted/60 font-mono text-xs font-semibold leading-none w-6 h-6 flex items-center justify-center${className ? ` ${className}` : ""}`}
      title={isILS ? "הצג במטבע דולר" : "הצג בשקל"}
      aria-label="toggle currency display"
    >
      {isILS ? "₪" : "$"}
    </button>
  );
}
