import { useState, useEffect, useCallback, useMemo, Fragment, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useData, useAuth, categories, type Product } from "@/contexts/AppContext";
import { canSeePrices, isDivisionManager } from "@/lib/permissions";
import { useProductScope } from "@/hooks/useProductScope";
import { useLiveProductMetrics, type ProductMetrics } from "@/hooks/useLiveProductMetrics";
import { usePickupMonthlyAvg } from "@/hooks/usePickupMonthlyAvg";
import { usePersistedState } from "@/hooks/usePersistedState";
import { supabase } from "@/lib/supabase";
import { Search, ChevronDown, ChevronUp, Boxes, Plus, ArrowUpDown, ArrowUp, ArrowDown, Trash2, Eye, Pencil, Truck, ShoppingCart, ClipboardList, Copy, Hash, Table2, LayoutGrid } from "lucide-react";
import { InlineEditCell } from "@/components/orders/InlineEditCell";
import { updateDivisionStock } from "@/components/orders/divisionStockHelpers";
import { BONDED_DIVISIONS, DIVISION_COLORS } from "@/components/equipment/constants";
import { toast } from "sonner";

const ProductTreemapView = lazy(() => import("@/components/products/treemap/ProductTreemapView"));
import { EntityContextMenu, type ContextMenuGroupItem } from "@/components/EntityContextMenu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ProductFormDialog from "@/components/products/ProductFormDialog";
import ProductDeleteDialog from "@/components/products/ProductDeleteDialog";
import { useTablePreferences } from "@/hooks/useTablePreferences";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { ColContextMenu, useColMenu, colThContextMenu, trContextMenu } from "@/components/ui/ColContextMenu";
import { usePermissions } from "@/hooks/usePermissions";
import { QuantityBar } from "@/components/ui/QuantityBar";

type SortKey = "name" | "sku" | "product_type" | "supplier" | "stock_qty" | "incoming_qty" | "purchase_price" | "monthly_order" | "sale_price" | "monthly_sales" | "category" | "lead_time_days" | "monthly_sales_avg" | "division" | "shipping";

const COLUMN_DEFS = [
  { id: "name",           label: "שם מוצר",           sortField: "name" },
  { id: "sku",            label: "מק״ט",               sortField: "sku" },
  { id: "product_type",   label: "סוג",                sortField: "product_type" },
  { id: "supplier",       label: "ספק",                sortField: "supplier" },
  { id: "stock_qty",      label: "מלאי",               sortField: "stock_qty" },
  { id: "incoming_qty",   label: 'עול"ב',              sortField: "incoming_qty" },
  { id: "purchase_price", label: "מחיר רכישה",        sortField: "purchase_price" },
  { id: "monthly_order",  label: "הזמנה חודשית",      sortField: "monthly_order" },
  { id: "sale_price",     label: "מחיר מכירה",        sortField: "sale_price" },
  { id: "monthly_sales",     label: "מכירות חודשיות (לפי הצטיידות)", sortField: "monthly_sales" },
  { id: "category",          label: "קטגוריה",                       sortField: "category" },
  { id: "lead_time_days",    label: "זמן אספקה (ימים)",              sortField: "lead_time_days" },
  { id: "monthly_sales_avg", label: "ממוצע צריכה שנתי (SAP)",        sortField: "monthly_sales_avg" },
  { id: "division",          label: "חטיבות",                        sortField: "division" },
  { id: "shipping",          label: "שיטת משלוח",                    sortField: "shipping" },
] as const;

function CompositeIncomingBadge({ m }: { m: ProductMetrics | undefined }) {
  if (!m?.compositeIncoming) return <span className="text-muted-foreground">—</span>;
  const { matched, total, minUnits } = m.compositeIncoming;
  if (total === 0) return <span className="text-muted-foreground">—</span>;
  if (matched === 0) return <span className="text-muted-foreground">—</span>;
  if (minUnits != null && minUnits > 0) {
    return (
      <span className="text-foreground font-medium">
        {minUnits}{" "}
        <span className="text-xs text-muted-foreground font-normal">יח׳</span>
      </span>
    );
  }
  if (matched > 0) {
    return (
      <span className="text-xs text-muted-foreground">
        {matched}/{total} רכיבים
      </span>
    );
  }
  return <span className="text-muted-foreground">—</span>;
}

export default function ProductsPage() {
  const { suppliers, deleteProduct, updateProduct } = useData();
  const { scopedProducts: products } = useProductScope();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = usePersistedState<"table" | "treemap">("products-view-mode", "table");
  const [category, setCategory] = useState("הכל");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Division stock state
  interface DivStockEntry { division: string; stock: number; dpId: string }
  const [divStockByProduct, setDivStockByProduct] = useState<Map<string, DivStockEntry[]>>(new Map());
  const [expandedStockId, setExpandedStockId] = useState<string | null>(null);

  const prefs = useTablePreferences("ProductsPage", {
    sortField: "name",
    filters: { category: "הכל", typeFilter: "all", supplierFilter: "all" },
  });
  const { currentUser } = useAuth();
  const divManager = isDivisionManager(currentUser);
  const userDivision = currentUser?.division ?? "";
  const isBondedDivMgr = divManager && BONDED_DIVISIONS.has(userDivision);

  const fetchDivisionStock = useCallback(async () => {
    let q = supabase.from("division_products").select("id, division, product_id, division_stock");
    if (divManager && userDivision) q = q.eq("division", userDivision);
    const { data } = await q;
    const map = new Map<string, DivStockEntry[]>();
    for (const r of (data ?? []) as { id: string; division: string; product_id: string; division_stock: number }[]) {
      const list = map.get(r.product_id) ?? [];
      list.push({ division: r.division, stock: r.division_stock ?? 0, dpId: r.id });
      map.set(r.product_id, list);
    }
    setDivStockByProduct(map);
  }, [divManager, userDivision]);

  useEffect(() => { fetchDivisionStock(); }, [fetchDivisionStock]);
  const showPrices = canSeePrices(currentUser);
  const colVis = useColumnVisibility(
    "products:hidden-columns",
    COLUMN_DEFS,
    ["sale_price", "monthly_sales", "category", "lead_time_days", "monthly_sales_avg", "division", "shipping"]
  );
  const PRICE_COLS = new Set(["purchase_price", "sale_price"]);
  const isVisible = (id: string) => !showPrices && PRICE_COLS.has(id) ? false : colVis.isVisible(id);
  const { hide, show, hiddenCols } = colVis;
  const visibleCount = COLUMN_DEFS.filter(c => isVisible(c.id)).length;
  const { menu: colMenu, setMenu: setColMenu, closeMenu } = useColMenu();
  const { metrics } = useLiveProductMetrics(products);
  const { avgByProduct } = usePickupMonthlyAvg();

  const { hasEdit } = usePermissions("products");
  // If a stored sort preference points to a hidden price column, fall
  // back to "name" so non-managers don't sort by an invisible field.
  const rawSortKey = prefs.sortField as SortKey | null;
  const sortKey: SortKey | null = !showPrices && rawSortKey && PRICE_COLS.has(rawSortKey)
    ? "name"
    : rawSortKey;
  const sortDir = prefs.sortDir;
  const typeFilter = (prefs.filters.typeFilter || "all") as "all" | "מוגמר" | "מורכב";
  const supplierFilter = prefs.filters.supplierFilter || "all";

  const filtered = useMemo(() => {
    let result = products.filter(p => {
      if (category !== "הכל" && p.category !== category) return false;
      if (typeFilter !== "all" && p.product_type !== typeFilter) return false;
      if (supplierFilter !== "all" && p.supplier !== supplierFilter) return false;
      if (search && !p.name.includes(search) && !p.sku.includes(search) && !(p.notes || "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

    if (sortKey) {
      result = [...result].sort((a, b) => {
        const av = a[sortKey as keyof Product];
        const bv = b[sortKey as keyof Product];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        const cmp = typeof av === "number" ? av - Number(bv) : String(av).localeCompare(String(bv), "he");
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [products, category, typeFilter, supplierFilter, search, sortKey, sortDir]);

  const uniqueSuppliers = useMemo(() => {
    const set = new Set(products.map(p => p.supplier).filter(Boolean) as string[]);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "he"));
  }, [products]);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const openDeleteDialog = (product: Product, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeleteTarget({ id: product.id, name: product.name });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProduct(deleteTarget.id);
    } finally {
      setDeleteTarget(null);
    }
  };

  const toggleExpand = (id: string) => setExpandedId(prev => prev === id ? null : id);
  const openAdd = () => { setEditProduct(null); setFormOpen(true); };

  const navigateToSupplier = (supplierName: string) => {
    const s = suppliers.find(s => s.company === supplierName);
    if (s) navigate(`/suppliers/${s.id}`);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">מוצרים</h1>
          <div className="flex bg-secondary rounded-lg p-1">
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "table" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              title="תצוגת טבלה"
            >
              <Table2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("treemap")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "treemap" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              title="מפת מוצרים"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
        {hasEdit && <Button onClick={openAdd}><Plus className="h-4 w-4 ml-2" />מוצר חדש</Button>}
      </div>

      {viewMode === "treemap" ? (
        <Suspense fallback={<div className="h-96 flex items-center justify-center text-muted-foreground">טוען מפת מוצרים...</div>}>
          <ProductTreemapView />
        </Suspense>
      ) : (
      <>
      <div className="overflow-x-auto pb-1 -mx-1 px-1">
        <div className="flex gap-1.5 min-w-max">
          {categories.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              category === cat ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}>{cat}</button>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 sm:items-center">
        <div className="flex bg-secondary rounded-lg p-1 self-start">
          {(["all", "מוגמר", "מורכב"] as const).map(t => (
            <button key={t} onClick={() => prefs.setFilter("typeFilter", t)} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              typeFilter === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}>{t === "all" ? "הכל" : t}</button>
          ))}
        </div>
        <Select value={supplierFilter} onValueChange={(v) => prefs.setFilter("supplierFilter", v)}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="ספק" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הספקים</SelectItem>
            {uniqueSuppliers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="חיפוש לפי שם או מק״ט..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
        </div>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Boxes className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">לא נמצאו מוצרים</p>
            <p className="text-xs text-muted-foreground">נסה לחפש מונח אחר או לנקות את הסינון</p>
          </div>
        ) : filtered.map(p => {
          const isComposite = p.product_type === "מורכב";
          const isExpanded = expandedId === p.id;
          const hasComponents = isComposite && p.components && p.components.length > 0;
          return (
            <div key={p.id} className="bg-card rounded-xl border shadow-sm overflow-hidden">
              <div
                className="p-4 cursor-pointer"
                onClick={() => isComposite ? toggleExpand(p.id) : navigate(`/products/${p.id}`)}
                data-navigate-to={!isComposite ? `/products/${p.id}` : undefined}
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    {p.end_product_image ? (
                      <img src={p.end_product_image} alt={p.name} className="h-10 w-10 rounded object-cover" />
                    ) : isComposite ? (
                      <div className="h-10 w-10 rounded bg-accent/10 flex items-center justify-center">
                        <Boxes className="h-5 w-5 text-accent" />
                      </div>
                    ) : <div className="h-10 w-10" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground leading-tight truncate">{p.name}</p>
                    {p.sku && <p className="text-xs text-muted-foreground font-mono mt-0.5" dir="ltr">{p.sku}</p>}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${isComposite ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"}`}>
                        {p.product_type}
                      </span>
                      {p.supplier && (
                        <button
                          onClick={e => { e.stopPropagation(); navigateToSupplier(p.supplier!); }}
                          className="text-xs text-primary hover:underline"
                        >{p.supplier}</button>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1">
                      {isComposite && (
                        <span className="text-muted-foreground">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </span>
                      )}
                      {hasEdit && (
                        <button onClick={e => openDeleteDialog(p, e)} className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </button>
                      )}
                    </div>
                    <div className="w-20" onClick={e => e.stopPropagation()}>
                      {divManager ? (
                        <InlineEditCell
                          value={divStockByProduct.get(p.id)?.find(d => d.division === userDivision)?.stock ?? 0}
                          type="number"
                          onCommit={async (val) => {
                            const res = await updateDivisionStock(userDivision, p.id, val as number | null);
                            if (res.ok) { toast.success("מלאי עודכן"); fetchDivisionStock(); }
                            else toast.error(res.error ?? "שגיאה בעדכון");
                          }}
                        />
                      ) : (
                        <QuantityBar
                          value={(() => {
                            const divEntries = divStockByProduct.get(p.id);
                            const divTotal = divEntries ? divEntries.reduce((s, d) => s + d.stock, 0) : 0;
                            return p.stock_qty + divTotal;
                          })()}
                          min={p.reorder_point ?? 0}
                          max={p.monthly_order ?? 0}
                          onMinChange={v => updateProduct(p.id, { reorder_point: v })}
                          onMaxChange={v => updateProduct(p.id, { monthly_order: v })}
                        />
                      )}
                      {(metrics[p.id]?.incomingQty ?? 0) > 0 && (
                        <span className="text-xs text-muted-foreground">+{metrics[p.id]?.incomingQty} עול"ב</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">מלאי</span>
                  </div>
                </div>
              </div>

              {isExpanded && hasComponents && (
                <div className="border-t bg-muted/30 px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Boxes className="h-3.5 w-3.5 text-accent" />
                      רכיבים ({p.components!.length})
                    </span>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => navigate(`/products/${p.id}`)}>
                      פתח תיק מוצר
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    {p.components!.map(comp => (
                      <div key={comp.id} className="bg-card/70 rounded-lg px-3 py-2 text-xs">
                        <span className="font-medium text-foreground">{comp.name}</span>
                        <div className="flex flex-wrap gap-2 mt-0.5 text-muted-foreground">
                          {comp.supplier && (
                            <span>
                              <span className="text-muted-foreground/60">ספק: </span>
                              <button onClick={() => navigateToSupplier(comp.supplier!)} className="text-primary hover:underline">{comp.supplier}</button>
                            </span>
                          )}
                          {comp.stock_qty != null && <span><span className="text-muted-foreground/60">מלאי: </span>{comp.stock_qty}</span>}
                          {comp.notes && <span className="truncate max-w-[200px]">💡 {comp.notes}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {isExpanded && isComposite && !hasComponents && (
                <div className="border-t bg-muted/30 px-4 py-4 text-center text-xs text-muted-foreground">
                  לא הוגדרו רכיבים למוצר זה
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-card rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b bg-muted/50" onContextMenu={trContextMenu(hiddenCols, setColMenu)}>
              <th className="text-right p-2 sm:p-3 font-semibold text-foreground w-8"></th>
              {COLUMN_DEFS.map(col => isVisible(col.id) ? (
                <th key={col.id} className="text-right p-2 sm:p-3 font-semibold text-foreground" onContextMenu={colThContextMenu(col, setColMenu)}>
                  <button onClick={() => prefs.toggleSort(col.sortField)} className="flex items-center gap-1 hover:text-accent transition-colors">
                    {col.label}
                    <SortIcon col={col.sortField} />
                  </button>
                </th>
              ) : null)}
              {hasEdit && <th className="text-right p-2 sm:p-3 font-semibold text-foreground w-10"></th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr><td colSpan={1 + visibleCount + (hasEdit ? 1 : 0)} className="py-16 text-center">
                <div className="flex flex-col items-center gap-2">
                  <Boxes className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">לא נמצאו מוצרים</p>
                </div>
              </td></tr>
            ) : filtered.map(p => {
              const isComposite = p.product_type === "מורכב";
              const isExpanded = expandedId === p.id;
              const hasComponents = isComposite && p.components && p.components.length > 0;

              const productMenuGroups: ContextMenuGroupItem[][] = [
                [
                  { label: "צפה במוצר", icon: Eye, onClick: () => navigate(`/products/${p.id}`) },
                  ...(p.supplier ? [{ label: `עבור לספק: ${p.supplier}`, icon: Truck, onClick: () => navigateToSupplier(p.supplier!) }] : []),
                  { label: "הזמנות המוצר", icon: ClipboardList, onClick: () => navigate(`/orders?q=${encodeURIComponent(p.name)}`) },
                ],
                [
                  { label: "ערוך מוצר", icon: Pencil, onClick: () => { setEditProduct(p); setFormOpen(true); }, hidden: !hasEdit },
                  { label: "צור הזמנה", icon: ShoppingCart, onClick: () => navigate(`/orders?newOrder=true&productId=${p.id}`), hidden: !hasEdit },
                ],
                [
                  { label: "העתק שם", icon: Copy, onClick: () => { navigator.clipboard.writeText(p.name); toast.success("השם הועתק"); } },
                  { label: "העתק מקט", icon: Hash, onClick: () => { navigator.clipboard.writeText(p.sku); toast.success("המקט הועתק"); }, hidden: !p.sku },
                ],
                [
                  { label: "מחק מוצר", icon: Trash2, onClick: () => openDeleteDialog(p), variant: "destructive" as const, hidden: !hasEdit },
                ],
              ];

              return (
                <Fragment key={p.id}>
                  <EntityContextMenu groups={productMenuGroups}>
                  <tr
                    className="group cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={(e) => { if (e.detail !== 1) return; if (isComposite) { toggleExpand(p.id); } else { navigate(`/products/${p.id}`); } }}
                    onDoubleClick={() => isComposite && navigate(`/products/${p.id}`)}
                    data-navigate-to={`/products/${p.id}`}
                  >
                    <td className="p-2 sm:p-3 text-center">
                      {isComposite && (
                        <span className="text-muted-foreground">
                          {isExpanded ? <ChevronUp className="h-4 w-4 inline" /> : <ChevronDown className="h-4 w-4 inline" />}
                        </span>
                      )}
                    </td>
                    {isVisible("name") && (
                      <td className="p-2 sm:p-3 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          {p.end_product_image ? (
                            <img src={p.end_product_image} alt={p.name} className="h-8 w-8 rounded object-cover shrink-0" />
                          ) : isComposite ? (
                            <Boxes className="h-3.5 w-3.5 text-accent shrink-0" />
                          ) : null}
                          {p.name}
                        </div>
                      </td>
                    )}
                    {isVisible("sku") && <td className="p-2 sm:p-3 text-muted-foreground font-mono text-xs" dir="ltr">{p.sku}</td>}
                    {isVisible("product_type") && (
                      <td className="p-2 sm:p-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          isComposite ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"
                        }`}>{p.product_type}</span>
                      </td>
                    )}
                    {isVisible("supplier") && (
                      <td className="p-2 sm:p-3">
                        {p.supplier ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); navigateToSupplier(p.supplier!); }}
                            className="text-primary hover:underline text-sm"
                          >
                            {p.supplier}
                          </button>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                    )}
                    {isVisible("stock_qty") && (
                      <td className="p-2 sm:p-3" onClick={e => e.stopPropagation()}>
                        {divManager ? (
                          <InlineEditCell
                            value={divStockByProduct.get(p.id)?.find(d => d.division === userDivision)?.stock ?? 0}
                            type="number"
                            onCommit={async (val) => {
                              const res = await updateDivisionStock(userDivision, p.id, val as number | null);
                              if (res.ok) { toast.success("מלאי עודכן"); fetchDivisionStock(); }
                              else toast.error(res.error ?? "שגיאה בעדכון");
                            }}
                          />
                        ) : (
                          <div>
                            <QuantityBar
                              value={(() => {
                                const divEntries = divStockByProduct.get(p.id);
                                const divTotal = divEntries ? divEntries.reduce((s, d) => s + d.stock, 0) : 0;
                                return p.stock_qty + divTotal;
                              })()}
                              min={p.reorder_point ?? 0}
                              max={p.monthly_order ?? 0}
                              onMinChange={v => updateProduct(p.id, { reorder_point: v })}
                              onMaxChange={v => updateProduct(p.id, { monthly_order: v })}
                              className="min-w-[80px]"
                            />
                            {(divStockByProduct.get(p.id)?.length ?? 0) > 0 && (
                              <>
                                <button
                                  onClick={() => setExpandedStockId(prev => prev === p.id ? null : p.id)}
                                  className="text-[10px] text-muted-foreground hover:text-foreground mt-0.5 flex items-center gap-0.5"
                                >
                                  {expandedStockId === p.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                  פירוט ({p.stock_qty} מרכזי)
                                </button>
                                {expandedStockId === p.id && (
                                  <div className="mt-1 space-y-0.5">
                                    <div className="flex justify-between text-[10px] text-muted-foreground">
                                      <span>מרכז לוגיסטי</span>
                                      <span className="font-medium text-foreground">{p.stock_qty}</span>
                                    </div>
                                    {divStockByProduct.get(p.id)!.map(d => (
                                      <div key={d.division} className="flex justify-between items-center text-[10px]">
                                        <span className="text-muted-foreground">{d.division}</span>
                                        <InlineEditCell
                                          value={d.stock}
                                          type="number"
                                          className="!text-[10px] !min-h-[20px] !py-0 max-w-[60px]"
                                          onCommit={async (val) => {
                                            const res = await updateDivisionStock(d.division, p.id, val as number | null);
                                            if (res.ok) fetchDivisionStock();
                                            else toast.error(res.error ?? "שגיאה");
                                          }}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                    {isVisible("incoming_qty") && (
                      <td className="p-2 sm:p-3">
                        {isComposite ? (
                          <CompositeIncomingBadge m={metrics[p.id]} />
                        ) : (
                          <span className={metrics[p.id]?.incomingQty ? "text-foreground font-medium" : "text-muted-foreground"}>
                            {metrics[p.id]?.incomingQty || "—"}
                          </span>
                        )}
                      </td>
                    )}
                    {isVisible("purchase_price") && (
                      <td className="p-2 sm:p-3 text-muted-foreground">
                        {(() => {
                          const pp = metrics[p.id]?.purchasePrice ?? p.purchase_price;
                          if (!pp) return "—";
                          const formatted = `$${pp.toLocaleString()}`;
                          if (isComposite) {
                            return (
                              <span title="מחושב מסכום רכיבים">
                                {formatted}{" "}
                                <span className="text-xs opacity-50">(רכיבים)</span>
                              </span>
                            );
                          }
                          return formatted;
                        })()}
                      </td>
                    )}
                    {isVisible("monthly_order") && <td className="p-2 sm:p-3 text-muted-foreground">{p.monthly_order || "—"}</td>}
                    {isVisible("sale_price") && (
                      <td className="p-2 sm:p-3 text-muted-foreground">
                        {p.sale_price ? `$${p.sale_price.toLocaleString()}` : "—"}
                      </td>
                    )}
                    {isVisible("monthly_sales") && <td className="p-2 sm:p-3 text-muted-foreground">{avgByProduct.get(p.id) ?? "—"}</td>}
                    {isVisible("category") && <td className="p-2 sm:p-3 text-muted-foreground">{p.category || "—"}</td>}
                    {isVisible("lead_time_days") && <td className="p-2 sm:p-3 text-muted-foreground">{p.lead_time_days ?? "—"}</td>}
                    {isVisible("monthly_sales_avg") && <td className="p-2 sm:p-3 text-muted-foreground">{p.monthly_sales_avg ?? avgByProduct.get(p.id) ?? "—"}</td>}
                    {isVisible("division") && <td className="p-2 sm:p-3 text-muted-foreground">{p.division || "—"}</td>}
                    {isVisible("shipping") && <td className="p-2 sm:p-3 text-muted-foreground">{p.shipping || "—"}</td>}
                    {hasEdit && (
                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        <button onClick={e => openDeleteDialog(p, e)} className="p-1 rounded hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      </td>
                    )}
                  </tr>
                  </EntityContextMenu>

                  {/* Expanded components */}
                  {isExpanded && hasComponents && (
                    <tr>
                      <td colSpan={visibleCount + 1 + (hasEdit ? 1 : 0)} className="p-0">
                        <div className="bg-muted/30 border-t border-b px-6 py-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Boxes className="h-4 w-4 text-accent" />
                              <span className="text-xs font-semibold text-foreground">רכיבים ({p.components!.length})</span>
                            </div>
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); navigate(`/products/${p.id}`); }}>
                              פתח תיק מוצר
                            </Button>
                          </div>
                          <div className="grid gap-1.5">
                            {p.components!.map(comp => (
                              <div key={comp.id} className="flex flex-wrap items-center gap-2 sm:gap-4 bg-card/70 rounded-lg px-3 py-2 text-xs">
                                <span className="font-medium text-foreground min-w-[120px] sm:min-w-[180px]">{comp.name}</span>
                                <span className="text-muted-foreground">
                                  <span className="text-muted-foreground/60">ספק: </span>
                                  {comp.supplier ? (
                                    <button onClick={() => navigateToSupplier(comp.supplier!)} data-navigate-to={`/suppliers/${comp.supplier}`} className="text-primary hover:underline">{comp.supplier}</button>
                                  ) : "—"}
                                </span>
                                {comp.stock_qty != null && (
                                  <span className="text-muted-foreground">
                                    <span className="text-muted-foreground/60">מלאי: </span>
                                    {comp.stock_qty}
                                  </span>
                                )}
                                {(() => {
                                  if (!comp.sku) return null;
                                  const compProduct = products.find(q => q.sku === comp.sku);
                                  if (!compProduct) return null;
                                  const inc = metrics[compProduct.id]?.incomingQty;
                                  if (!inc) return null;
                                  return (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                      <span className="text-muted-foreground/60 font-normal">עול"ב: </span>
                                      {inc}
                                    </span>
                                  );
                                })()}
                                {comp.notes && (
                                  <span className="text-muted-foreground/70 truncate max-w-[250px]">
                                    💡 {comp.notes}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  {isExpanded && isComposite && !hasComponents && (
                    <tr>
                      <td colSpan={visibleCount + 1 + (hasEdit ? 1 : 0)} className="p-0">
                        <div className="bg-muted/30 border-t border-b px-6 py-4 text-center text-xs text-muted-foreground">
                          לא הוגדרו רכיבים למוצר זה
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* end desktop table */}

      {colMenu && (
        <ColContextMenu
          menu={colMenu}
          sortField={sortKey}
          sortDir={sortDir}
          hiddenCols={hiddenCols}
          onClose={closeMenu}
          onHide={hide}
          onShow={show}
          onSortAsc={field => prefs.savePreferences({ sortField: field, sortDir: "asc" })}
          onSortDesc={field => prefs.savePreferences({ sortField: field, sortDir: "desc" })}
        />
      )}
      </>
      )}

      <ProductFormDialog open={formOpen} onOpenChange={setFormOpen} editProduct={editProduct} />

      {deleteTarget && (
        <ProductDeleteDialog
          open={!!deleteTarget}
          productId={deleteTarget.id}
          productName={deleteTarget.name}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
