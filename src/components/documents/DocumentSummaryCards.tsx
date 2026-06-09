import { AlertTriangle } from "lucide-react";
import type { PurchaseDocument, Payment } from "./types";
import { isPast } from "date-fns";
import { useCurrency } from "@/contexts/CurrencyContext";

interface Props {
  docs: PurchaseDocument[];
  payments: Payment[];
}

export default function DocumentSummaryCards({ docs, payments }: Props) {
  const { formatPrice, toDisplayAmount, displayCurrency } = useCurrency();
  const totalOwed = payments
    .filter(p => p.status !== "שולם")
    .reduce((s, p) => s + toDisplayAmount(p.amount, p.currency || "USD"), 0);
  const overdue = payments.filter(p => p.status !== "שולם" && p.due_date && isPast(new Date(p.due_date))).length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="bg-card rounded-xl border p-4 text-center">
        <p className="text-xs text-muted-foreground mb-1">PI</p>
        <p className="text-2xl font-bold text-foreground">{docs.filter(d => d.type === "PI").length}</p>
      </div>
      <div className="bg-card rounded-xl border p-4 text-center">
        <p className="text-xs text-muted-foreground mb-1">PO</p>
        <p className="text-2xl font-bold text-foreground">{docs.filter(d => d.type === "PO").length}</p>
      </div>
      <div className="bg-card rounded-xl border p-4 text-center">
        <p className="text-xs text-muted-foreground mb-1">חוב פתוח</p>
        <p className="text-2xl font-bold text-foreground">{formatPrice(totalOwed, displayCurrency)}</p>
      </div>
      <div className="bg-card rounded-xl border p-4 text-center">
        <p className="text-xs text-muted-foreground mb-1">באיחור</p>
        <p className="text-2xl font-bold text-destructive flex items-center justify-center gap-1">
          {overdue > 0 && <AlertTriangle className="h-4 w-4" />}{overdue}
        </p>
      </div>
    </div>
  );
}
