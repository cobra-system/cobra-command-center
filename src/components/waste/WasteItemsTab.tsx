/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Search, ChevronUp, ChevronDown, Package, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useData } from "@/contexts/AppContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { ColContextMenu, useColMenu, colThContextMenu, trContextMenu } from "@/components/ui/ColContextMenu";
import type { WasteItem, WasteStatus } from "@/contexts/types";
import { WasteStatusBadge } from "./WasteStatusBadge";
import { AddWasteItemDialog } from "./AddWasteItemDialog";
import { WasteItemPanel } from "./WasteItemPanel";
import { cn } from "@/lib/utils";

// ─── Column definitions ───────────────────────────────────────────────────────

const COLUMN_DEFS = [
  { id: "product",    label: "מוצר",        sortField: "product_name" },
  { id: "quantity",   label: "כמות",        sortField: "quantity" },
  { id: "status",     label: "מצב",         sortField: "status" },
  { id: "notes",      label: "הערות" },
  { id: "source",     label: "מקור" },
  { id: "created_at", label: "תאריך",       sortField: "created_at" },
  { id: "created_by", label: 'נוצר ע"י' },
] as const;

type ColId = (typeof COLUMN_DEFS)[number]["id"];

// ─── Status filter config ─────────────────────────────────────────────────────

const STATUS_TABS: { label: string; value: string; status?: WasteStatus }[] = [
  { label: "הכל",     value: "all" },
  { label: "ממתין",   value: "pending",   status: "pending" },
  { label: "הושמד",   value: "destroyed", status: "destroyed" },
  { label: "בהחזרה",  value: "returning", status: "returning" },
  { label: "בתיקון",  value: "repairing", status: "repairing" },
  { label: "נמכר",    value: "sold",      status: "sold" },
];

// ─── Source badge ─────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source?: string | null }) {
  if (!source) return <span className="text-muted-foreground">—</span>;
  if (source === "equipment_return") {
    return (
      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 border-blue-200">
        החזרת ציוד
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-muted text-muted-foreground border-border">
      ידני
    </span>
  );
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

// ─── Sort persistence ─────────────────────────────────────────────────────────

const SORT_KEY = "waste-items:sort";

function loadSort(): { field: string; dir: "asc" | "desc" } {
  try {
    const s = localStorage.getItem(SORT_KEY);
    if (s) return JSON.parse(s);
  } catch (_) { /* ignore */ }
  return { field: "created_at", dir: "desc" };
}

function saveSort(field: string, dir: "asc" | "desc") {
  localStorage.setItem(SORT_KEY, JSON.stringify({ field, dir }));
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WasteItemsTab() {
  const { hasEdit } = usePermissions("waste");

  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedItem, setSelectedItem] = useState<WasteItem | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ field: string; dir: "asc" | "desc" }>(loadSort);

  // ── Column visibility ──────────────────────────────────────────────────────
  const { isVisible, hide, show, hiddenCols, visibleCount } = useColumnVisibility(
    "waste-items:hidden-columns",
    COLUMN_DEFS,
  );
  const { menu: colMenu, setMenu: setColMenu, closeMenu } = useColMenu();

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ["waste-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waste_items")
        .select("*, products(name, sku), profiles!repair_technician_id(name)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        ...row,
        product_name: row.products?.name ?? null,
        product_sku: row.products?.sku ?? null,
        repair_technician_name: row.profiles?.name ?? null,
      })) as WasteItem[];
    },
  });

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("waste-items-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "waste_items" },
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
      saveSort(next.field, next.dir);
      return next;
    });
  }, []);

  const handleSaveSort = useCallback((field: string, dir: "asc" | "desc") => {
    const next = { field, dir };
    saveSort(field, dir);
    setSort(next);
  }, []);

  // ── Filtering & sorting ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...items];

    // Status filter
    if (statusFilter !== "all") {
      list = list.filter(i => i.status === statusFilter);
    }

    // Text search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(i =>
        (i.product_name?.toLowerCase().includes(q)) ||
        (i.product_sku?.toLowerCase().includes(q)) ||
        (i.created_by_name?.toLowerCase().includes(q)),
      );
    }

    // Sort
    list.sort((a, b) => {
      const { field, dir } = sort;
      const mul = dir === "asc" ? 1 : -1;

      if (field === "product_name") {
        return mul * ((a.product_name ?? "").localeCompare(b.product_name ?? "", "he"));
      }
      if (field === "quantity") {
        return mul * ((a.quantity ?? 0) - (b.quantity ?? 0));
      }
      if (field === "status") {
        return mul * ((a.status ?? "").localeCompare(b.status ?? "", "he"));
      }
      if (field === "created_at") {
        return mul * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
      return 0;
    });

    return list;
  }, [items, statusFilter, search, sort]);

  // ── Status tab counts ──────────────────────────────────────────────────────
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: items.length };
    for (const tab of STATUS_TABS) {
      if (tab.status) {
        counts[tab.value] = items.filter(i => i.status === tab.status).length;
      }
    }
    return counts;
  }, [items]);

  // ── Row click ──────────────────────────────────────────────────────────────
  const handleRowClick = useCallback((item: WasteItem) => {
    setSelectedItem(item);
    setPanelOpen(true);
  }, []);

  const handlePanelClose = useCallback(() => {
    setPanelOpen(false);
  }, []);

  const handlePanelUpdated = useCallback(() => {
    refetch();
  }, [refetch]);

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
            placeholder="חיפוש לפי מוצר, SKU, נוצר ע״י..."
            className={cn(
              "w-full h-9 rounded-md border border-input bg-background pr-9 pl-3 text-sm",
              "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0",
            )}
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Add button */}
        {hasEdit && (
          <button
            onClick={() => setAddDialogOpen(true)}
            className={cn(
              "inline-flex items-center gap-2 h-9 px-4 rounded-md text-sm font-medium",
              "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors",
            )}
          >
            <Plus className="h-4 w-4" />
            הוספת פריט בלאי
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
            <p className="text-sm">טוען פריטי בלאי...</p>
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
                  <Package className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">אין פריטי בלאי להצגה</p>
                <p className="text-xs text-muted-foreground">נסה לשנות את הסינון או לחפש שם אחר</p>
              </div>
            ) : filtered.map(item => (
              <div
                key={item.id}
                className="bg-card rounded-xl border p-4 space-y-3 cursor-pointer active:bg-muted/50 transition-colors"
                onClick={() => handleRowClick(item)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">
                      {item.product_name ?? <span className="text-muted-foreground italic">מוצר לא ידוע</span>}
                    </p>
                    {item.product_sku && (
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">{item.product_sku}</p>
                    )}
                  </div>
                  <WasteStatusBadge status={item.status} />
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>כמות: <span className="font-semibold text-foreground">{item.quantity}</span></span>
                  <span>·</span>
                  <span>{format(new Date(item.created_at), "dd/MM/yyyy")}</span>
                  {item.created_by_name && (
                    <>
                      <span>·</span>
                      <span>{item.created_by_name}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ── Desktop table (hidden on mobile) ─────────────────────────── */}
          <div className="hidden md:block">
            <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
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
                          <Package className="h-8 w-8 text-muted-foreground/40" />
                          <p className="text-sm text-muted-foreground">אין פריטי בלאי להצגה</p>
                          {(search || statusFilter !== "all") && (
                            <p className="text-xs text-muted-foreground/70">נסה לשנות את הסינון</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : filtered.map(item => (
                    <tr
                      key={item.id}
                      className="cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => handleRowClick(item)}
                    >
                      {isVisible("product") && (
                        <td className="p-3">
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="font-medium text-foreground truncate max-w-[180px]">
                              {item.product_name ?? <span className="text-muted-foreground italic text-xs">לא ידוע</span>}
                            </span>
                            {item.product_sku && (
                              <span className="text-[11px] text-muted-foreground font-mono">{item.product_sku}</span>
                            )}
                          </div>
                        </td>
                      )}
                      {isVisible("quantity") && (
                        <td className="p-3 text-foreground font-medium tabular-nums">
                          {item.quantity}
                        </td>
                      )}
                      {isVisible("status") && (
                        <td className="p-3">
                          <WasteStatusBadge status={item.status} />
                        </td>
                      )}
                      {isVisible("notes") && (
                        <td className="p-3 text-muted-foreground text-xs max-w-[200px]">
                          {item.condition_notes ? (
                            <span className="line-clamp-2" title={item.condition_notes}>
                              {item.condition_notes}
                            </span>
                          ) : (
                            <span>—</span>
                          )}
                        </td>
                      )}
                      {isVisible("source") && (
                        <td className="p-3">
                          <SourceBadge source={item.source} />
                        </td>
                      )}
                      {isVisible("created_at") && (
                        <td className="p-3 text-muted-foreground text-xs tabular-nums whitespace-nowrap">
                          {format(new Date(item.created_at), "dd/MM/yyyy")}
                        </td>
                      )}
                      {isVisible("created_by") && (
                        <td className="p-3 text-muted-foreground text-xs">
                          {item.created_by_name ?? "—"}
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
                מציג {filtered.length.toLocaleString("he")} מתוך {items.length.toLocaleString("he")} פריטים
              </p>
            )}
          </div>
        </>
      )}

      {/* ── Dialogs & panels ──────────────────────────────────────────────── */}
      <AddWasteItemDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onCreated={() => { refetch(); }}
      />

      {selectedItem && (
        <WasteItemPanel
          item={selectedItem}
          open={panelOpen}
          onOpenChange={open => { if (!open) handlePanelClose(); }}
          onUpdated={handlePanelUpdated}
        />
      )}

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
