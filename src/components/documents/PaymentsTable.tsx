import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "@/contexts/AppContext";
import { ArrowUpDown, ArrowUp, ArrowDown, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, isPast } from "date-fns";
import { useTablePreferences } from "@/hooks/useTablePreferences";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { Payment } from "./types";
import { payStatusColors, currencySymbol, paymentTypeLabels } from "./constants";

type SortField = "supplier" | "amount" | "due_date" | "status" | "payment_type" | "paid_date";

interface Props {
  payments: Payment[];
  search: string;
  onRefresh: () => void;
  onEdit?: (payment: Payment) => void;
}

export default function PaymentsTable({ payments, search, onRefresh, onEdit }: Props) {
  const { suppliers } = useData();
  const navigate = useNavigate();

  const prefs = useTablePreferences("PaymentsTable", {
    sortField: "due_date",
    sortDir: "desc",
    filters: { statusFilter: "all", typeFilter: "all" },
  });

  const sortField = prefs.sortField as SortField | null;
  const sortDir = prefs.sortDir;
  const statusFilter = prefs.filters.statusFilter || "all";
  const typeFilter = prefs.filters.typeFilter || "all";

  const supplierName = (id: string | null) => suppliers.find(s => s.id === id)?.company || "—";

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const getDisplayStatus = (p: Payment) => {
    if (p.status === "שולם") return "שולם";
    if (p.due_date && isPast(new Date(p.due_date))) return "מאוחר";
    return p.status;
  };

  const filtered = useMemo(() => {
    let result = payments;

    if (statusFilter !== "all") {
      result = result.filter(p => {
        const ds = getDisplayStatus(p);
        return ds === statusFilter;
      });
    }
    if (typeFilter !== "all") result = result.filter(p => p.payment_type === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p => supplierName(p.supplier_id).toLowerCase().includes(q));
    }

    if (sortField && sortDir) {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        switch (sortField) {
          case "supplier": cmp = supplierName(a.supplier_id).localeCompare(supplierName(b.supplier_id)); break;
          case "amount": cmp = a.amount - b.amount; break;
          case "due_date": cmp = (a.due_date || "").localeCompare(b.due_date || ""); break;
          case "status": cmp = getDisplayStatus(a).localeCompare(getDisplayStatus(b)); break;
          case "payment_type": cmp = a.payment_type.localeCompare(b.payment_type); break;
          case "paid_date": cmp = (a.paid_date || "").localeCompare(b.paid_date || ""); break;
        }
        return sortDir === "desc" ? -cmp : cmp;
      });
    }

    return result;
  }, [payments, statusFilter, typeFilter, search, sortField, sortDir]);

  const markPaid = async (id: string) => {
    await supabase.from("supplier_payments").update({ status: "שולם", paid_date: new Date().toISOString().split("T")[0] }).eq("id", id);
    toast.success("סומן כשולם");
    onRefresh();
  };

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <Select value={statusFilter} onValueChange={(v) => prefs.setFilter("statusFilter", v)}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="סטטוס" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסטטוסים</SelectItem>
            <SelectItem value="ממתין">ממתין</SelectItem>
            <SelectItem value="שולם">שולם</SelectItem>
            <SelectItem value="מאוחר">מאוחר</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(v) => prefs.setFilter("typeFilter", v)}>
          <SelectTrigger className="w-[120px]"><SelectValue placeholder="סוג" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסוגים</SelectItem>
            <SelectItem value="Full">מלא</SelectItem>
            <SelectItem value="Deposit">מקדמה</SelectItem>
            <SelectItem value="Balance">יתרה</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-x-auto" dir="rtl">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-right p-3 font-semibold text-foreground cursor-pointer select-none" onClick={() => prefs.toggleSort("supplier")}>
                <span className="flex items-center gap-1">ספק <SortIcon field="supplier" /></span>
              </th>
              <th className="text-right p-3 font-semibold text-foreground cursor-pointer select-none" onClick={() => prefs.toggleSort("amount")}>
                <span className="flex items-center gap-1">סכום <SortIcon field="amount" /></span>
              </th>
              <th className="text-right p-3 font-semibold text-foreground cursor-pointer select-none" onClick={() => prefs.toggleSort("payment_type")}>
                <span className="flex items-center gap-1">סוג <SortIcon field="payment_type" /></span>
              </th>
              <th className="text-right p-3 font-semibold text-foreground">מסמך</th>
              <th className="text-right p-3 font-semibold text-foreground cursor-pointer select-none" onClick={() => prefs.toggleSort("due_date")}>
                <span className="flex items-center gap-1">מועד פירעון <SortIcon field="due_date" /></span>
              </th>
              <th className="text-right p-3 font-semibold text-foreground cursor-pointer select-none" onClick={() => prefs.toggleSort("status")}>
                <span className="flex items-center gap-1">סטטוס <SortIcon field="status" /></span>
              </th>
              <th className="text-right p-3 font-semibold text-foreground cursor-pointer select-none" onClick={() => prefs.toggleSort("paid_date")}>
                <span className="flex items-center gap-1">תאריך תשלום <SortIcon field="paid_date" /></span>
              </th>
              {onEdit && <th className="p-3" />}
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">אין תשלומים</td></tr>
            ) : filtered.map(p => {
              const displayStatus = getDisplayStatus(p);
              const isOverdue = displayStatus === "מאוחר";
              return (
                <tr key={p.id} className={`hover:bg-muted/30 ${isOverdue ? "bg-destructive/5" : ""}`}>
                  <td className="p-3 font-medium text-foreground">{supplierName(p.supplier_id)}</td>
                  <td className="p-3 text-foreground font-mono" dir="ltr">{currencySymbol[p.currency] || ""}{p.amount.toLocaleString()}</td>
                  <td className="p-3 text-muted-foreground">{paymentTypeLabels[p.payment_type] || p.payment_type}</td>
                  <td className="p-3">
                    {p.document_id ? (
                      <button
                        className="text-xs text-accent hover:underline"
                        onClick={() => navigate(`/documents/${p.document_id}`)}
                      >
                        צפה
                      </button>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="p-3 text-muted-foreground text-xs">{p.due_date ? format(new Date(p.due_date), "dd/MM/yy") : "—"}</td>
                  <td className="p-3">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className={cn("px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer", payStatusColors[displayStatus] || "bg-muted text-muted-foreground")}>
                          {displayStatus}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-1" align="start">
                        <div className="flex flex-col gap-0.5">
                          {p.status !== "שולם" && (
                            <button
                              onClick={() => markPaid(p.id)}
                              className="px-3 py-1.5 rounded text-xs font-medium text-right transition-colors hover:bg-muted"
                            >
                              ✓ סמן כשולם
                            </button>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </td>
                  <td className="p-3 text-muted-foreground text-xs">{p.paid_date ? format(new Date(p.paid_date), "dd/MM/yy") : "—"}</td>
                  {onEdit && (
                    <td className="p-3">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
