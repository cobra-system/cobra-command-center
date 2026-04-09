import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth, useData } from "@/contexts/AppContext";
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
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
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
}

interface EditingRow {
  id: string | null; // null = new row
  product_name: string;
  sku: string;
  quantity: number;
  in_use: boolean;
  recommendations: string;
}

const emptyRow: EditingRow = {
  id: null,
  product_name: "",
  sku: "",
  quantity: 0,
  in_use: false,
  recommendations: "",
};

export default function WasteManagementPage() {
  const { currentUser } = useAuth();
  const { scopedProducts: products, isScoped, scopedProductNames } = useProductScope();
  const { hasEdit, isManager } = usePermissions("waste");
  const isMobile = useIsMobile();

  const [items, setItems] = useState<WasteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRow, setEditingRow] = useState<EditingRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const productOptions = useMemo(
    () => products.map((p) => ({ value: p.name, label: p.name })),
    [products]
  );

  const productByName = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p) => map.set(p.name, p.sku));
    return map;
  }, [products]);

  const handleProductSelect = (val: string) => {
    if (!editingRow) return;
    const sku = productByName.get(val);
    if (sku !== undefined) {
      setEditingRow({ ...editingRow, product_name: val, sku });
    } else {
      setEditingRow({ ...editingRow, product_name: val });
    }
  };

  const isProductFromSystem = useMemo(() => {
    if (!editingRow) return false;
    return productByName.has(editingRow.product_name);
  }, [editingRow, productByName]);

  const refreshItems = useCallback(async () => {
    let query = supabase
      .from("waste_items")
      .select("*")
      .order("created_at", { ascending: false });

    if (!isManager && currentUser) {
      query = query.eq("created_by", currentUser.id);
    }

    const { data, error } = await query;
    if (error) {
      logger.error("Error fetching waste items", error);
      return;
    }
    setItems((data as WasteItem[]) || []);
  }, [isManager, currentUser]);

  useEffect(() => {
    (async () => {
      await refreshItems();
      setLoading(false);
    })();
  }, [refreshItems]);

  const employees = useMemo(() => {
    if (!isManager) return [];
    const map = new Map<string, string>();
    items.forEach((item) => {
      if (item.created_by && item.created_by_name) {
        map.set(item.created_by, item.created_by_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [items, isManager]);

  const filteredItems = useMemo(() => {
    let filtered = items;
    // Filter by product scope
    if (isScoped) {
      filtered = filtered.filter((item) => scopedProductNames.has(item.product_name));
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.product_name.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          item.recommendations.toLowerCase().includes(q)
      );
    }
    if (isManager && filterEmployee !== "all") {
      filtered = filtered.filter((item) => item.created_by === filterEmployee);
    }
    return filtered;
  }, [items, search, filterEmployee, isManager, isScoped, scopedProductNames]);

  const summaryStats = useMemo(() => {
    const total = items.length;
    const inUse = items.filter((i) => i.in_use).length;
    const notInUse = total - inUse;
    const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);
    return { total, inUse, notInUse, totalQuantity };
  }, [items]);

  const handleSave = async () => {
    if (!editingRow || !currentUser) return;
    if (!editingRow.product_name.trim()) {
      toast.error("יש להזין שם מוצר");
      return;
    }

    setSaving(true);
    try {
      if (editingRow.id) {
        const { error } = await supabase
          .from("waste_items")
          .update({
            product_name: editingRow.product_name.trim(),
            sku: editingRow.sku.trim(),
            quantity: editingRow.quantity,
            in_use: editingRow.in_use,
            recommendations: editingRow.recommendations.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingRow.id);
        if (error) throw error;
        toast.success("הפריט עודכן בהצלחה");
      } else {
        const { error } = await supabase.from("waste_items").insert({
          product_name: editingRow.product_name.trim(),
          sku: editingRow.sku.trim(),
          quantity: editingRow.quantity,
          in_use: editingRow.in_use,
          recommendations: editingRow.recommendations.trim(),
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
      toast.error(error instanceof Error ? error.message : "שגיאה בשמירת הפריט");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from("waste_items").delete().eq("id", id);
    if (error) {
      toast.error("שגיאה במחיקת הפריט");
      setDeletingId(null);
      return;
    }
    toast.success("הפריט נמחק");
    setDeletingId(null);
    await refreshItems();
  };

  const handleInlineToggle = async (item: WasteItem) => {
    const { error } = await supabase
      .from("waste_items")
      .update({ in_use: !item.in_use, updated_at: new Date().toISOString() })
      .eq("id", item.id);
    if (error) {
      toast.error("שגיאה בעדכון");
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, in_use: !i.in_use } : i))
    );
  };

  const startEdit = (item: WasteItem) => {
    setEditingRow({
      id: item.id,
      product_name: item.product_name,
      sku: item.sku,
      quantity: item.quantity,
      in_use: item.in_use,
      recommendations: item.recommendations,
    });
    if (isMobile) {
      setDrawerOpen(true);
    }
  };

  const openNewItemDrawer = () => {
    setEditingRow({ ...emptyRow });
    if (isMobile) {
      setDrawerOpen(true);
    }
  };

  const handleDrawerClose = (open: boolean) => {
    if (!open) {
      setDrawerOpen(false);
      setEditingRow(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ──────────────────────────────────────
  // MOBILE EMPLOYEE VIEW
  // ──────────────────────────────────────
  if (isMobile) {
    return (
      <div className="flex flex-col min-h-[calc(100dvh-8rem)] pb-24">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <Recycle className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-lg font-bold">ניהול בלאי</h1>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => {
                  setShowSearch(!showSearch);
                  if (!showSearch) {
                    setTimeout(() => searchInputRef.current?.focus(), 100);
                  } else {
                    setSearch("");
                  }
                }}
              >
                {showSearch ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Mini stats bar */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              {summaryStats.total} פריטים
            </span>
            <span className="flex items-center gap-1 text-green-600">
              <PackageCheck className="h-3 w-3" />
              {summaryStats.inUse} בשימוש
            </span>
            <span className="flex items-center gap-1 text-orange-500">
              <PackageX className="h-3 w-3" />
              {summaryStats.notInUse} לא בשימוש
            </span>
          </div>

          {/* Manager employee filter */}
          {isManager && employees.length > 0 && (
            <select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="mt-3 w-full h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">כל העובדים</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          )}

          {/* Search bar - expandable */}
          {showSearch && (
            <div className="mt-3 animate-in slide-in-from-top-2 duration-200">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="חיפוש מוצר, מק״ט, המלצה..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-10 h-10 rounded-xl bg-muted/50"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Card list */}
        <div className="flex-1 px-4 pt-3 space-y-3">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 bg-muted/30 rounded-full mb-4">
                <Recycle className="h-12 w-12 text-muted-foreground/30" />
              </div>
              <p className="text-base font-medium text-muted-foreground mb-1">
                {search ? "לא נמצאו תוצאות" : "אין פריטי בלאי"}
              </p>
              <p className="text-sm text-muted-foreground/60">
                {search
                  ? "נסו לחפש עם מילות מפתח אחרות"
                  : hasEdit
                  ? 'לחצו על "+" כדי להוסיף פריט ראשון'
                  : "לא נוספו פריטים עדיין"}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <Card
                key={item.id}
                className={`overflow-hidden transition-all duration-200 active:scale-[0.98] ${
                  deletingId === item.id ? "opacity-50 scale-95" : ""
                }`}
              >
                <CardContent className="p-0">
                  {/* Card header with product name and status */}
                  <div
                    className="flex items-start justify-between p-3.5 pb-2 cursor-pointer"
                    onClick={() => hasEdit && startEdit(item)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-base truncate">
                          {item.product_name}
                        </h3>
                        {hasEdit && (
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />
                        )}
                      </div>
                      {isManager && item.created_by_name && (
                        <p className="text-xs text-muted-foreground">
                          {item.created_by_name}
                        </p>
                      )}
                      {item.sku && (
                        <p className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                          <Hash className="h-3 w-3" />
                          {item.sku}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant={item.in_use ? "default" : "secondary"}
                      className={`flex-shrink-0 text-xs ${
                        item.in_use
                          ? "bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400"
                      }`}
                    >
                      {item.in_use ? "בשימוש" : "לא בשימוש"}
                    </Badge>
                  </div>

                  {/* Card details row */}
                  <div className="flex items-center justify-between px-3.5 pb-3 gap-3">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Box className="h-3.5 w-3.5" />
                        <span className="font-medium text-foreground">
                          {item.quantity}
                        </span>{" "}
                        יח׳
                      </span>
                      {item.recommendations && (
                        <span className="flex items-center gap-1.5 truncate max-w-[160px]">
                          <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate">
                            {item.recommendations}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Quick toggle + delete */}
                    {hasEdit && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="flex items-center gap-1.5">
                          <Checkbox
                            checked={item.in_use}
                            onCheckedChange={() => handleInlineToggle(item)}
                          />
                          <span className="text-xs text-muted-foreground">
                            {item.in_use ? "כן" : "לא"}
                          </span>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground/50 hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(item.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* FAB - Floating Action Button */}
        {hasEdit && (
          <button
            onClick={openNewItemDrawer}
            className="fixed bottom-24 left-5 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 flex items-center justify-center active:scale-90 transition-transform duration-150 hover:shadow-xl"
          >
            <Plus className="h-7 w-7" strokeWidth={2.5} />
          </button>
        )}

        {/* Bottom Sheet Drawer for Add/Edit */}
        <Drawer open={drawerOpen} onOpenChange={handleDrawerClose}>
          <DrawerContent className="max-h-[92dvh]">
            <DrawerHeader className="text-right pb-2">
              <DrawerTitle className="text-lg">
                {editingRow?.id ? "עריכת פריט" : "הוספת פריט חדש"}
              </DrawerTitle>
              <DrawerDescription>
                {editingRow?.id
                  ? "עדכנו את פרטי הפריט"
                  : "מלאו את הפרטים להוספת פריט בלאי חדש"}
              </DrawerDescription>
            </DrawerHeader>

            {editingRow && (
              <div className="px-4 space-y-5 overflow-y-auto">
                {/* Product name */}
                <div className="space-y-2">
                  <Label
                    className="text-sm font-medium flex items-center gap-2"
                  >
                    <Package className="h-4 w-4 text-primary" />
                    שם המוצר
                  </Label>
                  <Combobox
                    value={editingRow.product_name}
                    onValueChange={handleProductSelect}
                    options={productOptions}
                    placeholder="בחר או הקלד שם מוצר..."
                    searchPlaceholder="חיפוש מוצר..."
                    emptyText="לא נמצא מוצר"
                    allowCustomValue
                    className="h-12 rounded-xl text-base"
                  />
                </div>

                {/* SKU + Quantity row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label
                      htmlFor="mobile-sku"
                      className="text-sm font-medium flex items-center gap-2"
                    >
                      <Hash className="h-4 w-4 text-primary" />
                      מק״ט
                    </Label>
                    <Input
                      id="mobile-sku"
                      placeholder="XXX-000"
                      value={editingRow.sku}
                      onChange={(e) =>
                        setEditingRow({ ...editingRow, sku: e.target.value })
                      }
                      disabled={isProductFromSystem}
                      className="h-12 rounded-xl text-base font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="mobile-qty"
                      className="text-sm font-medium flex items-center gap-2"
                    >
                      <Box className="h-4 w-4 text-primary" />
                      כמות
                    </Label>
                    <Input
                      id="mobile-qty"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      placeholder="0"
                      value={editingRow.quantity || ""}
                      onChange={(e) =>
                        setEditingRow({
                          ...editingRow,
                          quantity: parseInt(e.target.value) || 0,
                        })
                      }
                      className="h-12 rounded-xl text-base text-center"
                    />
                  </div>
                </div>

                {/* In use toggle */}
                <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-xl">
                  <Checkbox
                    id="mobile-inuse"
                    checked={editingRow.in_use}
                    onCheckedChange={(checked) =>
                      setEditingRow({ ...editingRow, in_use: !!checked })
                    }
                  />
                  <Label
                    htmlFor="mobile-inuse"
                    className="text-sm font-medium flex items-center gap-2 cursor-pointer"
                  >
                    <ToggleRight className="h-4 w-4 text-primary" />
                    בשימוש
                  </Label>
                </div>

                {/* Recommendations */}
                <div className="space-y-2">
                  <Label
                    htmlFor="mobile-rec"
                    className="text-sm font-medium flex items-center gap-2"
                  >
                    <MessageSquare className="h-4 w-4 text-primary" />
                    המלצות
                  </Label>
                  <Textarea
                    id="mobile-rec"
                    placeholder="המלצה לגבי הפריט... (לדוגמה: להחליף, לתקן, לזרוק)"
                    value={editingRow.recommendations}
                    onChange={(e) =>
                      setEditingRow({
                        ...editingRow,
                        recommendations: e.target.value,
                      })
                    }
                    rows={3}
                    className="rounded-xl text-base resize-none"
                  />
                </div>
              </div>
            )}

            <DrawerFooter className="pt-4 pb-6 gap-2">
              <Button
                onClick={handleSave}
                disabled={saving || !editingRow?.product_name.trim()}
                className="h-12 rounded-xl text-base font-medium gap-2"
              >
                {saving ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Save className="h-5 w-5" />
                )}
                {editingRow?.id ? "עדכון פריט" : "הוספת פריט"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => handleDrawerClose(false)}
                className="h-11 rounded-xl text-base text-muted-foreground"
              >
                ביטול
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    );
  }

  // ──────────────────────────────────────
  // DESKTOP / MANAGER VIEW (unchanged)
  // ──────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Recycle className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">ניהול בלאי</h1>
            <p className="text-sm text-muted-foreground">
              {isManager
                ? "תצוגת ניהול - כל הפריטים מכל העובדים"
                : "תיעוד וניהול פריטי בלאי"}
            </p>
          </div>
        </div>
        {hasEdit && (
          <Button
            onClick={() => setEditingRow({ ...emptyRow })}
            disabled={editingRow !== null}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            הוסף שורה
          </Button>
        )}
      </div>

      {/* Manager Summary Cards */}
      {isManager && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Package className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summaryStats.total}</p>
                <p className="text-xs text-muted-foreground">סה"כ פריטים</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <PackageCheck className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summaryStats.inUse}</p>
                <p className="text-xs text-muted-foreground">בשימוש</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <PackageX className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summaryStats.notInUse}</p>
                <p className="text-xs text-muted-foreground">לא בשימוש</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Recycle className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {summaryStats.totalQuantity}
                </p>
                <p className="text-xs text-muted-foreground">סה"כ כמות</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="חיפוש לפי מוצר, מק״ט או המלצה..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10"
          />
        </div>
        {isManager && employees.length > 0 && (
          <select
            value={filterEmployee}
            onChange={(e) => setFilterEmployee(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">כל העובדים</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              {isManager && (
                <TableHead className="font-semibold">עובד</TableHead>
              )}
              <TableHead className="font-semibold">מוצר</TableHead>
              <TableHead className="font-semibold">מק"ט</TableHead>
              <TableHead className="font-semibold text-center">כמות</TableHead>
              <TableHead className="font-semibold text-center">
                בשימוש
              </TableHead>
              <TableHead className="font-semibold">המלצות</TableHead>
              {hasEdit && (
                <TableHead className="font-semibold text-center w-24">
                  פעולות
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* New row being added */}
            {editingRow && editingRow.id === null && (
              <TableRow className="bg-primary/5">
                {isManager && (
                  <TableCell className="text-sm text-muted-foreground">
                    {currentUser?.name}
                  </TableCell>
                )}
                <TableCell>
                  <Combobox
                    value={editingRow.product_name}
                    onValueChange={handleProductSelect}
                    options={productOptions}
                    placeholder="בחר או הקלד שם מוצר..."
                    searchPlaceholder="חיפוש מוצר..."
                    emptyText="לא נמצא מוצר"
                    allowCustomValue
                    className="h-9"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    placeholder="מק״ט"
                    value={editingRow.sku}
                    onChange={(e) =>
                      setEditingRow({ ...editingRow, sku: e.target.value })
                    }
                    disabled={isProductFromSystem}
                    className="h-9"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={editingRow.quantity || ""}
                    onChange={(e) =>
                      setEditingRow({
                        ...editingRow,
                        quantity: parseInt(e.target.value) || 0,
                      })
                    }
                    className="h-9 w-20 text-center mx-auto"
                  />
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <Checkbox
                      checked={editingRow.in_use}
                      onCheckedChange={(checked) =>
                        setEditingRow({ ...editingRow, in_use: !!checked })
                      }
                    />
                    <span className="text-sm">{editingRow.in_use ? "כן" : "לא"}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Input
                    placeholder="המלצות..."
                    value={editingRow.recommendations}
                    onChange={(e) =>
                      setEditingRow({
                        ...editingRow,
                        recommendations: e.target.value,
                      })
                    }
                    className="h-9"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setEditingRow(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {/* Existing rows */}
            {filteredItems.map((item) =>
              editingRow && editingRow.id === item.id ? (
                <TableRow key={item.id} className="bg-primary/5">
                  {isManager && (
                    <TableCell className="text-sm">
                      {item.created_by_name}
                    </TableCell>
                  )}
                  <TableCell>
                    <Combobox
                      value={editingRow.product_name}
                      onValueChange={handleProductSelect}
                      options={productOptions}
                      placeholder="בחר או הקלד שם מוצר..."
                      searchPlaceholder="חיפוש מוצר..."
                      emptyText="לא נמצא מוצר"
                      allowCustomValue
                      className="h-9"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={editingRow.sku}
                      onChange={(e) =>
                        setEditingRow({ ...editingRow, sku: e.target.value })
                      }
                      disabled={isProductFromSystem}
                      className="h-9"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={editingRow.quantity || ""}
                      onChange={(e) =>
                        setEditingRow({
                          ...editingRow,
                          quantity: parseInt(e.target.value) || 0,
                        })
                      }
                      className="h-9 w-20 text-center mx-auto"
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <Checkbox
                        checked={editingRow.in_use}
                        onCheckedChange={(checked) =>
                          setEditingRow({ ...editingRow, in_use: !!checked })
                        }
                      />
                      <span className="text-sm">{editingRow.in_use ? "כן" : "לא"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={editingRow.recommendations}
                      onChange={(e) =>
                        setEditingRow({
                          ...editingRow,
                          recommendations: e.target.value,
                        })
                      }
                      className="h-9"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={handleSave}
                        disabled={saving}
                      >
                        {saving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setEditingRow(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={item.id} className="group">
                  {isManager && (
                    <TableCell className="text-sm font-medium">
                      {item.created_by_name || "—"}
                    </TableCell>
                  )}
                  <TableCell className="font-medium">
                    {item.product_name}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">
                    {item.sku || "—"}
                  </TableCell>
                  <TableCell className="text-center font-semibold">
                    {item.quantity}
                  </TableCell>
                  <TableCell className="text-center">
                    {hasEdit ? (
                      <div className="flex items-center justify-center gap-1.5">
                        <Checkbox
                          checked={item.in_use}
                          onCheckedChange={() => handleInlineToggle(item)}
                        />
                        <span className="text-sm">{item.in_use ? "כן" : "לא"}</span>
                      </div>
                    ) : (
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.in_use
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                        }`}
                      >
                        {item.in_use ? "כן" : "לא"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                    {item.recommendations || "—"}
                  </TableCell>
                  {hasEdit && (
                    <TableCell>
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => startEdit(item)}
                          disabled={editingRow !== null}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(item.id)}
                          disabled={editingRow !== null}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )
            )}

            {/* Empty state */}
            {filteredItems.length === 0 && !editingRow && (
              <TableRow>
                <TableCell
                  colSpan={isManager ? 7 : 6}
                  className="text-center py-12 text-muted-foreground"
                >
                  <Recycle className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-lg font-medium mb-1">אין פריטי בלאי</p>
                  <p className="text-sm">
                    {search
                      ? "לא נמצאו תוצאות לחיפוש"
                      : hasEdit
                      ? 'לחץ על "הוסף שורה" כדי להתחיל לתעד בלאי'
                      : "לא נוספו פריטי בלאי עדיין"}
                  </p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
