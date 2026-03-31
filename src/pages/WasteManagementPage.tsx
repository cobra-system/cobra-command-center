import { useState, useEffect, useMemo, useCallback } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
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
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
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
  const { hasEdit, isManager } = usePermissions("waste");

  const [items, setItems] = useState<WasteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRow, setEditingRow] = useState<EditingRow | null>(null);
  const [search, setSearch] = useState("");
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [saving, setSaving] = useState(false);

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
      console.error("Error fetching waste items:", error);
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
  }, [items, search, filterEmployee, isManager]);

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
        // Update existing
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
        // Insert new
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
      await refreshItems();
    } catch (error: any) {
      toast.error(error.message || "שגיאה בשמירת הפריט");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("waste_items").delete().eq("id", id);
    if (error) {
      toast.error("שגיאה במחיקת הפריט");
      return;
    }
    toast.success("הפריט נמחק");
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
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
                <p className="text-2xl font-bold">{summaryStats.totalQuantity}</p>
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
              <TableHead className="font-semibold text-center">בשימוש</TableHead>
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
                {isManager && <TableCell className="text-sm text-muted-foreground">{currentUser?.name}</TableCell>}
                <TableCell>
                  <Input
                    autoFocus
                    placeholder="שם המוצר"
                    value={editingRow.product_name}
                    onChange={(e) =>
                      setEditingRow({ ...editingRow, product_name: e.target.value })
                    }
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
                  <Switch
                    checked={editingRow.in_use}
                    onCheckedChange={(checked) =>
                      setEditingRow({ ...editingRow, in_use: checked })
                    }
                  />
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
                // Editing existing row
                <TableRow key={item.id} className="bg-primary/5">
                  {isManager && (
                    <TableCell className="text-sm">{item.created_by_name}</TableCell>
                  )}
                  <TableCell>
                    <Input
                      autoFocus
                      value={editingRow.product_name}
                      onChange={(e) =>
                        setEditingRow({
                          ...editingRow,
                          product_name: e.target.value,
                        })
                      }
                      className="h-9"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={editingRow.sku}
                      onChange={(e) =>
                        setEditingRow({ ...editingRow, sku: e.target.value })
                      }
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
                    <Switch
                      checked={editingRow.in_use}
                      onCheckedChange={(checked) =>
                        setEditingRow({ ...editingRow, in_use: checked })
                      }
                    />
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
                // Display row
                <TableRow key={item.id} className="group">
                  {isManager && (
                    <TableCell className="text-sm font-medium">
                      {item.created_by_name || "—"}
                    </TableCell>
                  )}
                  <TableCell className="font-medium">{item.product_name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">
                    {item.sku || "—"}
                  </TableCell>
                  <TableCell className="text-center font-semibold">
                    {item.quantity}
                  </TableCell>
                  <TableCell className="text-center">
                    {hasEdit ? (
                      <Switch
                        checked={item.in_use}
                        onCheckedChange={() => handleInlineToggle(item)}
                      />
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
