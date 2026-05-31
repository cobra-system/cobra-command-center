import { useState, useMemo, useCallback } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AppContext";
import { useProductScope } from "@/hooks/useProductScope";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/lib/supabase";
import { Combobox } from "@/components/ui/combobox";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { ColContextMenu, useColMenu, colThContextMenu, trContextMenu } from "@/components/ui/ColContextMenu";
import { useTablePreferences } from "@/hooks/useTablePreferences";
import { DispositionBadge, type DispositionType } from "./DispositionBadge";
import { SaleDialog } from "./SaleDialog";
import { SupplierReturnDialog } from "./SupplierReturnDialog";
import { SupplierReturnDetailPanel } from "./SupplierReturnDetailPanel";
import { PhotoCaptureButton } from "@/components/ui/PhotoCaptureButton";
import {
  Recycle,
  Save,
  Pencil,
  X,
  Search,
  Package,
  PackageCheck,
  PackageX,
  Loader2,
  Hash,
  Box,
  MessageSquare,
  ToggleRight,
  Layers,
  MoreHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Trash2,
  Truck,
  DollarSign,
  Clock,
} from "lucide-react";

interface WasteItem {
  id: string;
  product_name: string;
  sku: string;
  quantity: number;
  in_use: boolean;
  recommendations: string;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  photo_url: string | null;
  product_id: string | null;
  component_id: string | null;
  disposition_type: string | null;
  disposition_date: string | null;
  supplier_return_id: string | null;
  sale_buyer_name: string | null;
  sale_price: number | null;
  unit_cost: number | null;
  supplier_id: string | null;
}

interface EditingRow {
  id: string | null;
  product_name: string;
  sku: string;
  quantity: number;
  in_use: boolean;
  recommendations: string;
  itemSource: "product" | "component";
  product_id: string | null;
  component_id: string | null;
  unit_cost: number | null;
  supplier_id: string | null;
}

const emptyRow: EditingRow = {
  id: null,
  product_name: "",
  sku: "",
  quantity: 0,
  in_use: false,
  recommendations: "",
  itemSource: "product",
  product_id: null,
  component_id: null,
  unit_cost: null,
  supplier_id: null,
};

const COLUMN_DEFS = [
  { id: "employee", label: "עובד", sortField: "created_by_name" },
  { id: "product", label: "מוצר", sortField: "product_name" },
  { id: "sku", label: 'מק"ט' },
  { id: "quantity", label: "כמות", sortField: "quantity" },
  { id: "in_use", label: "בשימוש" },
  { id: "notes", label: "הערות" },
  { id: "action", label: "פעולה" },
  { id: "photo", label: "תמונה" },
  { id: "supplier", label: "ספק", sortField: "supplier_id" },
  { id: "unit_cost", label: "עלות יחידה", sortField: "unit_cost" },
  { id: "days_waiting", label: "ימי המתנה", sortField: "created_at" },
  { id: "sale_info", label: "פרטי מכירה" },
] as const;

const ACTION_FILTER_OPTIONS = [
  { value: "all", label: "כל הפעולות" },
  { value: "ממתין", label: "ממתין" },
  { value: "השמדה", label: "השמדה" },
  { value: "החזרה לספק", label: "החזרה לספק" },
  { value: "מכירה בערוץ שלישי", label: "מכירה בערוץ שלישי" },
  { value: "אחר", label: "אחר" },
];

interface Props {
  items: WasteItem[];
  onRefresh: () => void;
  products: Array<{ id: string; name: string; sku: string; components?: Array<{ id: string; name: string; sku: string }> }>;
  suppliers?: Array<{ id: string; name: string }>;
}

function daysAgo(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

export function WasteItemsTab({ items, onRefresh, products, suppliers = [] }: Props) {
  const { currentUser } = useAuth();
  const { isScoped, scopedProductNames } = useProductScope();
  const { hasEdit, isManager } = usePermissions("waste");
  const isMobile = useIsMobile();

  const [editingRow, setEditingRow] = useState<EditingRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WasteItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Disposition dialogs
  const [destroyTarget, setDestroyTarget] = useState<WasteItem | null>(null);
  const [saleTarget, setSaleTarget] = useState<WasteItem | null>(null);
  const [returnTarget, setReturnTarget] = useState<WasteItem | null>(null);
  const [linkedReturn, setLinkedReturn] = useState<{ id: string; supplierReturn: unknown; items: unknown[] } | null>(null);

  // Bulk selection (manager + desktop only)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirmAction, setBulkConfirmAction] = useState<"destroy" | "delete" | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const prefs = useTablePreferences("WasteItemsTab", {
    sortField: "created_at",
    sortDir: "desc",
    filters: { search: "", filterEmployee: "all", filterAction: "all" },
  });
  const sortField = prefs.sortField || "created_at";
  const sortDir = prefs.sortDir || "desc";
  const search = prefs.filters.search || "";
  const filterEmployee = prefs.filters.filterEmployee || "all";
  const filterAction = prefs.filters.filterAction || "all";
  const hasActiveFilters = search !== "" || filterEmployee !== "all" || filterAction !== "all";

  const { isVisible, hide, show, hiddenCols, visibleCount } = useColumnVisibility(
    "waste-items:hidden-columns",
    COLUMN_DEFS,
    [
      ...(isManager ? [] : ["employee" as const]),
      "supplier" as const,
      "unit_cost" as const,
      "days_waiting" as const,
      "sale_info" as const,
    ]
  );
  const { menu: colMenu, setMenu: setColMenu, closeMenu } = useColMenu();

  const saveSort = (field: string, dir: "asc" | "desc") => prefs.savePreferences({ sortField: field, sortDir: dir });
  const toggleSort = (field: string) => prefs.toggleSort(field);
  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const productOptions = useMemo(() => products.map((p) => ({ value: p.name, label: p.name })), [products]);
  const productMap = useMemo(() => {
    const map = new Map<string, { id: string; sku: string }>();
    products.forEach((p) => map.set(p.name, { id: p.id, sku: p.sku }));
    return map;
  }, [products]);
  const componentOptions = useMemo(
    () => products.flatMap((p) => (p.components || []).map((c) => ({ value: c.name, label: `${c.name} — ${p.name}` }))),
    [products]
  );
  const componentMap = useMemo(() => {
    const map = new Map<string, { id: string; sku: string; product_id: string }>();
    products.forEach((p) => {
      (p.components || []).forEach((c) => {
        if (!map.has(c.name)) map.set(c.name, { id: c.id, sku: c.sku || "", product_id: p.id });
      });
    });
    return map;
  }, [products]);

  const supplierOptions = useMemo(() => suppliers.map((s) => ({ value: s.id, label: s.name })), [suppliers]);
  const supplierMap = useMemo(() => {
    const map = new Map<string, string>();
    suppliers.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [suppliers]);

  const isProductFromSystem = useMemo(() => {
    if (!editingRow) return false;
    if (editingRow.itemSource === "component") return componentMap.has(editingRow.product_name);
    return productMap.has(editingRow.product_name);
  }, [editingRow, productMap, componentMap]);

  const handleProductSelect = (val: string) => {
    if (!editingRow) return;
    const hit = productMap.get(val);
    setEditingRow({ ...editingRow, product_name: val, sku: hit?.sku ?? editingRow.sku, product_id: hit?.id ?? null, component_id: null });
  };
  const handleComponentSelect = (val: string) => {
    if (!editingRow) return;
    const hit = componentMap.get(val);
    setEditingRow({ ...editingRow, product_name: val, sku: hit?.sku ?? editingRow.sku, product_id: hit?.product_id ?? null, component_id: hit?.id ?? null });
  };

  const handleBadgeClick = useCallback(async (e: React.MouseEvent, item: WasteItem) => {
    if (!item.supplier_return_id) return;
    e.stopPropagation();
    const [{ data: ret }, { data: retItems }] = await Promise.all([
      supabase.from("supplier_returns").select("*, suppliers(name)").eq("id", item.supplier_return_id).single(),
      supabase.from("waste_items").select("id, product_name, sku, quantity").eq("supplier_return_id", item.supplier_return_id),
    ]);
    if (ret) setLinkedReturn({ id: ret.id, supplierReturn: ret, items: retItems ?? [] });
  }, []);

  const employees = useMemo(() => {
    if (!isManager) return [];
    const map = new Map<string, string>();
    items.forEach((item) => { if (item.created_by && item.created_by_name) map.set(item.created_by, item.created_by_name); });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [items, isManager]);

  const filteredItems = useMemo(() => {
    let filtered = items;
    if (isScoped) filtered = filtered.filter((item) => scopedProductNames.has(item.product_name));
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((item) =>
        item.product_name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        (item.recommendations || "").toLowerCase().includes(q)
      );
    }
    if (isManager && filterEmployee !== "all") filtered = filtered.filter((item) => item.created_by === filterEmployee);
    if (filterAction !== "all") {
      if (filterAction === "ממתין") filtered = filtered.filter((i) => !i.disposition_type);
      else if (filterAction === "מכירה בערוץ שלישי")
        filtered = filtered.filter((i) => i.disposition_type === "מכירה" || i.disposition_type === "מכירה בערוץ שלישי");
      else filtered = filtered.filter((i) => i.disposition_type === filterAction);
    }
    return [...filtered].sort((a, b) => {
      if (sortField === "quantity") return sortDir === "asc" ? a.quantity - b.quantity : b.quantity - a.quantity;
      if (sortField === "unit_cost") return sortDir === "asc" ? (a.unit_cost ?? 0) - (b.unit_cost ?? 0) : (b.unit_cost ?? 0) - (a.unit_cost ?? 0);
      let av = "", bv = "";
      if (sortField === "product_name") { av = a.product_name; bv = b.product_name; }
      else if (sortField === "created_by_name") { av = a.created_by_name ?? ""; bv = b.created_by_name ?? ""; }
      else { av = a.created_at; bv = b.created_at; }
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [items, search, filterEmployee, filterAction, isManager, isScoped, scopedProductNames, sortField, sortDir]);

  const handleSave = async () => {
    if (!editingRow || !currentUser) return;
    if (!editingRow.product_name.trim()) { toast.error("יש להזין שם מוצר"); return; }
    setSaving(true);
    try {
      if (editingRow.id) {
        const { error } = await supabase.from("waste_items").update({
          product_name: editingRow.product_name.trim(),
          sku: editingRow.sku.trim(),
          quantity: editingRow.quantity,
          in_use: editingRow.in_use,
          recommendations: editingRow.recommendations.trim(),
          product_id: editingRow.product_id,
          component_id: editingRow.component_id,
          unit_cost: editingRow.unit_cost,
          supplier_id: editingRow.supplier_id,
          updated_at: new Date().toISOString(),
        }).eq("id", editingRow.id);
        if (error) throw error;
        toast.success("הפריט עודכן בהצלחה");
      } else {
        const { error } = await supabase.from("waste_items").insert({
          product_name: editingRow.product_name.trim(),
          sku: editingRow.sku.trim(),
          quantity: editingRow.quantity,
          in_use: editingRow.in_use,
          recommendations: editingRow.recommendations.trim(),
          product_id: editingRow.product_id,
          component_id: editingRow.component_id,
          unit_cost: editingRow.unit_cost,
          supplier_id: editingRow.supplier_id,
          created_by: currentUser.id,
          created_by_name: currentUser.name,
        });
        if (error) throw error;
        toast.success("הפריט נוסף בהצלחה");
      }
      setEditingRow(null);
      setDrawerOpen(false);
      onRefresh();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "שגיאה בשמירת הפריט";
      logger.error("Waste item save error", error);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("waste_items").delete().eq("id", deleteTarget.id);
    if (error) { toast.error("שגיאה במחיקת הפריט"); setDeleting(false); return; }
    toast.success("הפריט נמחק");
    setDeleting(false);
    setDeleteTarget(null);
    onRefresh();
  };

  const handleInlineToggle = async (item: WasteItem) => {
    const { error } = await supabase.from("waste_items").update({ in_use: !item.in_use, updated_at: new Date().toISOString() }).eq("id", item.id);
    if (error) { toast.error("שגיאה בעדכון"); return; }
    onRefresh();
  };

  const handleDestroy = async () => {
    if (!destroyTarget) return;
    const { error } = await supabase.from("waste_items").update({
      disposition_type: "השמדה",
      disposition_date: new Date().toISOString(),
    }).eq("id", destroyTarget.id);
    if (error) { toast.error("שגיאה בסימון כהושמד"); return; }
    toast.success("הפריט סומן כהושמד");
    setDestroyTarget(null);
    onRefresh();
  };

  const handleSale = async (buyerName: string, price: number | null) => {
    if (!saleTarget) return;
    const { error } = await supabase.from("waste_items").update({
      disposition_type: "מכירה בערוץ שלישי",
      disposition_date: new Date().toISOString(),
      sale_buyer_name: buyerName,
      sale_price: price,
    }).eq("id", saleTarget.id);
    if (error) { toast.error("שגיאה בסימון כמכירה"); return; }
    toast.success("הפריט סומן כנמכר");
    setSaleTarget(null);
    onRefresh();
  };

  const handlePhotoSave = async (itemId: string, url: string) => {
    const { error } = await supabase.from("waste_items").update({ photo_url: url }).eq("id", itemId);
    if (error) { toast.error("שגיאה בשמירת תמונה"); return; }
    onRefresh();
  };

  const handleBulkDestroy = async () => {
    setBulkProcessing(true);
    try {
      await Promise.all(
        [...selectedIds].map((id) =>
          supabase.from("waste_items").update({ disposition_type: "השמדה", disposition_date: new Date().toISOString() }).eq("id", id)
        )
      );
      toast.success(`${selectedIds.size} פריטים סומנו כהושמדו`);
      setSelectedIds(new Set());
      onRefresh();
    } catch {
      toast.error("שגיאה בעדכון מרובה");
    } finally {
      setBulkProcessing(false);
      setBulkConfirmAction(null);
    }
  };

  const handleBulkDelete = async () => {
    setBulkProcessing(true);
    try {
      await Promise.all([...selectedIds].map((id) => supabase.from("waste_items").delete().eq("id", id)));
      toast.success(`${selectedIds.size} פריטים נמחקו`);
      setSelectedIds(new Set());
      onRefresh();
    } catch {
      toast.error("שגיאה במחיקה מרובה");
    } finally {
      setBulkProcessing(false);
      setBulkConfirmAction(null);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((i) => i.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const startEdit = (item: WasteItem) => {
    setEditingRow({
      id: item.id,
      product_name: item.product_name,
      sku: item.sku,
      quantity: item.quantity,
      in_use: item.in_use,
      recommendations: item.recommendations,
      itemSource: item.component_id ? "component" : "product",
      product_id: item.product_id,
      component_id: item.component_id,
      unit_cost: item.unit_cost,
      supplier_id: item.supplier_id,
    });
    if (isMobile) setDrawerOpen(true);
  };

  const handleDrawerClose = (open: boolean) => {
    if (!open) { setDrawerOpen(false); setEditingRow(null); }
  };

  const csvEscape = (val: string) => `"${val.replace(/"/g, '""')}"`;

  const handleExportCSV = () => {
    const rows = [
      ["מוצר", 'מק"ט', "כמות", "ספק", "עלות יחידה", "שווי כולל", "סטטוס שימוש", "פעולה", "קונה", "מחיר מכירה", "ימי המתנה", "תאריך פעולה", "יוצר", "תאריך יצירה"],
      ...filteredItems.map((i) => {
        const days = !i.disposition_type ? String(daysAgo(i.created_at)) : "";
        return [
          i.product_name,
          i.sku ?? "",
          String(i.quantity),
          i.supplier_id ? (supplierMap.get(i.supplier_id) ?? i.supplier_id) : "",
          i.unit_cost != null ? String(i.unit_cost) : "",
          i.unit_cost != null ? String(i.unit_cost * i.quantity) : "",
          i.in_use ? "בשימוש" : "לא בשימוש",
          i.disposition_type === "מכירה" ? "מכירה בערוץ שלישי" : (i.disposition_type ?? "ממתין"),
          i.sale_buyer_name ?? "",
          i.sale_price != null ? String(i.sale_price) : "",
          days,
          i.disposition_date ? new Date(i.disposition_date).toLocaleDateString("he-IL") : "",
          i.created_by_name ?? "",
          new Date(i.created_at).toLocaleDateString("he-IL"),
        ];
      }),
    ];
    const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `בלאי-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SourceToggle = ({ source, onChange }: { source: "product" | "component"; onChange: (s: "product" | "component") => void }) => (
    <div className="inline-flex rounded-md border bg-muted/40 p-0.5 gap-0.5">
      {(["product", "component"] as const).map((s) => (
        <button key={s} type="button" onClick={() => onChange(s)}
          className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${source === s ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          {s === "product" ? "מוצר" : "פריט"}
        </button>
      ))}
    </div>
  );

  // ──── MOBILE ────
  if (isMobile) {
    return (
      <div className="flex flex-col min-h-[calc(100dvh-12rem)] pb-24">
        {/* Filters */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-4 pt-4 pb-3 space-y-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="חיפוש מוצר, מק״ט..." value={search}
              onChange={(e) => prefs.setFilter("search", e.target.value)} className="pr-10 h-10 rounded-xl" />
          </div>
          <select value={filterAction} onChange={(e) => prefs.setFilter("filterAction", e.target.value)}
            className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm">
            {ACTION_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {isManager && employees.length > 0 && (
            <select value={filterEmployee} onChange={(e) => prefs.setFilter("filterEmployee", e.target.value)}
              className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm">
              <option value="all">כל העובדים</option>
              {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
            </select>
          )}
        </div>

        <div className="flex-1 px-4 pt-3 space-y-3">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 bg-muted/30 rounded-full mb-4"><Recycle className="h-12 w-12 text-muted-foreground/30" /></div>
              <p className="text-base font-medium text-muted-foreground mb-1">{search ? "לא נמצאו תוצאות" : "אין פריטי בלאי"}</p>
            </div>
          ) : filteredItems.map((item) => {
            const days = !item.disposition_type ? daysAgo(item.created_at) : null;
            return (
              <Card key={item.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-start justify-between p-3.5 pb-2 cursor-pointer" onClick={() => hasEdit && startEdit(item)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-base truncate">{item.product_name}</h3>
                        {hasEdit && <Pencil className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />}
                      </div>
                      {isManager && item.created_by_name && <p className="text-xs text-muted-foreground">{item.created_by_name}</p>}
                      {item.sku && <p className="text-xs text-muted-foreground font-mono flex items-center gap-1"><Hash className="h-3 w-3" />{item.sku}</p>}
                      {/* Supplier + cost micro-line */}
                      {(item.supplier_id || item.unit_cost != null) && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                          {item.supplier_id && supplierMap.get(item.supplier_id) && (
                            <span className="flex items-center gap-0.5"><Truck className="h-3 w-3" />{supplierMap.get(item.supplier_id)}</span>
                          )}
                          {item.unit_cost != null && (
                            <span className="flex items-center gap-0.5"><DollarSign className="h-3 w-3" />₪{item.unit_cost}/יח׳</span>
                          )}
                        </p>
                      )}
                      {/* Sale info micro-line */}
                      {(item.disposition_type === "מכירה" || item.disposition_type === "מכירה בערוץ שלישי") && item.sale_buyer_name && (
                        <p className="text-xs text-green-600 mt-0.5">קונה: {item.sale_buyer_name}{item.sale_price != null ? ` · ₪${item.sale_price}` : ""}</p>
                      )}
                      <div className="mt-1 flex items-center gap-2">
                        {item.disposition_type === "החזרה לספק" ? (
                          <button className="cursor-pointer hover:opacity-80 transition-opacity" onClick={(e) => handleBadgeClick(e, item)}>
                            <DispositionBadge disposition={item.disposition_type as DispositionType} />
                          </button>
                        ) : (
                          <DispositionBadge disposition={item.disposition_type as DispositionType} />
                        )}
                        {days !== null && days > 30 && (
                          <span className="text-xs text-orange-600 font-medium flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />{days}d
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant={item.in_use ? "default" : "secondary"} className={`flex-shrink-0 text-xs ${item.in_use ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-orange-100 text-orange-700 hover:bg-orange-100"}`}>
                      {item.in_use ? "בשימוש" : "לא בשימוש"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between px-3.5 pb-3 gap-3">
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Box className="h-3.5 w-3.5" /><span className="font-medium text-foreground">{item.quantity}</span> יח׳
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <PhotoCaptureButton imageUrl={item.photo_url} storagePath={`waste-items/${item.id}`}
                        onSave={(url) => handlePhotoSave(item.id, url)} disabled={!hasEdit} />
                      {hasEdit && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" dir="rtl">
                            <DropdownMenuItem onClick={() => startEdit(item)}>
                              <Pencil className="h-4 w-4 me-2" /> עריכה
                            </DropdownMenuItem>
                            {!item.disposition_type && <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setDestroyTarget(item)} className="text-destructive">
                                <Trash2 className="h-4 w-4 me-2" /> סמן כהושמד
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setReturnTarget(item)}>
                                <PackageX className="h-4 w-4 me-2" /> החזרה לספק
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setSaleTarget(item)}>
                                <Box className="h-4 w-4 me-2" /> מכירה בערוץ שלישי
                              </DropdownMenuItem>
                            </>}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setDeleteTarget(item)} className="text-destructive">
                              <Trash2 className="h-4 w-4 me-2" /> מחיקת רשומה
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Mobile edit drawer */}
        <Drawer open={drawerOpen} onOpenChange={handleDrawerClose}>
          <DrawerContent className="max-h-[92dvh]">
            <DrawerHeader className="text-right pb-2">
              <DrawerTitle className="text-lg">{editingRow?.id ? "עריכת פריט" : "הוספת פריט"}</DrawerTitle>
              <DrawerDescription>{editingRow?.id ? "עדכון פרטי הפריט" : "הוספת פריט בלאי חדש"}</DrawerDescription>
            </DrawerHeader>
            {editingRow && (
              <div className="px-4 space-y-5 overflow-y-auto">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">{editingRow.itemSource === "component" ? "שם הפריט" : "שם המוצר"}</Label>
                    <SourceToggle source={editingRow.itemSource} onChange={(s) => setEditingRow({ ...editingRow, product_name: "", sku: "", product_id: null, component_id: null, itemSource: s })} />
                  </div>
                  {editingRow.itemSource === "component" ? (
                    <Combobox value={editingRow.product_name} onValueChange={handleComponentSelect} options={componentOptions} placeholder="בחר פריט..." allowCustomValue className="h-12 rounded-xl text-base" />
                  ) : (
                    <Combobox value={editingRow.product_name} onValueChange={handleProductSelect} options={productOptions} placeholder="בחר מוצר..." allowCustomValue className="h-12 rounded-xl text-base" />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>מק"ט</Label>
                    <Input placeholder="XXX-000" value={editingRow.sku} onChange={(e) => setEditingRow({ ...editingRow, sku: e.target.value })} disabled={isProductFromSystem} className="h-12 rounded-xl font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label>כמות</Label>
                    <Input type="number" min={0} value={editingRow.quantity || ""} onChange={(e) => setEditingRow({ ...editingRow, quantity: parseInt(e.target.value) || 0 })} className="h-12 rounded-xl text-center" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1"><Truck className="h-3.5 w-3.5" />ספק</Label>
                    <Combobox value={editingRow.supplier_id ?? ""} onValueChange={(v) => setEditingRow({ ...editingRow, supplier_id: v || null })} options={[{ value: "", label: "ללא" }, ...supplierOptions]} placeholder="בחר ספק..." className="h-12 rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />עלות יחידה (₪)</Label>
                    <Input type="number" min={0} step={0.01} placeholder="0.00"
                      value={editingRow.unit_cost ?? ""}
                      onChange={(e) => setEditingRow({ ...editingRow, unit_cost: e.target.value ? parseFloat(e.target.value) : null })}
                      className="h-12 rounded-xl" />
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-xl">
                  <Checkbox id="mobile-inuse" checked={editingRow.in_use} onCheckedChange={(c) => setEditingRow({ ...editingRow, in_use: !!c })} />
                  <Label htmlFor="mobile-inuse" className="cursor-pointer flex items-center gap-2"><ToggleRight className="h-4 w-4 text-primary" />בשימוש</Label>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />הערות</Label>
                  <Textarea placeholder="הערות..." value={editingRow.recommendations} onChange={(e) => setEditingRow({ ...editingRow, recommendations: e.target.value })} rows={3} className="rounded-xl resize-none" />
                </div>
              </div>
            )}
            <DrawerFooter className="pt-4 pb-6 gap-2">
              <Button onClick={handleSave} disabled={saving || !editingRow?.product_name.trim()} className="h-12 rounded-xl gap-2">
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                {editingRow?.id ? "עדכון" : "הוספה"}
              </Button>
              <Button variant="ghost" onClick={() => handleDrawerClose(false)} className="h-11 rounded-xl text-muted-foreground">ביטול</Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        {/* Dialogs */}
        <AlertDialog open={!!destroyTarget} onOpenChange={(o) => !o && setDestroyTarget(null)}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2"><Trash2 className="h-5 w-5 text-destructive" />סימון כהושמד</AlertDialogTitle>
              <AlertDialogDescription>האם לסמן את <strong>{destroyTarget?.product_name}</strong> כהושמד?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row-reverse gap-2">
              <AlertDialogCancel>ביטול</AlertDialogCancel>
              <AlertDialogAction onClick={handleDestroy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">סמן כהושמד</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <SaleDialog open={!!saleTarget} onClose={() => setSaleTarget(null)} onConfirm={handleSale} itemName={saleTarget?.product_name ?? ""} />
        <SupplierReturnDialog open={!!returnTarget} onClose={() => setReturnTarget(null)} onSaved={() => { setReturnTarget(null); onRefresh(); }} preselectedItemId={returnTarget?.id} />

        {linkedReturn && (
          <SupplierReturnDetailPanel
            open={!!linkedReturn}
            onClose={() => setLinkedReturn(null)}
            onUpdated={() => { setLinkedReturn(null); onRefresh(); }}
            supplierReturn={linkedReturn.supplierReturn as Parameters<typeof SupplierReturnDetailPanel>[0]["supplierReturn"]}
            items={linkedReturn.items as Parameters<typeof SupplierReturnDetailPanel>[0]["items"]}
          />
        )}

        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>מחיקת פריט</AlertDialogTitle>
              <AlertDialogDescription>האם למחוק לצמיתות את <strong>{deleteTarget?.product_name}</strong>? לא ניתן לשחזר.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row-reverse gap-2">
              <AlertDialogCancel>ביטול</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {deleting ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}מחק
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ──── DESKTOP ────
  // fixed cols: actions + bulk checkbox (manager only)
  const FIXED_COLS = hasEdit ? (isManager ? 2 : 1) : 0;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="חיפוש לפי מוצר, מק״ט או הערות..." value={search}
              onChange={(e) => prefs.setFilter("search", e.target.value)} className="pr-10" />
          </div>
          <Select value={filterAction} onValueChange={(v) => prefs.setFilter("filterAction", v)}>
            <SelectTrigger className="h-10 w-[200px]"><SelectValue placeholder="כל הפעולות" /></SelectTrigger>
            <SelectContent>
              {ACTION_FILTER_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {isManager && employees.length > 0 && (
            <Select value={filterEmployee} onValueChange={(v) => prefs.setFilter("filterEmployee", v)}>
              <SelectTrigger className="h-10 w-[160px]"><SelectValue placeholder="כל העובדים" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל העובדים</SelectItem>
                {employees.map((emp) => <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {hasActiveFilters && (
            <Button size="sm" variant="ghost" onClick={() => prefs.savePreferences({ filters: { search: "", filterEmployee: "all", filterAction: "all" } })}>
              <X className="h-3 w-3 me-1" /> נקה סינון
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-1" onClick={handleExportCSV}>
            <Download className="h-3 w-3" /> ייצוא CSV
          </Button>
        </div>

        {/* Summary counts */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" />{items.length} פריטים</span>
          <span className="flex items-center gap-1 text-green-600"><PackageCheck className="h-3.5 w-3.5" />{items.filter((i) => i.in_use).length} בשימוש</span>
          <span className="flex items-center gap-1 text-orange-500"><PackageX className="h-3.5 w-3.5" />{items.filter((i) => !i.disposition_type).length} ממתינים</span>
          {filteredItems.length !== items.length && (
            <span className="text-primary font-medium">מציג {filteredItems.length} פריטים</span>
          )}
        </div>

        {/* Bulk action bar */}
        {isManager && selectedIds.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-lg">
            <span className="text-sm font-medium">{selectedIds.size} פריטים נבחרו</span>
            <div className="flex items-center gap-2 mr-auto">
              <Button size="sm" variant="destructive" className="gap-1 h-8" onClick={() => setBulkConfirmAction("destroy")} disabled={bulkProcessing}>
                <Trash2 className="h-3.5 w-3.5" /> סמן כהושמד
              </Button>
              <Button size="sm" variant="outline" className="gap-1 h-8 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => setBulkConfirmAction("delete")} disabled={bulkProcessing}>
                <Trash2 className="h-3.5 w-3.5" /> מחיקה
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setSelectedIds(new Set())}>
                <X className="h-3.5 w-3.5 me-1" /> נקה בחירה
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b bg-muted/50" onContextMenu={trContextMenu(hiddenCols, setColMenu)}>
                {/* Bulk select checkbox column — manager only, not in COLUMN_DEFS */}
                {isManager && (
                  <TableHead className="w-10 text-center">
                    <Checkbox
                      checked={filteredItems.length > 0 && selectedIds.size === filteredItems.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                )}
                {COLUMN_DEFS.map((col) =>
                  isVisible(col.id) ? (
                    <TableHead key={col.id} className="font-semibold text-foreground" onContextMenu={colThContextMenu(col, setColMenu)}>
                      {col.sortField ? (
                        <button onClick={() => toggleSort(col.sortField!)} className="flex items-center gap-1 cursor-pointer select-none hover:text-accent transition-colors">
                          {col.label} <SortIcon field={col.sortField} />
                        </button>
                      ) : col.label}
                    </TableHead>
                  ) : null
                )}
                {hasEdit && <TableHead className="font-semibold text-center w-24 text-foreground">פעולות</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Inline new row */}
              {editingRow && editingRow.id === null && (
                <TableRow className="bg-primary/5">
                  {isManager && <TableCell />}
                  {isVisible("employee") && isManager && <TableCell className="text-sm text-muted-foreground">{currentUser?.name}</TableCell>}
                  {isVisible("product") && (
                    <TableCell>
                      <div className="space-y-1">
                        <SourceToggle source={editingRow.itemSource} onChange={(s) => setEditingRow({ ...editingRow, product_name: "", sku: "", product_id: null, component_id: null, itemSource: s })} />
                        {editingRow.itemSource === "component" ? (
                          <Combobox value={editingRow.product_name} onValueChange={handleComponentSelect} options={componentOptions} placeholder="בחר פריט..." allowCustomValue className="h-9" />
                        ) : (
                          <Combobox value={editingRow.product_name} onValueChange={handleProductSelect} options={productOptions} placeholder="בחר מוצר..." allowCustomValue className="h-9" />
                        )}
                      </div>
                    </TableCell>
                  )}
                  {isVisible("sku") && <TableCell><Input placeholder="מק״ט" value={editingRow.sku} onChange={(e) => setEditingRow({ ...editingRow, sku: e.target.value })} disabled={isProductFromSystem} className="h-9" /></TableCell>}
                  {isVisible("quantity") && <TableCell><Input type="number" min={0} placeholder="0" value={editingRow.quantity || ""} onChange={(e) => setEditingRow({ ...editingRow, quantity: parseInt(e.target.value) || 0 })} className="h-9 w-20 text-center mx-auto" /></TableCell>}
                  {isVisible("in_use") && <TableCell className="text-center"><Checkbox checked={editingRow.in_use} onCheckedChange={(c) => setEditingRow({ ...editingRow, in_use: !!c })} /></TableCell>}
                  {isVisible("notes") && <TableCell><Input placeholder="הערות..." value={editingRow.recommendations} onChange={(e) => setEditingRow({ ...editingRow, recommendations: e.target.value })} className="h-9" /></TableCell>}
                  {isVisible("action") && <TableCell />}
                  {isVisible("photo") && <TableCell />}
                  {isVisible("supplier") && <TableCell><Combobox value={editingRow.supplier_id ?? ""} onValueChange={(v) => setEditingRow({ ...editingRow, supplier_id: v || null })} options={[{ value: "", label: "ללא" }, ...supplierOptions]} placeholder="ספק..." className="h-9" /></TableCell>}
                  {isVisible("unit_cost") && <TableCell><Input type="number" min={0} step={0.01} placeholder="עלות" value={editingRow.unit_cost ?? ""} onChange={(e) => setEditingRow({ ...editingRow, unit_cost: e.target.value ? parseFloat(e.target.value) : null })} className="h-9 w-24" /></TableCell>}
                  {isVisible("days_waiting") && <TableCell />}
                  {isVisible("sale_info") && <TableCell />}
                  {hasEdit && (
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={handleSave} disabled={saving}>
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setEditingRow(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )}

              {/* Existing rows */}
              {filteredItems.map((item) => {
                const days = !item.disposition_type ? daysAgo(item.created_at) : null;
                return editingRow && editingRow.id === item.id ? (
                  <TableRow key={item.id} className="bg-primary/5">
                    {isManager && <TableCell />}
                    {isVisible("employee") && isManager && <TableCell className="text-sm">{item.created_by_name}</TableCell>}
                    {isVisible("product") && (
                      <TableCell>
                        <div className="space-y-1">
                          <SourceToggle source={editingRow.itemSource} onChange={(s) => setEditingRow({ ...editingRow, product_name: "", sku: "", product_id: null, component_id: null, itemSource: s })} />
                          {editingRow.itemSource === "component" ? (
                            <Combobox value={editingRow.product_name} onValueChange={handleComponentSelect} options={componentOptions} placeholder="בחר פריט..." allowCustomValue className="h-9" />
                          ) : (
                            <Combobox value={editingRow.product_name} onValueChange={handleProductSelect} options={productOptions} placeholder="בחר מוצר..." allowCustomValue className="h-9" />
                          )}
                        </div>
                      </TableCell>
                    )}
                    {isVisible("sku") && <TableCell><Input value={editingRow.sku} onChange={(e) => setEditingRow({ ...editingRow, sku: e.target.value })} disabled={isProductFromSystem} className="h-9" /></TableCell>}
                    {isVisible("quantity") && <TableCell><Input type="number" min={0} value={editingRow.quantity || ""} onChange={(e) => setEditingRow({ ...editingRow, quantity: parseInt(e.target.value) || 0 })} className="h-9 w-20 text-center mx-auto" /></TableCell>}
                    {isVisible("in_use") && <TableCell className="text-center"><Checkbox checked={editingRow.in_use} onCheckedChange={(c) => setEditingRow({ ...editingRow, in_use: !!c })} /></TableCell>}
                    {isVisible("notes") && <TableCell><Input value={editingRow.recommendations} onChange={(e) => setEditingRow({ ...editingRow, recommendations: e.target.value })} className="h-9" /></TableCell>}
                    {isVisible("action") && <TableCell />}
                    {isVisible("photo") && <TableCell className="text-center"><div className="flex justify-center"><PhotoCaptureButton imageUrl={item.photo_url} storagePath={`waste-items/${item.id}`} onSave={(url) => handlePhotoSave(item.id, url)} /></div></TableCell>}
                    {isVisible("supplier") && <TableCell><Combobox value={editingRow.supplier_id ?? ""} onValueChange={(v) => setEditingRow({ ...editingRow, supplier_id: v || null })} options={[{ value: "", label: "ללא" }, ...supplierOptions]} placeholder="ספק..." className="h-9" /></TableCell>}
                    {isVisible("unit_cost") && <TableCell><Input type="number" min={0} step={0.01} value={editingRow.unit_cost ?? ""} onChange={(e) => setEditingRow({ ...editingRow, unit_cost: e.target.value ? parseFloat(e.target.value) : null })} className="h-9 w-24" /></TableCell>}
                    {isVisible("days_waiting") && <TableCell />}
                    {isVisible("sale_info") && <TableCell />}
                    {hasEdit && (
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={handleSave} disabled={saving}>
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setEditingRow(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ) : (
                  <TableRow key={item.id} className={`group ${selectedIds.has(item.id) ? "bg-primary/5" : ""}`}>
                    {isManager && (
                      <TableCell className="text-center w-10">
                        <Checkbox checked={selectedIds.has(item.id)} onCheckedChange={() => toggleSelectOne(item.id)} />
                      </TableCell>
                    )}
                    {isVisible("employee") && isManager && <TableCell className="text-sm font-medium">{item.created_by_name || "—"}</TableCell>}
                    {isVisible("product") && <TableCell className="font-medium">{item.product_name}</TableCell>}
                    {isVisible("sku") && <TableCell className="text-muted-foreground font-mono text-sm">{item.sku || "—"}</TableCell>}
                    {isVisible("quantity") && <TableCell className="text-center font-semibold">{item.quantity}</TableCell>}
                    {isVisible("in_use") && (
                      <TableCell className="text-center">
                        {hasEdit ? (
                          <Checkbox checked={item.in_use} onCheckedChange={() => handleInlineToggle(item)} />
                        ) : (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${item.in_use ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                            {item.in_use ? "כן" : "לא"}
                          </span>
                        )}
                      </TableCell>
                    )}
                    {isVisible("notes") && (
                      <TableCell className="max-w-[200px] text-sm text-muted-foreground">
                        {item.recommendations ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block max-w-[200px] truncate">{item.recommendations}</span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs text-xs">{item.recommendations}</TooltipContent>
                          </Tooltip>
                        ) : "—"}
                      </TableCell>
                    )}
                    {isVisible("action") && (
                      <TableCell>
                        {item.disposition_type === "החזרה לספק" ? (
                          <button className="cursor-pointer hover:opacity-80 transition-opacity" onClick={(e) => handleBadgeClick(e, item)}>
                            <DispositionBadge disposition={item.disposition_type as DispositionType} />
                          </button>
                        ) : (
                          <DispositionBadge disposition={item.disposition_type as DispositionType} />
                        )}
                      </TableCell>
                    )}
                    {isVisible("photo") && (
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <PhotoCaptureButton imageUrl={item.photo_url} storagePath={`waste-items/${item.id}`}
                            onSave={(url) => handlePhotoSave(item.id, url)} disabled={!hasEdit} />
                        </div>
                      </TableCell>
                    )}
                    {isVisible("supplier") && (
                      <TableCell className="text-sm text-muted-foreground">
                        {item.supplier_id && supplierMap.get(item.supplier_id) ? (
                          <span className="flex items-center gap-1"><Truck className="h-3.5 w-3.5" />{supplierMap.get(item.supplier_id)}</span>
                        ) : "—"}
                      </TableCell>
                    )}
                    {isVisible("unit_cost") && (
                      <TableCell className="text-sm text-right">
                        {item.unit_cost != null ? (
                          <span className="font-mono">₪{item.unit_cost.toLocaleString("he-IL")}</span>
                        ) : "—"}
                      </TableCell>
                    )}
                    {isVisible("days_waiting") && (
                      <TableCell className="text-center text-sm">
                        {days !== null ? (
                          <span className={days > 30 ? "text-orange-600 font-medium flex items-center gap-1 justify-center" : "text-muted-foreground"}>
                            {days > 30 && <Clock className="h-3.5 w-3.5" />}
                            {days}d
                          </span>
                        ) : "—"}
                      </TableCell>
                    )}
                    {isVisible("sale_info") && (
                      <TableCell className="text-sm text-muted-foreground">
                        {(item.disposition_type === "מכירה" || item.disposition_type === "מכירה בערוץ שלישי") && item.sale_buyer_name ? (
                          <span>{item.sale_buyer_name}{item.sale_price != null ? ` · ₪${item.sale_price}` : ""}</span>
                        ) : "—"}
                      </TableCell>
                    )}
                    {hasEdit && (
                      <TableCell>
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => startEdit(item)} disabled={editingRow !== null}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8" disabled={editingRow !== null}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" dir="rtl">
                              {!item.disposition_type && (
                                <>
                                  <DropdownMenuItem onClick={() => setDestroyTarget(item)} className="text-destructive">
                                    <Trash2 className="h-4 w-4 me-2" /> סמן כהושמד
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setReturnTarget(item)}>
                                    <PackageX className="h-4 w-4 me-2" /> החזרה לספק
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setSaleTarget(item)}>
                                    <Box className="h-4 w-4 me-2" /> מכירה בערוץ שלישי
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              <DropdownMenuItem onClick={() => setDeleteTarget(item)} className="text-destructive">
                                <Trash2 className="h-4 w-4 me-2" /> מחיקת רשומה
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}

              {filteredItems.length === 0 && !editingRow && (
                <TableRow>
                  <TableCell colSpan={visibleCount + FIXED_COLS} className="text-center py-12 text-muted-foreground">
                    <Recycle className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="text-lg font-medium mb-1">אין פריטי בלאי</p>
                    <p className="text-sm">{search || filterAction !== "all" ? "לא נמצאו תוצאות לפי הסינון הנוכחי" : "לא נוספו פריטי בלאי עדיין"}</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Dialogs */}
        <AlertDialog open={!!destroyTarget} onOpenChange={(o) => !o && setDestroyTarget(null)}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2"><Trash2 className="h-5 w-5 text-destructive" />סימון כהושמד</AlertDialogTitle>
              <AlertDialogDescription>האם לסמן את <strong>{destroyTarget?.product_name}</strong> כהושמד? הפריט יישאר ברשימה עם סטטוס השמדה.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row-reverse gap-2">
              <AlertDialogCancel>ביטול</AlertDialogCancel>
              <AlertDialogAction onClick={handleDestroy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">סמן כהושמד</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk confirm dialogs */}
        <AlertDialog open={bulkConfirmAction === "destroy"} onOpenChange={(o) => !o && setBulkConfirmAction(null)}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2"><Trash2 className="h-5 w-5 text-destructive" />סימון {selectedIds.size} פריטים כהושמדו</AlertDialogTitle>
              <AlertDialogDescription>פעולה זו תסמן את כל הפריטים הנבחרים כהושמדו. לא ניתן לשחזר.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row-reverse gap-2">
              <AlertDialogCancel>ביטול</AlertDialogCancel>
              <AlertDialogAction onClick={handleBulkDestroy} disabled={bulkProcessing} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {bulkProcessing ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}אשר
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={bulkConfirmAction === "delete"} onOpenChange={(o) => !o && setBulkConfirmAction(null)}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>מחיקת {selectedIds.size} פריטים</AlertDialogTitle>
              <AlertDialogDescription>פעולה זו תמחק לצמיתות את כל הפריטים הנבחרים. לא ניתן לשחזר.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row-reverse gap-2">
              <AlertDialogCancel>ביטול</AlertDialogCancel>
              <AlertDialogAction onClick={handleBulkDelete} disabled={bulkProcessing} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {bulkProcessing ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}מחק הכל
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <SaleDialog open={!!saleTarget} onClose={() => setSaleTarget(null)} onConfirm={handleSale} itemName={saleTarget?.product_name ?? ""} />
        <SupplierReturnDialog open={!!returnTarget} onClose={() => setReturnTarget(null)} onSaved={() => { setReturnTarget(null); onRefresh(); }} preselectedItemId={returnTarget?.id} />

        {linkedReturn && (
          <SupplierReturnDetailPanel
            open={!!linkedReturn}
            onClose={() => setLinkedReturn(null)}
            onUpdated={() => { setLinkedReturn(null); onRefresh(); }}
            supplierReturn={linkedReturn.supplierReturn as Parameters<typeof SupplierReturnDetailPanel>[0]["supplierReturn"]}
            items={linkedReturn.items as Parameters<typeof SupplierReturnDetailPanel>[0]["items"]}
          />
        )}

        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>מחיקת פריט</AlertDialogTitle>
              <AlertDialogDescription>האם למחוק לצמיתות את <strong>{deleteTarget?.product_name}</strong>? לא ניתן לשחזר.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row-reverse gap-2">
              <AlertDialogCancel>ביטול</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {deleting ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}מחק
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
