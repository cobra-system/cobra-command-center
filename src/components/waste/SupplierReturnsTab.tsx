import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { ColContextMenu, useColMenu, colThContextMenu, trContextMenu } from "@/components/ui/ColContextMenu";
import { useTablePreferences } from "@/hooks/useTablePreferences";
import { SupplierReturnStatusBadge } from "./DispositionBadge";
import { SupplierReturnDialog } from "./SupplierReturnDialog";
import { SupplierReturnDetailPanel } from "./SupplierReturnDetailPanel";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2, PackageX, TruckIcon, PackageCheck, CircleCheck, Plus, Search, AlertTriangle, X, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

interface SupplierReturn {
  id: string;
  supplier_id: string;
  status: string;
  tracking_number: string | null;
  return_reason: string | null;
  resolution_type: string | null;
  resolution_notes: string | null;
  shipped_at: string | null;
  received_at: string | null;
  settled_at: string | null;
  created_by_name: string | null;
  notes: string | null;
  created_at: string;
  suppliers?: { name: string };
  waste_items?: { id: string }[];
}

interface WasteItem {
  id: string;
  product_name: string;
  sku: string;
  quantity: number;
  supplier_return_id: string | null;
}

const COLUMN_DEFS = [
  { id: "created_at", label: "תאריך", sortField: "created_at" },
  { id: "supplier", label: "ספק", sortField: "supplier_id" },
  { id: "status", label: "סטטוס", sortField: "status" },
  { id: "tracking_number", label: "מספר מעקב" },
  { id: "items_count", label: "פריטים" },
  { id: "return_reason", label: "סיבה" },
  { id: "resolution_type", label: "פתרון" },
  { id: "created_by_name", label: 'נוצר ע"י' },
] as const;

interface Props {
  canCreate: boolean;
}

function isStuck(ret: SupplierReturn): boolean {
  if (ret.status !== "נשלח" || !ret.shipped_at) return false;
  const daysDiff = (Date.now() - new Date(ret.shipped_at).getTime()) / (1000 * 60 * 60 * 24);
  return daysDiff > 14;
}

function relativeDate(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days === 0) return "היום";
  if (days === 1) return "אתמול";
  if (days < 7) return `לפני ${days} ימים`;
  if (days < 30) return `לפני ${Math.floor(days / 7)} שבועות`;
  return `לפני ${Math.floor(days / 30)} חודשים`;
}

export function SupplierReturnsTab({ canCreate }: Props) {
  const [returns, setReturns] = useState<SupplierReturn[]>([]);
  const [allWasteItems, setAllWasteItems] = useState<WasteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<SupplierReturn | null>(null);

  const isMobile = useIsMobile();

  const prefs = useTablePreferences("SupplierReturnsTab", {
    sortField: "created_at",
    sortDir: "desc",
    filters: { filterSupplier: "all", filterStatus: "all", search: "" },
  });
  const sortField = prefs.sortField || "created_at";
  const sortDir = prefs.sortDir || "desc";
  const filterSupplier = prefs.filters.filterSupplier || "all";
  const filterStatus = prefs.filters.filterStatus || "all";
  const search = prefs.filters.search || "";
  const hasActiveFilters = filterSupplier !== "all" || filterStatus !== "all" || search !== "";

  const { isVisible, hide, show, hiddenCols, visibleCount } = useColumnVisibility(
    "supplier-returns:hidden-columns",
    COLUMN_DEFS
  );
  const { menu: colMenu, setMenu: setColMenu, closeMenu } = useColMenu();

  const saveSort = (field: string, dir: "asc" | "desc") => {
    prefs.savePreferences({ sortField: field, sortDir: dir });
  };

  const toggleSort = (field: string) => {
    prefs.toggleSort(field);
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const fetchReturns = useCallback(async () => {
    const [{ data: rets }, { data: items }] = await Promise.all([
      supabase
        .from("supplier_returns")
        .select("*, suppliers(name), waste_items(id)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("waste_items")
        .select("id, product_name, sku, quantity, supplier_return_id")
        .not("supplier_return_id", "is", null),
    ]);
    setReturns(rets ?? []);
    setAllWasteItems(items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchReturns(); }, [fetchReturns]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("supplier-returns-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "supplier_returns" }, () => {
        fetchReturns();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchReturns]);

  const suppliers = useMemo(() => {
    const map = new Map<string, string>();
    returns.forEach((r) => { if (r.suppliers?.name) map.set(r.supplier_id, r.suppliers.name); });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [returns]);

  const filtered = useMemo(() => {
    let list = returns;
    if (filterSupplier !== "all") list = list.filter((r) => r.supplier_id === filterSupplier);
    if (filterStatus !== "all") list = list.filter((r) => r.status === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        (r.suppliers?.name ?? "").toLowerCase().includes(q) ||
        (r.tracking_number ?? "").toLowerCase().includes(q) ||
        (r.return_reason ?? "").toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      let av = "", bv = "";
      if (sortField === "created_at") { av = a.created_at; bv = b.created_at; }
      else if (sortField === "supplier_id") { av = a.suppliers?.name ?? ""; bv = b.suppliers?.name ?? ""; }
      else if (sortField === "status") { av = a.status; bv = b.status; }
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [returns, filterSupplier, filterStatus, search, sortField, sortDir]);

  const kpi = useMemo(() => ({
    total: returns.length,
    draft: returns.filter((r) => r.status === "טיוטה").length,
    shipped: returns.filter((r) => r.status === "נשלח").length,
    settled: returns.filter((r) => r.status === "הוסדר").length,
  }), [returns]);

  const getLinkedItems = (ret: SupplierReturn) =>
    allWasteItems.filter((i) => i.supplier_return_id === ret.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-5">
        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => prefs.savePreferences({ filters: { filterSupplier: "all", filterStatus: "all", search: "" } })}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <PackageX className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kpi.total}</p>
                <p className="text-xs text-muted-foreground">סה"כ החזרות</p>
              </div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => prefs.setFilter("filterStatus", "טיוטה")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <PackageX className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kpi.draft}</p>
                <p className="text-xs text-muted-foreground">טיוטות</p>
              </div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => prefs.setFilter("filterStatus", "נשלח")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <TruckIcon className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kpi.shipped}</p>
                <p className="text-xs text-muted-foreground">בדרך</p>
              </div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => prefs.setFilter("filterStatus", "הוסדר")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CircleCheck className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kpi.settled}</p>
                <p className="text-xs text-muted-foreground">הוסדרו</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters & action */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="חיפוש ספק, מעקב, סיבה..."
              value={search}
              onChange={(e) => prefs.setFilter("search", e.target.value)}
              className="h-9 pr-9 w-48"
            />
          </div>
          <Select value={filterSupplier} onValueChange={(v) => prefs.setFilter("filterSupplier", v)}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="כל הספקים" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הספקים</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={(v) => prefs.setFilter("filterStatus", v)}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="כל הסטטוסים" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הסטטוסים</SelectItem>
              {["טיוטה", "נשלח", "התקבל אצל ספק", "הוסדר"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button size="sm" variant="ghost" onClick={() => prefs.savePreferences({ filters: { filterSupplier: "all", filterStatus: "all", search: "" } })}>
              <X className="h-3 w-3 me-1" /> נקה סינון
            </Button>
          )}
          {canCreate && (
            <Button size="sm" className="me-auto gap-1" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4" />
              החזרה חדשה
            </Button>
          )}
        </div>

        {/* Mobile card layout */}
        {isMobile ? (
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <PackageCheck className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p>אין החזרות לספקים</p>
              </div>
            ) : filtered.map((ret) => {
              const stuck = isStuck(ret);
              const linkedItems = getLinkedItems(ret);
              return (
                <Card
                  key={ret.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedReturn(ret)}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">{ret.suppliers?.name ?? "—"}</span>
                      <div className="flex items-center gap-2">
                        {stuck && (
                          <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            תקוע
                          </span>
                        )}
                        <SupplierReturnStatusBadge status={ret.status} />
                      </div>
                    </div>
                    {ret.tracking_number && (
                      <p className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                        <TruckIcon className="h-3 w-3" />
                        {ret.tracking_number}
                      </p>
                    )}
                    {ret.return_reason && (
                      <p className="text-xs text-muted-foreground">{ret.return_reason}</p>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{linkedItems.length} פריטים</span>
                      <span title={new Date(ret.created_at).toLocaleDateString("he-IL")}>{relativeDate(ret.created_at)}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          /* Desktop Table */
          <div className="rounded-lg border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50" onContextMenu={trContextMenu(hiddenCols, setColMenu)}>
                  {COLUMN_DEFS.map((col) =>
                    isVisible(col.id) ? (
                      <th
                        key={col.id}
                        className="text-right p-3 font-semibold text-foreground"
                        onContextMenu={colThContextMenu(col, setColMenu)}
                      >
                        {col.sortField ? (
                          <button
                            onClick={() => toggleSort(col.sortField!)}
                            className="flex items-center gap-1 cursor-pointer select-none hover:text-accent transition-colors"
                          >
                            {col.label} <SortIcon field={col.sortField} />
                          </button>
                        ) : (
                          col.label
                        )}
                      </th>
                    ) : null
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={visibleCount} className="text-center py-12 text-muted-foreground">
                      <PackageCheck className="h-10 w-10 mx-auto mb-3 opacity-20" />
                      <p>אין החזרות לספקים</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((ret) => {
                    const stuck = isStuck(ret);
                    return (
                      <tr
                        key={ret.id}
                        className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => setSelectedReturn(ret)}
                      >
                        {isVisible("created_at") && (
                          <td className="p-3">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>{relativeDate(ret.created_at)}</span>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="text-xs">
                                {new Date(ret.created_at).toLocaleDateString("he-IL")}
                              </TooltipContent>
                            </Tooltip>
                          </td>
                        )}
                        {isVisible("supplier") && (
                          <td className="p-3 font-medium">{ret.suppliers?.name ?? "—"}</td>
                        )}
                        {isVisible("status") && (
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <SupplierReturnStatusBadge status={ret.status} />
                              {stuck && (
                                <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  תקוע
                                </span>
                              )}
                            </div>
                          </td>
                        )}
                        {isVisible("tracking_number") && (
                          <td className="p-3 font-mono text-xs text-muted-foreground">
                            {ret.tracking_number ?? "—"}
                          </td>
                        )}
                        {isVisible("items_count") && (
                          <td className="p-3 text-center">
                            {(ret.waste_items ?? []).length}
                          </td>
                        )}
                        {isVisible("return_reason") && (
                          <td className="p-3 max-w-[200px] text-muted-foreground">
                            {ret.return_reason ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="block max-w-[200px] truncate">{ret.return_reason}</span>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-xs text-xs">{ret.return_reason}</TooltipContent>
                              </Tooltip>
                            ) : "—"}
                          </td>
                        )}
                        {isVisible("resolution_type") && (
                          <td className="p-3">{ret.resolution_type ?? "—"}</td>
                        )}
                        {isVisible("created_by_name") && (
                          <td className="p-3 text-muted-foreground">{ret.created_by_name ?? "—"}</td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Dialogs */}
        <SupplierReturnDialog
          open={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
          onSaved={() => { setShowCreateDialog(false); fetchReturns(); }}
        />

        {selectedReturn && (
          <SupplierReturnDetailPanel
            open={!!selectedReturn}
            onClose={() => setSelectedReturn(null)}
            onUpdated={() => { fetchReturns(); setSelectedReturn(null); }}
            supplierReturn={selectedReturn}
            items={getLinkedItems(selectedReturn)}
          />
        )}

        {colMenu && (
          <ColContextMenu
            menu={colMenu}
            sortField={sortField}
            sortDir={sortDir}
            hiddenCols={hiddenCols}
            onClose={closeMenu}
            onHide={hide}
            onShow={show}
            onSortAsc={(field) => saveSort(field, "asc")}
            onSortDesc={(field) => saveSort(field, "desc")}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
