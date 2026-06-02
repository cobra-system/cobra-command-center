import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useData, useAuth } from "@/contexts/AppContext";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Package, Layers, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import ProductFormDialog from "@/components/products/ProductFormDialog";
import { DIVISION_COLORS, BONDED_DIVISIONS } from "@/components/equipment/constants";
import { canEdit } from "@/lib/permissions";
import type { ColDef } from "@/hooks/useColumnVisibility";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import {
  ColContextMenu,
  useColMenu,
  colThContextMenu,
  trContextMenu,
} from "@/components/ui/ColContextMenu";

interface DivisionProduct {
  id: string;
  product_id: string;
  division_stock: number;
  division_stock_updated_at: string | null;
  quarterly_demand: number | null;
  quarterly_demand_updated_at: string | null;
  notes: string | null;
  products: { id: string; name: string; sku: string; category: string };
}

interface DivisionProductItem {
  id: string;
  component_id: string;
  division_stock: number;
  division_stock_updated_at: string | null;
  product_components: {
    id: string;
    name: string;
    sku: string | null;
    product_id: string;
    products: { name: string } | null;
  };
}

const DP_COLS: ColDef[] = [
  { id: "product",          label: "מוצר" },
  { id: "division_stock",   label: "מלאי בשטח",           sortField: "division_stock" },
  { id: "quarterly_demand", label: "דרישה לרבעון",         sortField: "quarterly_demand" },
  { id: "main_stock",       label: "מלאי מרכז לוגיסטי",   sortField: "main_stock" },
  { id: "incoming_qty",     label: 'עול"ב',                sortField: "incoming_qty" },
  { id: "reorder_point",    label: "נקודת הזמנה",          sortField: "reorder_point" },
];

const DPI_COLS: ColDef[] = [
  { id: "item",           label: "פריט" },
  { id: "product",        label: "מוצר" },
  { id: "division_stock", label: "מלאי בשטח", sortField: "division_stock" },
];

function SortIcon({ field, currentField, currentDir }: { field: string; currentField: string | null; currentDir: "asc" | "desc" }) {
  if (currentField !== field) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
  return currentDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

export default function DivisionProductsPage() {
  const { divisionName } = useParams<{ divisionName: string }>();
  const navigate = useNavigate();
  const { products, currentUserPermissions } = useData();
  const { currentUser } = useAuth();

  const division = divisionName ? decodeURIComponent(divisionName) : "";

  useEffect(() => {
    if (division && !BONDED_DIVISIONS.has(division)) {
      navigate(`/equipment/division/${encodeURIComponent(division)}`, { replace: true });
    }
  }, [division, navigate]);

  // ── Products state ──
  const [divisionProducts, setDivisionProducts] = useState<DivisionProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [showNewProduct, setShowNewProduct] = useState(false);

  const [sortField, setSortField] = useState<string | null>("product");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editField, setEditField] = useState<"division_stock" | "quarterly_demand">("division_stock");
  const [editVal, setEditVal] = useState("");
  const [saving, setSaving] = useState(false);

  const colVis = useColumnVisibility(
    "bonded-products:hidden-columns",
    DP_COLS,
    ["main_stock", "incoming_qty", "reorder_point"]
  );
  const { menu, setMenu, closeMenu } = useColMenu();

  // ── Items state ──
  const [divisionItems, setDivisionItems] = useState<DivisionProductItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  const [itemSortField, setItemSortField] = useState<string | null>("item");
  const [itemSortDir, setItemSortDir] = useState<"asc" | "desc">("asc");

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemVal, setEditItemVal] = useState("");
  const [savingItem, setSavingItem] = useState(false);

  const itemColVis = useColumnVisibility("division-product-items:hidden-columns", DPI_COLS, []);
  const { menu: itemMenu, setMenu: setItemMenu, closeMenu: closeItemMenu } = useColMenu();

  // ── Fetch products ──
  const fetchProducts = useCallback(async () => {
    if (!division) return;
    setLoadingProducts(true);
    const { data, error } = await supabase
      .from("division_products")
      .select("id, product_id, division_stock, division_stock_updated_at, quarterly_demand, quarterly_demand_updated_at, notes, products(id, name, sku, category)")
      .eq("division", division);
    if (error) toast.error("שגיאה בטעינת מוצרים");
    setDivisionProducts((data ?? []) as unknown as DivisionProduct[]);
    setLoadingProducts(false);
  }, [division]);

  // ── Fetch items ──
  const fetchItems = useCallback(async () => {
    if (!division) return;
    setLoadingItems(true);
    const { data, error } = await supabase
      .from("division_product_items")
      .select("id, component_id, division_stock, division_stock_updated_at, product_components(id, name, sku, product_id, products(name))")
      .eq("division", division);
    if (error) toast.error("שגיאה בטעינת פריטים");
    setDivisionItems((data ?? []) as unknown as DivisionProductItem[]);
    setLoadingItems(false);
  }, [division]);

  useEffect(() => {
    fetchProducts();
    fetchItems();
  }, [fetchProducts, fetchItems]);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // ── Sorted products ──
  const sortedProducts = useMemo(() => {
    return [...divisionProducts].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortField === "division_stock") return (a.division_stock - b.division_stock) * dir;
      if (sortField === "quarterly_demand") return ((a.quarterly_demand ?? 0) - (b.quarterly_demand ?? 0)) * dir;
      if (sortField === "main_stock") {
        return ((productMap.get(a.product_id)?.stock_qty ?? 0) - (productMap.get(b.product_id)?.stock_qty ?? 0)) * dir;
      }
      if (sortField === "incoming_qty") {
        return ((productMap.get(a.product_id)?.incoming_qty ?? 0) - (productMap.get(b.product_id)?.incoming_qty ?? 0)) * dir;
      }
      if (sortField === "reorder_point") {
        return ((productMap.get(a.product_id)?.reorder_point ?? 0) - (productMap.get(b.product_id)?.reorder_point ?? 0)) * dir;
      }
      return a.products.name.localeCompare(b.products.name, "he") * dir;
    });
  }, [divisionProducts, sortField, sortDir, productMap]);

  // ── Sorted items ──
  const sortedItems = useMemo(() => {
    return [...divisionItems].sort((a, b) => {
      const dir = itemSortDir === "asc" ? 1 : -1;
      if (itemSortField === "division_stock") return (a.division_stock - b.division_stock) * dir;
      if (itemSortField === "product") {
        const an = a.product_components?.products?.name ?? "";
        const bn = b.product_components?.products?.name ?? "";
        return an.localeCompare(bn, "he") * dir;
      }
      return (a.product_components?.name ?? "").localeCompare(b.product_components?.name ?? "", "he") * dir;
    });
  }, [divisionItems, itemSortField, itemSortDir]);

  function toggleSort(field: string) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  }

  function toggleItemSort(field: string) {
    if (itemSortField === field) setItemSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setItemSortField(field); setItemSortDir("asc"); }
  }

  // ── Product CRUD ──
  async function saveField(dpId: string, field: "division_stock" | "quarterly_demand", rawVal: string) {
    const value = parseInt(rawVal) || 0;
    setSaving(true);
    const updates: Record<string, unknown> = { [field]: value };
    if (field === "division_stock") updates.division_stock_updated_at = new Date().toISOString();
    else updates.quarterly_demand_updated_at = new Date().toISOString();
    const { error } = await supabase.from("division_products").update(updates).eq("id", dpId);
    if (error) toast.error("שגיאה בשמירה");
    else setDivisionProducts((prev) =>
      prev.map((dp) => dp.id === dpId ? { ...dp, ...updates } as unknown as DivisionProduct : dp)
    );
    setEditingId(null);
    setSaving(false);
  }

  async function addProduct(productId: string) {
    const { error } = await supabase.from("division_products").insert({ division, product_id: productId });
    if (error) toast.error("שגיאה בהוספת מוצר");
    else { fetchProducts(); toast.success("מוצר נוסף"); }
  }

  async function removeProduct(dpId: string) {
    const { error } = await supabase.from("division_products").delete().eq("id", dpId);
    if (error) toast.error("שגיאה במחיקה");
    else setDivisionProducts((prev) => prev.filter((dp) => dp.id !== dpId));
  }

  // ── Item CRUD ──
  async function saveItemStock(dpiId: string, rawVal: string) {
    const value = parseInt(rawVal) || 0;
    setSavingItem(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("division_product_items")
      .update({ division_stock: value, division_stock_updated_at: now })
      .eq("id", dpiId);
    if (error) toast.error("שגיאה בשמירה");
    else setDivisionItems((prev) =>
      prev.map((i) => i.id === dpiId ? { ...i, division_stock: value, division_stock_updated_at: now } : i)
    );
    setEditingItemId(null);
    setSavingItem(false);
  }

  async function addItem(componentId: string) {
    const { error } = await supabase
      .from("division_product_items")
      .insert({ division, component_id: componentId });
    if (error) toast.error("שגיאה בהוספת פריט");
    else { fetchItems(); toast.success("פריט נוסף"); }
  }

  async function removeItem(dpiId: string) {
    const { error } = await supabase.from("division_product_items").delete().eq("id", dpiId);
    if (error) toast.error("שגיאה במחיקה");
    else setDivisionItems((prev) => prev.filter((i) => i.id !== dpiId));
  }

  const canManage = canEdit(currentUserPermissions, "equipment") || currentUser?.division === division;
  const colorClass = DIVISION_COLORS[division] ?? "border-gray-300 text-gray-700 bg-gray-50";

  // Build combobox options for items (all components not yet added)
  const addedComponentIds = useMemo(() => new Set(divisionItems.map((i) => i.component_id)), [divisionItems]);
  const itemOptions = useMemo(() =>
    products.flatMap((p) =>
      (p.components ?? [])
        .filter((c) => !addedComponentIds.has(c.id))
        .map((c) => ({
          value: c.id,
          label: `${p.name} — ${c.name}${c.sku ? ` · ${c.sku}` : ""}`,
        }))
    ),
    [products, addedComponentIds]
  );

  if (loadingProducts && loadingItems) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 rounded-md" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge className={`text-sm px-3 py-1 border ${colorClass}`}>{division}</Badge>
        <span className="text-muted-foreground text-sm flex items-center gap-1.5">
          <Package className="h-4 w-4" />
          ציוד החטיבה
        </span>
      </div>

      <Tabs defaultValue="products" dir="rtl">
        <TabsList className="mb-4">
          <TabsTrigger value="products" className="flex items-center gap-1.5">
            <Package className="h-4 w-4" />
            מוצרים
          </TabsTrigger>
          <TabsTrigger value="items" className="flex items-center gap-1.5">
            <Layers className="h-4 w-4" />
            פריטים
          </TabsTrigger>
        </TabsList>

        {/* ── Products Tab ── */}
        <TabsContent value="products" className="space-y-4">
          {canManage && (
            <div className="flex gap-2 justify-end flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setShowNewProduct(true)}>
                <Plus className="h-4 w-4 me-1" />
                צור מוצר חדש
              </Button>
              <div className="w-56">
                <Combobox
                  value=""
                  onValueChange={(pid) => { if (pid) addProduct(pid); }}
                  options={products
                    .filter((p) => !divisionProducts.some((dp) => dp.product_id === p.id))
                    .map((p) => ({ value: p.id, label: p.sku ? `${p.name} · ${p.sku}` : p.name }))}
                  placeholder="הוסף מוצר קיים..."
                  searchPlaceholder="חיפוש מוצר..."
                />
              </div>
            </div>
          )}

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr
                      className="border-b bg-muted/50"
                      onContextMenu={trContextMenu(colVis.hiddenCols, setMenu)}
                    >
                      {DP_COLS.map((col) =>
                        colVis.isVisible(col.id) ? (
                          <th
                            key={col.id}
                            className="text-right p-3 font-semibold text-foreground"
                            onContextMenu={colThContextMenu(col, setMenu)}
                          >
                            {col.sortField ? (
                              <button
                                onClick={() => toggleSort(col.sortField!)}
                                className="flex items-center gap-1 cursor-pointer select-none hover:text-accent transition-colors"
                              >
                                {col.label}
                                <SortIcon field={col.sortField} currentField={sortField} currentDir={sortDir} />
                              </button>
                            ) : col.label}
                          </th>
                        ) : null
                      )}
                      <th className="p-3 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sortedProducts.length === 0 ? (
                      <tr>
                        <td colSpan={colVis.visibleCount + 1} className="text-center p-8 text-muted-foreground">
                          לא נוספו מוצרים — הוסף מהרשימה הקיימת או צור מוצר חדש
                        </td>
                      </tr>
                    ) : sortedProducts.map((dp) => {
                      const isEditingStock  = editingId === dp.id && editField === "division_stock";
                      const isEditingDemand = editingId === dp.id && editField === "quarterly_demand";
                      const mainProduct     = productMap.get(dp.product_id);
                      return (
                        <tr key={dp.id} className="hover:bg-muted/30 transition-colors">
                          {colVis.isVisible("product") && (
                            <td
                              className="p-3 cursor-pointer"
                              onClick={() => navigate(`/products/${dp.product_id}`)}
                            >
                              <div className="font-medium hover:text-accent transition-colors">{dp.products.name}</div>
                              <div className="flex gap-2 mt-0.5">
                                {dp.products.sku && (
                                  <span className="font-mono text-xs text-muted-foreground">{dp.products.sku}</span>
                                )}
                                {dp.products.category && (
                                  <span className="text-xs text-muted-foreground">· {dp.products.category}</span>
                                )}
                              </div>
                            </td>
                          )}
                          {colVis.isVisible("division_stock") && (
                            <td className="p-3">
                              {isEditingStock ? (
                                <Input
                                  type="number"
                                  min={0}
                                  value={editVal}
                                  onChange={(e) => setEditVal(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveField(dp.id, "division_stock", editVal);
                                    if (e.key === "Escape") setEditingId(null);
                                  }}
                                  onBlur={() => saveField(dp.id, "division_stock", editVal)}
                                  className="h-7 w-20"
                                  autoFocus
                                  disabled={saving}
                                />
                              ) : (
                                <div
                                  className={canManage ? "cursor-pointer hover:text-accent" : ""}
                                  onClick={() => {
                                    if (!canManage) return;
                                    setEditingId(dp.id);
                                    setEditField("division_stock");
                                    setEditVal(String(dp.division_stock));
                                  }}
                                >
                                  <span className="font-medium">{dp.division_stock}</span>
                                  {dp.division_stock_updated_at && (
                                    <div className="text-[10px] text-muted-foreground">
                                      עודכן: {format(new Date(dp.division_stock_updated_at), "dd/MM/yyyy")}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          )}
                          {colVis.isVisible("quarterly_demand") && (
                            <td className="p-3">
                              {isEditingDemand ? (
                                <Input
                                  type="number"
                                  min={0}
                                  value={editVal}
                                  onChange={(e) => setEditVal(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveField(dp.id, "quarterly_demand", editVal);
                                    if (e.key === "Escape") setEditingId(null);
                                  }}
                                  onBlur={() => saveField(dp.id, "quarterly_demand", editVal)}
                                  className="h-7 w-20"
                                  autoFocus
                                  disabled={saving}
                                />
                              ) : (
                                <div
                                  className={canManage ? "cursor-pointer hover:text-accent" : ""}
                                  onClick={() => {
                                    if (!canManage) return;
                                    setEditingId(dp.id);
                                    setEditField("quarterly_demand");
                                    setEditVal(String(dp.quarterly_demand ?? ""));
                                  }}
                                >
                                  <span className="font-medium">{dp.quarterly_demand ?? "—"}</span>
                                  {dp.quarterly_demand_updated_at && (
                                    <div className="text-[10px] text-muted-foreground">
                                      עודכן: {format(new Date(dp.quarterly_demand_updated_at), "dd/MM/yyyy")}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          )}
                          {colVis.isVisible("main_stock") && (
                            <td className="p-3">
                              <span className="font-medium">{mainProduct?.stock_qty ?? "—"}</span>
                            </td>
                          )}
                          {colVis.isVisible("incoming_qty") && (
                            <td className="p-3">
                              {(mainProduct?.incoming_qty ?? 0) > 0 ? (
                                <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">
                                  {mainProduct!.incoming_qty}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          )}
                          {colVis.isVisible("reorder_point") && (
                            <td className="p-3 text-muted-foreground">
                              {mainProduct?.reorder_point ?? "—"}
                            </td>
                          )}
                          <td className="p-3">
                            {canManage && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => removeProduct(dp.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Items Tab ── */}
        <TabsContent value="items" className="space-y-4">
          {canManage && (
            <div className="flex gap-2 justify-end flex-wrap">
              <div className="w-72">
                <Combobox
                  value=""
                  onValueChange={(cid) => { if (cid) addItem(cid); }}
                  options={itemOptions}
                  placeholder="הוסף פריט..."
                  searchPlaceholder="חיפוש פריט..."
                />
              </div>
            </div>
          )}

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr
                      className="border-b bg-muted/50"
                      onContextMenu={trContextMenu(itemColVis.hiddenCols, setItemMenu)}
                    >
                      {DPI_COLS.map((col) =>
                        itemColVis.isVisible(col.id) ? (
                          <th
                            key={col.id}
                            className="text-right p-3 font-semibold text-foreground"
                            onContextMenu={colThContextMenu(col, setItemMenu)}
                          >
                            {col.sortField ? (
                              <button
                                onClick={() => toggleItemSort(col.sortField!)}
                                className="flex items-center gap-1 cursor-pointer select-none hover:text-accent transition-colors"
                              >
                                {col.label}
                                <SortIcon field={col.sortField} currentField={itemSortField} currentDir={itemSortDir} />
                              </button>
                            ) : col.label}
                          </th>
                        ) : null
                      )}
                      <th className="p-3 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {loadingItems ? (
                      <tr>
                        <td colSpan={itemColVis.visibleCount + 1} className="p-8">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      </tr>
                    ) : sortedItems.length === 0 ? (
                      <tr>
                        <td colSpan={itemColVis.visibleCount + 1} className="text-center p-8 text-muted-foreground">
                          לא נוספו פריטים — הוסף פריט מהרשימה
                        </td>
                      </tr>
                    ) : sortedItems.map((dpi) => {
                      const comp = dpi.product_components;
                      const isEditingItem = editingItemId === dpi.id;
                      return (
                        <tr key={dpi.id} className="hover:bg-muted/30 transition-colors">
                          {itemColVis.isVisible("item") && (
                            <td className="p-3">
                              <div className="font-medium">{comp?.name ?? "—"}</div>
                              {comp?.sku && (
                                <span className="font-mono text-xs text-muted-foreground">{comp.sku}</span>
                              )}
                            </td>
                          )}
                          {itemColVis.isVisible("product") && (
                            <td className="p-3 text-muted-foreground text-xs">
                              {comp?.products?.name ?? "—"}
                            </td>
                          )}
                          {itemColVis.isVisible("division_stock") && (
                            <td className="p-3">
                              {isEditingItem ? (
                                <Input
                                  type="number"
                                  min={0}
                                  value={editItemVal}
                                  onChange={(e) => setEditItemVal(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveItemStock(dpi.id, editItemVal);
                                    if (e.key === "Escape") setEditingItemId(null);
                                  }}
                                  onBlur={() => saveItemStock(dpi.id, editItemVal)}
                                  className="h-7 w-20"
                                  autoFocus
                                  disabled={savingItem}
                                />
                              ) : (
                                <div
                                  className={canManage ? "cursor-pointer hover:text-accent" : ""}
                                  onClick={() => {
                                    if (!canManage) return;
                                    setEditingItemId(dpi.id);
                                    setEditItemVal(String(dpi.division_stock));
                                  }}
                                >
                                  <span className="font-medium">{dpi.division_stock}</span>
                                  {dpi.division_stock_updated_at && (
                                    <div className="text-[10px] text-muted-foreground">
                                      עודכן: {format(new Date(dpi.division_stock_updated_at), "dd/MM/yyyy")}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          )}
                          <td className="p-3">
                            {canManage && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => removeItem(dpi.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {menu && (
        <ColContextMenu
          menu={menu}
          sortField={sortField}
          sortDir={sortDir}
          hiddenCols={colVis.hiddenCols}
          onClose={closeMenu}
          onHide={colVis.hide}
          onShow={colVis.show}
          onSortAsc={(f) => { setSortField(f); setSortDir("asc"); }}
          onSortDesc={(f) => { setSortField(f); setSortDir("desc"); }}
        />
      )}

      {itemMenu && (
        <ColContextMenu
          menu={itemMenu}
          sortField={itemSortField}
          sortDir={itemSortDir}
          hiddenCols={itemColVis.hiddenCols}
          onClose={closeItemMenu}
          onHide={itemColVis.hide}
          onShow={itemColVis.show}
          onSortAsc={(f) => { setItemSortField(f); setItemSortDir("asc"); }}
          onSortDesc={(f) => { setItemSortField(f); setItemSortDir("desc"); }}
        />
      )}

      {showNewProduct && (
        <ProductFormDialog
          open={showNewProduct}
          onOpenChange={(open) => { if (!open) setShowNewProduct(false); }}
          onCreated={() => { setShowNewProduct(false); fetchProducts(); }}
        />
      )}
    </div>
  );
}
