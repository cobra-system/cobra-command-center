/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Search, ChevronUp, ChevronDown, Truck, Package } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useData, useAuth } from "@/contexts/AppContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useColumnVisibility, defineColumns } from "@/hooks/useColumnVisibility";
import { ColContextMenu, useColMenu, colThContextMenu, trContextMenu } from "@/components/ui/ColContextMenu";
import type { WasteSupplierReturn, WasteReturnStatus } from "@/contexts/types";
import { WasteReturnStatusBadge } from "./WasteStatusBadge";
import { TrackingBadge } from "@/components/orders/TrackingBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

// ─── Column definitions ───────────────────────────────────────────────────────

const COLUMN_DEFS = defineColumns([
    { id: "supplier",    label: "ספק",           sortField: "supplier_name" },
    { id: "tracking",    label: "מעקב DHL" },
    { id: "items_count", label: "פריטים",         sortField: "items_count" },
    { id: "status",      label: "מצב",            sortField: "status" },
    { id: "settlement",  label: "סגירה" },
    { id: "created_at",  label: "תאריך",          sortField: "created_at" },
    { id: "created_by",  label: 'נוצר ע"י' },
]);

type ColId = (typeof COLUMN_DEFS)[number]["id"];

// ─── Status filter config ─────────────────────────────────────────────────────

type StatusTabValue = "all" | WasteReturnStatus;

const STATUS_TABS: { label: string; value: StatusTabValue; status?: WasteReturnStatus }[] = [
  { label: "הכל",              value: "all" },
  { label: "טיוטה",            value: "draft",     status: "draft" },
  { label: "נשלח",             value: "shipped",   status: "shipped" },
  { label: "התקבל אצל ספק",   value: "delivered", status: "delivered" },
  { label: "הוסדר",            value: "settled",   status: "settled" },
];

// ─── Sort persistence ─────────────────────────────────────────────────────────

const SORT_KEY = "waste-returns:sort";

function loadSort(): { field: string; dir: "asc" | "desc" } {
  try {
    const s = localStorage.getItem(SORT_KEY);
    if (s) return JSON.parse(s);
  } catch (_) { /* ignore */ }
  return { field: "created_at", dir: "desc" };
}

function persistSort(field: string, dir: "asc" | "desc") {
  localStorage.setItem(SORT_KEY, JSON.stringify({ field, dir }));
}

// ─── Sort icon ────────────────────────────────────────────────────────────────

function SortIcon({ field, sortField, sortDir }: { field: string; sortField: string; sortDir: "asc" | "desc" }) {
  if (sortField !== field) {
    return (
      <span className="inline-flex flex-col opacity-30 gap-[1px]">
        <ChevronUp className="h-2.5 w-2.5" />
        <ChevronDown className="h-2.5 w-2.5" />
      </span>
    );
  }
  return sortDir === "asc"
    ? <ChevronUp className="h-3.5 w-3.5 text-primary" />
    : <ChevronDown className="h-3.5 w-3.5 text-primary" />;
}

// ─── Settlement badge ─────────────────────────────────────────────────────────

function SettlementBadge({ type }: { type?: string | null }) {
  if (!type) return <span className="text-muted-foreground">—</span>;
  if (type === "rma") {
    return (
      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-purple-100 text-purple-800 border-purple-200">
        RMA
      </span>
    );
  }
  if (type === "credit") {
    return (
      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-800 border-green-200">
        זיכוי
      </span>
    );
  }
  return <span className="text-muted-foreground text-xs">{type}</span>;
}

// ─── Items count badge ────────────────────────────────────────────────────────

function ItemsCountBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground border border-border text-[11px] font-semibold min-w-[22px] h-[22px] px-1.5 tabular-nums">
      {count}
    </span>
  );
}

// ─── Create return dialog ─────────────────────────────────────────────────────

interface CreateReturnDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function CreateReturnDialog({ open, onOpenChange }: CreateReturnDialogProps) {
  const navigate = useNavigate();
  const { suppliers } = useData();
  const { currentUser } = useAuth();

  const [supplierId, setSupplierId] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setSupplierId("");
    setReturnReason("");
    setTrackingNumber("");
  }

  async function handleSave() {
    if (!supplierId) {
      toast.error("יש לבחור ספק");
      return;
    }

    setSaving(true);
    try {
      const selectedSupplier = suppliers.find(s => s.id === supplierId);
      const { data, error } = await supabase
        .from("waste_supplier_returns")
        .insert({
          supplier_id: supplierId,
          return_reason: returnReason.trim() || null,
          tracking_number: trackingNumber.trim() || null,
          status: "draft",
          created_by: currentUser?.id ?? null,
          created_by_name: currentUser?.name ?? null,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("החזרה נוצרה בהצלחה");
      reset();
      onOpenChange(false);
      navigate(`/waste-management/returns/${data.id}`);
    } catch (e) {
      toast.error("שגיאה ביצירת ההחזרה");
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  const supplierOptions = suppliers.map(s => ({
    value: s.id,
    label: s.company,
  }));

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>צור החזרה חדשה לספק</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>ספק <span className="text-destructive">*</span></Label>
            <Combobox
              options={supplierOptions}
              value={supplierId}
              onValueChange={setSupplierId}
              placeholder="בחר ספק..."
              searchPlaceholder="חפש ספק..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>סיבת ההחזרה</Label>
            <Textarea
              placeholder="תאר את סיבת ההחזרה..."
              value={returnReason}
              onChange={e => setReturnReason(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label>מספר מעקב DHL (אופציונלי)</Label>
            <Input
              placeholder="לדוגמה: 1234567890"
              value={trackingNumber}
              onChange={e => setTrackingNumber(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => { reset(); onOpenChange(false); }}
            >
              ביטול
            </Button>
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={saving || !supplierId}
            >
              {saving ? "יוצר..." : "צור החזרה"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WasteSupplierReturnsTab() {
  const navigate = useNavigate();
  const { hasEdit } = usePermissions("waste");

  // ── State ──────────────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<StatusTabValue>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ field: string; dir: "asc" | "desc" }>(loadSort);
  const [createOpen, setCreateOpen] = useState(false);

  // ── Column visibility ──────────────────────────────────────────────────────
  const { isVisible, hide, show, hiddenCols, visibleCount } = useColumnVisibility(
    "waste-returns:hidden-columns",
    COLUMN_DEFS,
  );
  const { menu: colMenu, setMenu: setColMenu, closeMenu } = useColMenu();

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: returns = [], isLoading, refetch } = useQuery({
    queryKey: ["waste-supplier-returns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waste_supplier_returns")
        .select(`
          *,
          suppliers(company),
          waste_return_items(count)
        `)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        ...row,
        supplier_name: row.suppliers?.company ?? null,
        items_count: row.waste_return_items?.[0]?.count ?? 0,
      })) as WasteSupplierReturn[];
    },
  });

  // ── Realtime subscriptions ─────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("waste-returns-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "waste_supplier_returns" },
        () => { refetch(); },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "waste_return_items" },
        () => { refetch(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  // ── Sorting ────────────────────────────────────────────────────────────────
  const toggleSort = useCallback((field: string) => {
    setSort(prev => {
      const next = prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" as const : "asc" as const }
        : { field, dir: "asc" as const };
      persistSort(next.field, next.dir);
      return next;
    });
  }, []);

  const handleSaveSort = useCallback((field: string, dir: "asc" | "desc") => {
    persistSort(field, dir);
    setSort({ field, dir });
  }, []);

  // ── Filtering & sorting ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...returns];

    // Status filter
    if (statusFilter !== "all") {
      list = list.filter(r => r.status === statusFilter);
    }

    // Text search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r =>
        (r.supplier_name?.toLowerCase().includes(q)) ||
        (r.tracking_number?.toLowerCase().includes(q)),
      );
    }

    // Sort
    list.sort((a, b) => {
      const { field, dir } = sort;
      const mul = dir === "asc" ? 1 : -1;

      if (field === "supplier_name") {
        return mul * ((a.supplier_name ?? "").localeCompare(b.supplier_name ?? "", "he"));
      }
      if (field === "items_count") {
        return mul * ((a.items_count ?? 0) - (b.items_count ?? 0));
      }
      if (field === "status") {
        return mul * ((a.status ?? "").localeCompare(b.status ?? ""));
      }
      if (field === "created_at") {
        return mul * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
      return 0;
    });

    return list;
  }, [returns, statusFilter, search, sort]);

  // ── Status tab counts ──────────────────────────────────────────────────────
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: returns.length };
    for (const tab of STATUS_TABS) {
      if (tab.status) {
        counts[tab.value] = returns.filter(r => r.status === tab.status).length;
      }
    }
    return counts;
  }, [returns]);

  // ── Row click ──────────────────────────────────────────────────────────────
  const handleRowClick = useCallback((ret: WasteSupplierReturn) => {
    navigate(`/waste-management/returns/${ret.id}`);
  }, [navigate]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4" dir="rtl">

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש לפי ספק או מספר מעקב..."
            className={cn(
              "w-full h-9 rounded-md border border-input bg-background pr-9 pl-3 text-sm",
              "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0",
            )}
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Create button */}
        {hasEdit && (
          <button
            onClick={() => setCreateOpen(true)}
            className={cn(
              "inline-flex items-center gap-2 h-9 px-4 rounded-md text-sm font-medium",
              "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors",
            )}
          >
            <Plus className="h-4 w-4" />
            צור החזרה חדשה
          </button>
        )}
      </div>

      {/* ── Status tabs ──────────────────────────────────────────────────── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {STATUS_TABS.map(tab => {
          const count = tabCounts[tab.value] ?? 0;
          const active = statusFilter === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground",
              )}
            >
              {tab.label}
              <span className={cn(
                "inline-flex items-center justify-center rounded-full text-[10px] font-semibold min-w-[18px] h-[18px] px-1",
                active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground",
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Loading state ─────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
            <p className="text-sm">טוען החזרות לספקים...</p>
          </div>
        </div>
      )}

      {!isLoading && (
        <>
          {/* ── Mobile card list (hidden on md+) ─────────────────────────── */}
          <div className="md:hidden space-y-3">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Truck className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">אין החזרות להצגה</p>
                <p className="text-xs text-muted-foreground">נסה לשנות את הסינון או לחפש שם אחר</p>
              </div>
            ) : filtered.map(ret => (
              <div
                key={ret.id}
                className="bg-card rounded-xl border p-4 space-y-3 cursor-pointer active:bg-muted/50 transition-colors"
                onClick={() => handleRowClick(ret)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">
                      {ret.supplier_name ?? <span className="text-muted-foreground italic">ספק לא ידוע</span>}
                    </p>
                    {ret.tracking_number && (
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">{ret.tracking_number}</p>
                    )}
                  </div>
                  <WasteReturnStatusBadge status={ret.status} />
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span>פריטים: <ItemsCountBadge count={ret.items_count ?? 0} /></span>
                  {ret.settlement_type && (
                    <>
                      <span>·</span>
                      <SettlementBadge type={ret.settlement_type} />
                    </>
                  )}
                  <span>·</span>
                  <span>{format(new Date(ret.created_at), "dd/MM/yyyy")}</span>
                </div>
              </div>
            ))}
          </div>

          {/* ── Desktop table (hidden on mobile) ─────────────────────────── */}
          <div className="hidden md:block">
            <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr
                    className="border-b bg-muted/50"
                    onContextMenu={trContextMenu(hiddenCols, setColMenu)}
                  >
                    {COLUMN_DEFS.map(col => isVisible(col.id) ? (
                      <th
                        key={col.id}
                        className="text-right p-3 font-semibold text-foreground"
                        onContextMenu={colThContextMenu(col, setColMenu)}
                      >
                        {col.sortField ? (
                          <button
                            onClick={() => toggleSort(col.sortField!)}
                            className="inline-flex items-center gap-1 cursor-pointer select-none hover:text-primary transition-colors"
                          >
                            {col.label}
                            <SortIcon field={col.sortField} sortField={sort.field} sortDir={sort.dir} />
                          </button>
                        ) : (
                          col.label
                        )}
                      </th>
                    ) : null)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={visibleCount}
                        className="py-16 text-center"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <Truck className="h-8 w-8 text-muted-foreground/40" />
                          <p className="text-sm text-muted-foreground">אין החזרות להצגה</p>
                          {(search || statusFilter !== "all") && (
                            <p className="text-xs text-muted-foreground/70">נסה לשנות את הסינון</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : filtered.map(ret => (
                    <tr
                      key={ret.id}
                      className="cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => handleRowClick(ret)}
                    >
                      {isVisible("supplier") && (
                        <td className="p-3">
                          <span className="font-medium text-foreground">
                            {ret.supplier_name ?? <span className="text-muted-foreground italic text-xs">לא ידוע</span>}
                          </span>
                        </td>
                      )}
                      {isVisible("tracking") && (
                        <td className="p-3">
                          {ret.tracking_number || ret.tracking_carrier ? (
                            <TrackingBadge
                              order={{
                                tracking_number: ret.tracking_number ?? null,
                                tracking_carrier: ret.tracking_carrier ?? null,
                                tracking_status_code: ret.tracking_status_code ?? null,
                                tracking_description: ret.tracking_description ?? null,
                                tracking_raw_status: ret.tracking_raw_status ?? null,
                                tracking_events: ret.tracking_events ?? null,
                              } as any}
                            />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      )}
                      {isVisible("items_count") && (
                        <td className="p-3">
                          <ItemsCountBadge count={ret.items_count ?? 0} />
                        </td>
                      )}
                      {isVisible("status") && (
                        <td className="p-3">
                          <WasteReturnStatusBadge status={ret.status} />
                        </td>
                      )}
                      {isVisible("settlement") && (
                        <td className="p-3">
                          <SettlementBadge type={ret.settlement_type} />
                        </td>
                      )}
                      {isVisible("created_at") && (
                        <td className="p-3 text-muted-foreground text-xs tabular-nums whitespace-nowrap">
                          {format(new Date(ret.created_at), "dd/MM/yyyy")}
                        </td>
                      )}
                      {isVisible("created_by") && (
                        <td className="p-3 text-muted-foreground text-xs">
                          {ret.created_by_name ?? "—"}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Row count */}
            {filtered.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2 px-1">
                מציג {filtered.length.toLocaleString("he")} מתוך {returns.length.toLocaleString("he")} החזרות
              </p>
            )}
          </div>
        </>
      )}

      {/* ── Create dialog ─────────────────────────────────────────────────── */}
      <CreateReturnDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      {/* ── Column context menu ────────────────────────────────────────────── */}
      {colMenu && (
        <ColContextMenu
          menu={colMenu}
          sortField={sort.field}
          sortDir={sort.dir}
          hiddenCols={hiddenCols}
          onClose={closeMenu}
          onHide={hide}
          onShow={show}
          onSortAsc={field => handleSaveSort(field, "asc")}
          onSortDesc={field => handleSaveSort(field, "desc")}
        />
      )}
    </div>
  );
}
