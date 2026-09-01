import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useData, useCurrency } from "@/contexts/AppContext";
import { ArrowUpDown, ArrowUp, ArrowDown, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, isPast } from "date-fns";
import { useTablePreferences } from "@/hooks/useTablePreferences";
import { useColumnVisibility, defineColumns } from "@/hooks/useColumnVisibility";
import { ColContextMenu, useColMenu, colThContextMenu, trContextMenu } from "@/components/ui/ColContextMenu";
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

const COLUMN_DEFS = defineColumns([
    { id: "supplier",     label: "ספק",          sortField: "supplier" },
    { id: "amount",       label: "סכום",         sortField: "amount" },
    { id: "payment_type", label: "סוג",          sortField: "payment_type" },
    { id: "document",     label: "מסמך" },
    { id: "due_date",     label: "מועד פירעון",  sortField: "due_date" },
    { id: "status",       label: "סטטוס",        sortField: "status" },
    { id: "paid_date",    label: "תאריך תשלום",  sortField: "paid_date" },
]);

export default function PaymentsTable({ payments, search, onRefresh, onEdit }: Props) {
  const { suppliers } = useData();
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();

  const prefs = useTablePreferences("PaymentsTable", {
    sortField: "due_date",
    sortDir: "desc",
    filters: { statusFilter: "all", typeFilter: "all" },
  });
  const { isVisible, hide, show, hiddenCols, visibleCount } = useColumnVisibility("payments:hidden-columns", COLUMN_DEFS);
  const { menu: colMenu, setMenu: setColMenu, closeMenu } = useColMenu();

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

  const markPending = async (id: string) => {
    await supabase.from("supplier_payments").update({ status: "ממתין", paid_date: null }).eq("id", id);
    toast.success("סומן כממתין");
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

      {/* Mobile card list */}
      <div className="md:hidden space-y-2" dir="rtl">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">אין תשלומים</p>
        ) : filtered.map(p => {
          const displayStatus = getDisplayStatus(p);
          const isOverdue = displayStatus === "מאוחר";
          return (
            <div key={p.id} className={`bg-card rounded-xl border shadow-sm p-4 ${isOverdue ? "border-destructive/40 bg-destructive/5" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{supplierName(p.supplier_id)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{paymentTypeLabels[p.payment_type] || p.payment_type}</p>
                </div>
                <div className="shrink-0 text-left">
                  <p className="font-bold text-foreground" dir="ltr">{formatPrice(p.amount, p.currency)}</p>
                  <span className={cn("mt-0.5 inline-block px-2 py-0.5 rounded-full text-xs font-medium", payStatusColors[displayStatus] || "bg-muted text-muted-foreground")}>
                    {displayStatus}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                {p.due_date && <span>פירעון: {format(new Date(p.due_date), "dd/MM/yyyy")}</span>}
                {p.paid_date && <span>שולם: {format(new Date(p.paid_date), "dd/MM/yyyy")}</span>}
              </div>
              <div className="mt-2 flex gap-2">
                {p.status !== "שולם" && (
                  <button
                    onClick={() => markPaid(p.id)}
                    className="text-xs text-success hover:underline"
                  >
                    ✓ סמן כשולם
                  </button>
                )}
                {p.document_id && (
                  <button className="text-xs text-accent hover:underline" onClick={() => navigate(`/documents/${p.document_id}`)}>
                    צפה במסמך
                  </button>
                )}
                {onEdit && (
                  <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => onEdit(p)}>
                    <Pencil className="h-3.5 w-3.5 inline" /> עריכה
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-card rounded-xl border shadow-sm overflow-x-auto" dir="rtl">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50" onContextMenu={trContextMenu(hiddenCols, setColMenu)}>
              {COLUMN_DEFS.map(col => isVisible(col.id) ? (
                <th key={col.id} className="text-right p-3 font-semibold text-foreground" onContextMenu={colThContextMenu(col, setColMenu)}>
                  {col.sortField ? (
                    <button onClick={() => prefs.toggleSort(col.sortField!)} className="flex items-center gap-1 cursor-pointer select-none hover:text-accent transition-colors">
                      {col.label} <SortIcon field={col.sortField as SortField} />
                    </button>
                  ) : col.label}
                </th>
              ) : null)}
              {onEdit && <th className="p-3" />}
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr><td colSpan={visibleCount + (onEdit ? 1 : 0)} className="p-8 text-center text-muted-foreground">אין תשלומים</td></tr>
            ) : filtered.map(p => {
              const displayStatus = getDisplayStatus(p);
              const isOverdue = displayStatus === "מאוחר";
              return (
                <tr key={p.id} className={`hover:bg-muted/30 ${isOverdue ? "bg-destructive/5" : ""}`}>
                  {isVisible("supplier") && <td className="p-3 font-medium text-foreground">{supplierName(p.supplier_id)}</td>}
                  {isVisible("amount") && <td className="p-3 text-foreground font-mono" dir="ltr">{formatPrice(p.amount, p.currency)}</td>}
                  {isVisible("payment_type") && <td className="p-3 text-muted-foreground">{paymentTypeLabels[p.payment_type] || p.payment_type}</td>}
                  {isVisible("document") && (
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
                  )}
                  {isVisible("due_date") && <td className="p-3 text-muted-foreground text-xs">{p.due_date ? format(new Date(p.due_date), "dd/MM/yyyy") : "—"}</td>}
                  {isVisible("status") && (
                    <td className="p-3">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className={cn("px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity", payStatusColors[displayStatus] || "bg-muted text-muted-foreground")}>
                            {displayStatus}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-1" align="start">
                          <div className="flex flex-col gap-0.5">
                            {p.status !== "שולם" && (
                              <button
                                onClick={() => markPaid(p.id)}
                                className="px-3 py-1.5 rounded text-xs font-medium text-right transition-colors hover:bg-muted text-success"
                              >
                                ✓ סמן כשולם
                              </button>
                            )}
                            {p.status === "שולם" && (
                              <button
                                onClick={() => markPending(p.id)}
                                className="px-3 py-1.5 rounded text-xs font-medium text-right transition-colors hover:bg-muted text-warning"
                              >
                                ↺ סמן כממתין
                              </button>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </td>
                  )}
                  {isVisible("paid_date") && <td className="p-3 text-muted-foreground text-xs">{p.paid_date ? format(new Date(p.paid_date), "dd/MM/yyyy") : "—"}</td>}
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
      {colMenu && (
        <ColContextMenu
          menu={colMenu}
          sortField={prefs.sortField}
          sortDir={prefs.sortDir}
          hiddenCols={hiddenCols}
          onClose={closeMenu}
          onHide={hide}
          onShow={show}
          onSortAsc={field => prefs.savePreferences({ sortField: field, sortDir: "asc" })}
          onSortDesc={field => prefs.savePreferences({ sortField: field, sortDir: "desc" })}
        />
      )}
    </div>
  );
}
