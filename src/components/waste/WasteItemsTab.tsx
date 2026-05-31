import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { ColContextMenu, useColMenu, colThContextMenu, trContextMenu } from "@/components/ui/ColContextMenu";
import { DispositionBadge } from "./DispositionBadge";
import { DestroyDialog } from "./DestroyDialog";
import { SaleDialog } from "./SaleDialog";
import { SupplierReturnDialog } from "./SupplierReturnDialog";
import { SupplierReturnDetailPanel } from "./SupplierReturnDetailPanel";
import { PhotoCaptureButton } from "@/components/ui/PhotoCaptureButton";
import {
  Recycle,
  Plus,
  Trash2,
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
};

const COLUMN_DEFS = [
  { id: "employee", label: "עובד", sortField: "created_by_name" },
  { id: "product", label: "מוצר", sortField: "product_name" },
  { id: "sku", label: 'מק"ט' },
  { id: "quantity", label: "כמות", sortField: "quantity" },
  { id: "in_use", label: "בשימוש" },
  { id: "recommendations", label: "המלצות" },
  { id: "disposition", label: "פינוי" },
  { id: "photo", label: "תמונה" },
] as const;

type SortField = "created_by_name" | "product_name" | "quantity";
type SortDir = "asc" | "desc";

interface Props {
  products: Array<{ id: string; name: string; sku: string; components?: Array<{ id: string; name: string; sku: string }> }>;
}

export function WasteItemsTab({ products }: Props) {
  const { currentUser } = useAuth();
  const { isScoped, scopedProductNames } = useProductScope();
  const { hasEdit, isManager } = usePermissions("waste");
  const isMobile = useIsMobile();

  const [items, setItems] = useState<WasteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRow, setEditingRow] = useState<EditingRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [filterDisposition, setFilterDisposition] = useState("all");
  const [sortField, setSortField] = useState<SortField>("product_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Disposition dialogs
  const [destroyTarget, setDestroyTarget] = useState<WasteItem | null>(null);
  const [saleTarget, setSaleTarget] = useState<WasteItem | null>(null);
  const [returnTarget, setReturnTarget] = useState<WasteItem | null>(null);
  const [linkedReturn, setLinkedReturn] = useState<{ id: string; supplierReturn: unknown; items: unknown[] } | null>(null);

  const { isVisible, hide, show, hiddenCols, visibleCount } = useColumnVisibility(
    "waste-items:hidden-columns",
    COLUMN_DEFS,
    isManager ? [] : ["employee"]
  );
  const { menu: colMenu, setMenu: setColMenu, closeMenu } = useColMenu();

  const saveSort = (field: string, dir: SortDir) => {
    setSortField(field as SortField);
    setSortDir(dir);
  };
  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field as SortField); setSortDir("asc"); }
  };
  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <span className="text-muted-foreground/30 text-xs">↕</span>;
    return <span className="text-xs">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  const productOptions = useMemo(
    () => products.map((p) => ({ value: p.name, label: p.name })),
    [products]
  );
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

  const refreshItems = useCallback(async () => {
    let query = supabase.from("waste_items").select("*").order("created_at", { ascending: false });
    if (!isManager && currentUser) query = query.eq("created_by", currentUser.id);
    const { data, error } = await query;
    if (error) { logger.error("Error fetching waste items", error); return; }
    setItems((data as WasteItem[]) || []);
  }, [isManager, currentUser]);

  useEffect(() => {
    (async () => { await refreshItems(); setLoading(false); })();
  }, [refreshItems]);

  const handleBadgeClick = async (e: React.MouseEvent, item: WasteItem) => {
    if (!item.supplier_return_id) return;
    e.stopPropagation();
    const [{ data: ret }, { data: retItems }] = await Promise.all([
      supabase.from("supplier_returns").select("*, suppliers(name)").eq("id", item.supplier_return_id).single(),
      supabase.from("waste_items").select("id, product_name, sku, quantity").eq("supplier_return_id", item.supplier_return_id),
    ]);
    if (ret) setLinkedReturn({ id: ret.id, supplierReturn: ret, items: retItems ?? [] });
  };

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
        item.recommendations.toLowerCase().includes(q)
      );
    }
    if (isManager && filterEmployee !== "all") filtered = filtered.filter((item) => item.created_by === filterEmployee);
    if (filterDisposition !== "all") {
      if (filterDisposition === "ממתין") filtered = filtered.filter((i) => !i.disposition_type);
      else filtered = filtered.filter((i) => i.disposition_type === filterDisposition);
    }
    return [...filtered].sort((a, b) => {
      let av = "", bv = "";
      if (sortField === "product_name") { av = a.product_name; bv = b.product_name; }
      else if (sortField === "quantity") { return sortDir === "asc" ? a.quantity - b.quantity : b.quantity - a.quantity; }
      else if (sortField === "created_by_name") { av = a.created_by_name ?? ""; bv = b.created_by_name ?? ""; }
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [items, search, filterEmployee, filterDisposition, isManager, isScoped, scopedProductNames, sortField, sortDir]);

  const summaryStats = useMemo(() => {
    const total = items.length;
    const inUse = items.filter((i) => i.in_use).length;
    const notInUse = total - inUse;
    const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);
    const pending = items.filter((i) => !i.disposition_type).length;
    return { total, inUse, notInUse, totalQuantity, pending };
  }, [items]);

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
          created_by: currentUser.id,
          created_by_name: currentUser.name,
        });
        if (error) throw error;
        toast.success("הפריט נוסף בהצלחה");
      }
      setEditingRow(null);
      setDrawerOpen(false);
      await refreshItems();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "שגיאה בשמירת הפריט";
      logger.error("Waste item save error", error);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from("waste_items").delete().eq("id", id);
    if (error) { toast.error("שגיאה במחיקת הפריט"); setDeletingId(null); return; }
    toast.success("הפריט נמחק");
    setDeletingId(null);
    await refreshItems();
  };

  const handleInlineToggle = async (item: WasteItem) => {
    const { error } = await supabase.from("waste_items").update({ in_use: !item.in_use, updated_at: new Date().toISOString() }).eq("id", item.id);
    if (error) { toast.error("שגיאה בעדכון"); return; }
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, in_use: !i.in_use } : i)));
  };

  const handlePhotoSave = async (itemId: string, url: string) => {
    const { error } = await supabase.from("waste_items").update({ photo_url: url }).eq("id", itemId);
    if (error) { toast.error("שגיאה בשמירת תמונה"); return; }
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, photo_url: url } : i)));
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
    await refreshItems();
  };

  const handleSale = async (buyerName: string, price: number | null) => {
    if (!saleTarget) return;
    const { error } = await supabase.from("waste_items").update({
      disposition_type: "מכירה",
      disposition_date: new Date().toISOString(),
      sale_buyer_name: buyerName,
      sale_price: price,
    }).eq("id", saleTarget.id);
    if (error) { toast.error("שגיאה בסימון כמכירה"); return; }
    toast.success("הפריט סומן כנמכר");
    setSaleTarget(null);
    await refreshItems();
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
    });
    if (isMobile) setDrawerOpen(true);
  };

  const openNewItemDrawer = () => {
    setEditingRow({ ...emptyRow });
    if (isMobile) setDrawerOpen(true);
  };

  const handleDrawerClose = (open: boolean) => {
    if (!open) { setDrawerOpen(false); setEditingRow(null); }
  };

  // Source toggle component used in both new & edit rows
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ──── MOBILE ────
  if (isMobile) {
    return (
      <div className="flex flex-col min-h-[calc(100dvh-12rem)] pb-24">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Package className="h-3 w-3" />{summaryStats.total} פריטים</span>
              <span className="flex items-center gap-1 text-green-600"><PackageCheck className="h-3 w-3" />{summaryStats.inUse} בשימוש</span>
              <span className="flex items-center gap-1 text-orange-500"><PackageX className="h-3 w-3" />{summaryStats.notInUse} לא בשימוש</span>
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => { setShowSearch(!showSearch); if (!showSearch) setTimeout(() => searchInputRef.current?.focus(), 100); else setSearch(""); }}>
              {showSearch ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {isManager && employees.length > 0 && (
            <select value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)}
              className="mt-2 w-full h-10 rounded-xl border border-input bg-background px-3 text-sm">
              <option value="all">כל העובדים</option>
              {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
            </select>
          )}

          {showSearch && (
            <div className="mt-3 animate-in slide-in-from-top-2 duration-200">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input ref={searchInputRef} placeholder="חיפוש מוצר, מק״ט, המלצה..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10 h-10 rounded-xl bg-muted/50" />
                {search && <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2"><X className="h-4 w-4 text-muted-foreground" /></button>}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 px-4 pt-3 space-y-3">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 bg-muted/30 rounded-full mb-4"><Recycle className="h-12 w-12 text-muted-foreground/30" /></div>
              <p className="text-base font-medium text-muted-foreground mb-1">{search ? "לא נמצאו תוצאות" : "אין פריטי בלאי"}</p>
              <p className="text-sm text-muted-foreground/60">{search ? "נסו לחפש עם מילות מפתח אחרות" : hasEdit ? 'לחצו על "+" כדי להוסיף פריט ראשון' : "לא נוספו פריטים עדיין"}</p>
            </div>
          ) : filteredItems.map((item) => (
            <Card key={item.id} className={`overflow-hidden transition-all duration-200 active:scale-[0.98] ${deletingId === item.id ? "opacity-50 scale-95" : ""}`}>
              <CardContent className="p-0">
                <div className="flex items-start justify-between p-3.5 pb-2 cursor-pointer" onClick={() => hasEdit && startEdit(item)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-base truncate">{item.product_name}</h3>
                      {hasEdit && <Pencil className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />}
                    </div>
                    {isManager && item.created_by_name && <p className="text-xs text-muted-foreground">{item.created_by_name}</p>}
                    {item.sku && <p className="text-xs text-muted-foreground font-mono flex items-center gap-1"><Hash className="h-3 w-3" />{item.sku}</p>}
                    <div className="mt-1">
                      {item.disposition_type === "החזרה לספק" ? (
                        <button className="cursor-pointer hover:opacity-80 transition-opacity" onClick={(e) => handleBadgeClick(e, item)}>
                          <DispositionBadge disposition={item.disposition_type as never} />
                        </button>
                      ) : (
                        <DispositionBadge disposition={item.disposition_type as never} />
                      )}
                    </div>
                  </div>
                  <Badge variant={item.in_use ? "default" : "secondary"} className={`flex-shrink-0 text-xs ${item.in_use ? "bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400" : "bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400"}`}>
                    {item.in_use ? "בשימוש" : "לא בשימוש"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between px-3.5 pb-3 gap-3">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Box className="h-3.5 w-3.5" /><span className="font-medium text-foreground">{item.quantity}</span> יח׳</span>
                    {item.recommendations && <span className="flex items-center gap-1.5 truncate max-w-[160px]"><MessageSquare className="h-3.5 w-3.5 flex-shrink-0" /><span className="truncate">{item.recommendations}</span></span>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <PhotoCaptureButton imageUrl={item.photo_url} storagePath={`waste-items/${item.id}`} onSave={(url) => handlePhotoSave(item.id, url)} disabled={!hasEdit} />
                    {hasEdit && (
                      <>
                        <div className="flex items-center gap-1.5">
                          <Checkbox checked={item.in_use} onCheckedChange={() => handleInlineToggle(item)} />
                          <span className="text-xs text-muted-foreground">{item.in_use ? "כן" : "לא"}</span>
                        </div>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground/50 hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {hasEdit && (
          <button onClick={openNewItemDrawer} className="fixed bottom-[max(6rem,calc(env(safe-area-inset-bottom)+5rem))] left-5 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 flex items-center justify-center active:scale-90 transition-transform duration-150 hover:shadow-xl">
            <Plus className="h-7 w-7" strokeWidth={2.5} />
          </button>
        )}

        <Drawer open={drawerOpen} onOpenChange={handleDrawerClose}>
          <DrawerContent className="max-h-[92dvh]">
            <DrawerHeader className="text-right pb-2">
              <DrawerTitle className="text-lg">{editingRow?.id ? "עריכת פריט" : "הוספת פריט חדש"}</DrawerTitle>
              <DrawerDescription>{editingRow?.id ? "עדכנו את פרטי הפריט" : "מלאו את הפרטים להוספת פריט בלאי חדש"}</DrawerDescription>
            </DrawerHeader>

            {editingRow && (
              <div className="px-4 space-y-5 overflow-y-auto">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      {editingRow.itemSource === "component" ? <Layers className="h-4 w-4 text-primary" /> : <Package className="h-4 w-4 text-primary" />}
                      {editingRow.itemSource === "component" ? "שם הפריט" : "שם המוצר"}
                    </Label>
                    <SourceToggle source={editingRow.itemSource} onChange={(s) => setEditingRow({ ...editingRow, product_name: "", sku: "", product_id: null, component_id: null, itemSource: s })} />
                  </div>
                  {editingRow.itemSource === "component" ? (
                    <Combobox value={editingRow.product_name} onValueChange={handleComponentSelect} options={componentOptions} placeholder="בחר פריט מוצר..." searchPlaceholder="חיפוש פריט..." emptyText="לא נמצא פריט" allowCustomValue className="h-12 rounded-xl text-base" />
                  ) : (
                    <Combobox value={editingRow.product_name} onValueChange={handleProductSelect} options={productOptions} placeholder="בחר או הקלד שם מוצר..." searchPlaceholder="חיפוש מוצר..." emptyText="לא נמצא מוצר" allowCustomValue className="h-12 rounded-xl text-base" />
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="mobile-sku" className="text-sm font-medium flex items-center gap-2"><Hash className="h-4 w-4 text-primary" />מק״ט</Label>
                    <Input id="mobile-sku" placeholder="XXX-000" value={editingRow.sku} onChange={(e) => setEditingRow({ ...editingRow, sku: e.target.value })} disabled={isProductFromSystem} className="h-12 rounded-xl text-base font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mobile-qty" className="text-sm font-medium flex items-center gap-2"><Box className="h-4 w-4 text-primary" />כמות</Label>
                    <Input id="mobile-qty" type="number" inputMode="numeric" min={0} placeholder="0" value={editingRow.quantity || ""} onChange={(e) => setEditingRow({ ...editingRow, quantity: parseInt(e.target.value) || 0 })} className="h-12 rounded-xl text-base text-center" />
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-xl">
                  <Checkbox id="mobile-inuse" checked={editingRow.in_use} onCheckedChange={(checked) => setEditingRow({ ...editingRow, in_use: !!checked })} />
                  <Label htmlFor="mobile-inuse" className="text-sm font-medium flex items-center gap-2 cursor-pointer"><ToggleRight className="h-4 w-4 text-primary" />בשימוש</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobile-rec" className="text-sm font-medium flex items-center gap-2"><MessageSquare className="h-4 w-4 text-primary" />המלצות</Label>
                  <Textarea id="mobile-rec" placeholder="המלצה לגבי הפריט..." value={editingRow.recommendations} onChange={(e) => setEditingRow({ ...editingRow, recommendations: e.target.value })} rows={3} className="rounded-xl text-base resize-none" />
                </div>
              </div>
            )}

            <DrawerFooter className="pt-4 pb-6 gap-2">
              <Button onClick={handleSave} disabled={saving || !editingRow?.product_name.trim()} className="h-12 rounded-xl text-base font-medium gap-2">
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                {editingRow?.id ? "עדכון פריט" : "הוספת פריט"}
              </Button>
              <Button variant="ghost" onClick={() => handleDrawerClose(false)} className="h-11 rounded-xl text-base text-muted-foreground">ביטול</Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        {/* Disposition dialogs */}
        <DestroyDialog open={!!destroyTarget} onClose={() => setDestroyTarget(null)} onConfirm={handleDestroy} itemName={destroyTarget?.product_name ?? ""} />
        <SaleDialog open={!!saleTarget} onClose={() => setSaleTarget(null)} onConfirm={handleSale} itemName={saleTarget?.product_name ?? ""} />
        <SupplierReturnDialog open={!!returnTarget} onClose={() => setReturnTarget(null)} onSaved={() => { setReturnTarget(null); refreshItems(); }} preselectedItemId={returnTarget?.id} />

        {linkedReturn && (
          <SupplierReturnDetailPanel
            open={!!linkedReturn}
            onClose={() => setLinkedReturn(null)}
            onUpdated={() => { setLinkedReturn(null); refreshItems(); }}
            supplierReturn={linkedReturn.supplierReturn as Parameters<typeof SupplierReturnDetailPanel>[0]["supplierReturn"]}
            items={linkedReturn.items as Parameters<typeof SupplierReturnDetailPanel>[0]["items"]}
          />
        )}
      </div>
    );
  }

  // ──── DESKTOP ────
  const FIXED_COLS = 1; // actions column
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {isManager ? "תצוגת ניהול - כל הפריטים מכל העובדים" : "תיעוד וניהול פריטי בלאי"}
          </p>
        </div>
        {hasEdit && (
          <Button onClick={() => setEditingRow({ ...emptyRow })} disabled={editingRow !== null} className="gap-2">
            <Plus className="h-4 w-4" />הוסף שורה
          </Button>
        )}
      </div>

      {/* Manager Summary Cards */}
      {isManager && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="p-4 flex items-center gap-3"><div className="p-2 bg-blue-500/10 rounded-lg"><Package className="h-5 w-5 text-blue-500" /></div><div><p className="text-2xl font-bold">{summaryStats.total}</p><p className="text-xs text-muted-foreground">סה"כ פריטים</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><div className="p-2 bg-green-500/10 rounded-lg"><PackageCheck className="h-5 w-5 text-green-500" /></div><div><p className="text-2xl font-bold">{summaryStats.inUse}</p><p className="text-xs text-muted-foreground">בשימוש</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><div className="p-2 bg-orange-500/10 rounded-lg"><PackageX className="h-5 w-5 text-orange-500" /></div><div><p className="text-2xl font-bold">{summaryStats.notInUse}</p><p className="text-xs text-muted-foreground">לא בשימוש</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><div className="p-2 bg-purple-500/10 rounded-lg"><Recycle className="h-5 w-5 text-purple-500" /></div><div><p className="text-2xl font-bold">{summaryStats.totalQuantity}</p><p className="text-xs text-muted-foreground">סה"כ כמות</p></div></CardContent></Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="חיפוש לפי מוצר, מק״ט או המלצה..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
        </div>
        {isManager && employees.length > 0 && (
          <select value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="all">כל העובדים</option>
            {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
          </select>
        )}
        <select value={filterDisposition} onChange={(e) => setFilterDisposition(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">כל הסטטוסים</option>
          <option value="ממתין">ממתין</option>
          <option value="השמדה">השמדה</option>
          <option value="החזרה לספק">החזרה לספק</option>
          <option value="מכירה">מכירה</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b bg-muted/50" onContextMenu={trContextMenu(hiddenCols, setColMenu)}>
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
            {/* New row */}
            {editingRow && editingRow.id === null && (
              <TableRow className="bg-primary/5">
                {isVisible("employee") && isManager && <TableCell className="text-sm text-muted-foreground">{currentUser?.name}</TableCell>}
                {isVisible("product") && (
                  <TableCell>
                    <div className="space-y-1">
                      <SourceToggle source={editingRow.itemSource} onChange={(s) => setEditingRow({ ...editingRow, product_name: "", sku: "", product_id: null, component_id: null, itemSource: s })} />
                      {editingRow.itemSource === "component" ? (
                        <Combobox value={editingRow.product_name} onValueChange={handleComponentSelect} options={componentOptions} placeholder="בחר פריט מוצר..." searchPlaceholder="חיפוש פריט..." emptyText="לא נמצא פריט" allowCustomValue className="h-9" />
                      ) : (
                        <Combobox value={editingRow.product_name} onValueChange={handleProductSelect} options={productOptions} placeholder="בחר או הקלד שם מוצר..." searchPlaceholder="חיפוש מוצר..." emptyText="לא נמצא מוצר" allowCustomValue className="h-9" />
                      )}
                    </div>
                  </TableCell>
                )}
                {isVisible("sku") && <TableCell><Input placeholder="מק״ט" value={editingRow.sku} onChange={(e) => setEditingRow({ ...editingRow, sku: e.target.value })} disabled={isProductFromSystem} className="h-9" /></TableCell>}
                {isVisible("quantity") && <TableCell><Input type="number" min={0} placeholder="0" value={editingRow.quantity || ""} onChange={(e) => setEditingRow({ ...editingRow, quantity: parseInt(e.target.value) || 0 })} className="h-9 w-20 text-center mx-auto" /></TableCell>}
                {isVisible("in_use") && <TableCell className="text-center"><div className="flex items-center justify-center gap-1.5"><Checkbox checked={editingRow.in_use} onCheckedChange={(checked) => setEditingRow({ ...editingRow, in_use: !!checked })} /><span className="text-sm">{editingRow.in_use ? "כן" : "לא"}</span></div></TableCell>}
                {isVisible("recommendations") && <TableCell><Input placeholder="המלצות..." value={editingRow.recommendations} onChange={(e) => setEditingRow({ ...editingRow, recommendations: e.target.value })} className="h-9" /></TableCell>}
                {isVisible("disposition") && <TableCell />}
                {isVisible("photo") && <TableCell className="text-center" />}
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
            {filteredItems.map((item) =>
              editingRow && editingRow.id === item.id ? (
                <TableRow key={item.id} className="bg-primary/5">
                  {isVisible("employee") && isManager && <TableCell className="text-sm">{item.created_by_name}</TableCell>}
                  {isVisible("product") && (
                    <TableCell>
                      <div className="space-y-1">
                        <SourceToggle source={editingRow.itemSource} onChange={(s) => setEditingRow({ ...editingRow, product_name: "", sku: "", product_id: null, component_id: null, itemSource: s })} />
                        {editingRow.itemSource === "component" ? (
                          <Combobox value={editingRow.product_name} onValueChange={handleComponentSelect} options={componentOptions} placeholder="בחר פריט מוצר..." searchPlaceholder="חיפוש פריט..." emptyText="לא נמצא פריט" allowCustomValue className="h-9" />
                        ) : (
                          <Combobox value={editingRow.product_name} onValueChange={handleProductSelect} options={productOptions} placeholder="בחר או הקלד שם מוצר..." searchPlaceholder="חיפוש מוצר..." emptyText="לא נמצא מוצר" allowCustomValue className="h-9" />
                        )}
                      </div>
                    </TableCell>
                  )}
                  {isVisible("sku") && <TableCell><Input value={editingRow.sku} onChange={(e) => setEditingRow({ ...editingRow, sku: e.target.value })} disabled={isProductFromSystem} className="h-9" /></TableCell>}
                  {isVisible("quantity") && <TableCell><Input type="number" min={0} value={editingRow.quantity || ""} onChange={(e) => setEditingRow({ ...editingRow, quantity: parseInt(e.target.value) || 0 })} className="h-9 w-20 text-center mx-auto" /></TableCell>}
                  {isVisible("in_use") && <TableCell className="text-center"><div className="flex items-center justify-center gap-1.5"><Checkbox checked={editingRow.in_use} onCheckedChange={(checked) => setEditingRow({ ...editingRow, in_use: !!checked })} /><span className="text-sm">{editingRow.in_use ? "כן" : "לא"}</span></div></TableCell>}
                  {isVisible("recommendations") && <TableCell><Input value={editingRow.recommendations} onChange={(e) => setEditingRow({ ...editingRow, recommendations: e.target.value })} className="h-9" /></TableCell>}
                  {isVisible("disposition") && <TableCell />}
                  {isVisible("photo") && <TableCell className="text-center"><div className="flex justify-center"><PhotoCaptureButton imageUrl={item.photo_url} storagePath={`waste-items/${item.id}`} onSave={(url) => handlePhotoSave(item.id, url)} /></div></TableCell>}
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
                <TableRow key={item.id} className="group">
                  {isVisible("employee") && isManager && <TableCell className="text-sm font-medium">{item.created_by_name || "—"}</TableCell>}
                  {isVisible("product") && <TableCell className="font-medium">{item.product_name}</TableCell>}
                  {isVisible("sku") && <TableCell className="text-muted-foreground font-mono text-sm">{item.sku || "—"}</TableCell>}
                  {isVisible("quantity") && <TableCell className="text-center font-semibold">{item.quantity}</TableCell>}
                  {isVisible("in_use") && (
                    <TableCell className="text-center">
                      {hasEdit ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <Checkbox checked={item.in_use} onCheckedChange={() => handleInlineToggle(item)} />
                          <span className="text-sm">{item.in_use ? "כן" : "לא"}</span>
                        </div>
                      ) : (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.in_use ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"}`}>
                          {item.in_use ? "כן" : "לא"}
                        </span>
                      )}
                    </TableCell>
                  )}
                  {isVisible("recommendations") && <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{item.recommendations || "—"}</TableCell>}
                  {isVisible("disposition") && (
                    <TableCell>
                      {item.disposition_type === "החזרה לספק" ? (
                        <button className="cursor-pointer hover:opacity-80 transition-opacity" onClick={(e) => handleBadgeClick(e, item)}>
                          <DispositionBadge disposition={item.disposition_type as never} />
                        </button>
                      ) : (
                        <DispositionBadge disposition={item.disposition_type as never} />
                      )}
                    </TableCell>
                  )}
                  {isVisible("photo") && (
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <PhotoCaptureButton imageUrl={item.photo_url} storagePath={`waste-items/${item.id}`} onSave={(url) => handlePhotoSave(item.id, url)} disabled={!hasEdit} />
                      </div>
                    </TableCell>
                  )}
                  {hasEdit && (
                    <TableCell>
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => startEdit(item)} disabled={editingRow !== null}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {!item.disposition_type && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8" disabled={editingRow !== null}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" dir="rtl">
                              <DropdownMenuItem onClick={() => setDestroyTarget(item)} className="text-destructive">
                                <Trash2 className="h-4 w-4 me-2" />
                                השמד
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setReturnTarget(item)}>
                                <PackageX className="h-4 w-4 me-2" />
                                הוסף להחזרה לספק
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setSaleTarget(item)}>
                                <Box className="h-4 w-4 me-2" />
                                סמן כמכירה
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(item.id)} disabled={editingRow !== null}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )
            )}

            {filteredItems.length === 0 && !editingRow && (
              <TableRow>
                <TableCell colSpan={visibleCount + FIXED_COLS} className="text-center py-12 text-muted-foreground">
                  <Recycle className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-lg font-medium mb-1">אין פריטי בלאי</p>
                  <p className="text-sm">{search ? "לא נמצאו תוצאות לחיפוש" : hasEdit ? 'לחץ על "הוסף שורה" כדי להתחיל לתעד בלאי' : "לא נוספו פריטי בלאי עדיין"}</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Disposition dialogs */}
      <DestroyDialog open={!!destroyTarget} onClose={() => setDestroyTarget(null)} onConfirm={handleDestroy} itemName={destroyTarget?.product_name ?? ""} />
      <SaleDialog open={!!saleTarget} onClose={() => setSaleTarget(null)} onConfirm={handleSale} itemName={saleTarget?.product_name ?? ""} />
      <SupplierReturnDialog open={!!returnTarget} onClose={() => setReturnTarget(null)} onSaved={() => { setReturnTarget(null); refreshItems(); }} preselectedItemId={returnTarget?.id} />

      {linkedReturn && (
        <SupplierReturnDetailPanel
          open={!!linkedReturn}
          onClose={() => setLinkedReturn(null)}
          onUpdated={() => { setLinkedReturn(null); refreshItems(); }}
          supplierReturn={linkedReturn.supplierReturn as Parameters<typeof SupplierReturnDetailPanel>[0]["supplierReturn"]}
          items={linkedReturn.items as Parameters<typeof SupplierReturnDetailPanel>[0]["items"]}
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
  );
}
