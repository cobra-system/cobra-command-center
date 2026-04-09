import { useState, useEffect, useCallback } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { useData, useAuth } from "@/contexts/AppContext";
import { useProductScope } from "@/hooks/useProductScope";
import { supabase } from "@/lib/supabase";
import { useTablePreferences } from "@/hooks/useTablePreferences";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { InlineEditField } from "@/components/InlineEditField";
import { Plus, Warehouse, Phone, User, Trash2, ArrowLeftRight, AlertTriangle, History, Users, Crown, Search, ArrowUpDown, ArrowUp, ArrowDown as ArrowDownIcon, FileText } from "lucide-react";
import { toast } from "sonner";

interface InventoryChangeLog {
  id: string;
  product_id: string | null;
  center_id: string | null;
  old_quantity: number | null;
  new_quantity: number | null;
  change_type: string;
  changed_by: string | null;
  reason: string | null;
  created_at: string;
}

interface DistributionCenter {
  id: string;
  name: string;
  type: string;
  city: string | null;
  address: string | null;
  is_main: boolean;
}

interface CenterContact {
  id: string;
  center_id: string;
  name: string;
  role: string | null;
  phone: string | null;
}

interface CenterInventoryItem {
  id: string;
  center_id: string;
  product_id: string;
  quantity: number;
  min_stock: number;
}

interface InventoryTransfer {
  id: string;
  from_center_id: string | null;
  to_center_id: string | null;
  product_id: string | null;
  quantity: number;
  notes: string | null;
  transferred_by: string | null;
  created_at: string;
}

export default function InventoryPage() {
  const { refreshProducts } = useData();
  const { scopedProducts: products, isScoped, scopedProductIds } = useProductScope();
  const { currentUser } = useAuth();
  const { hasEdit } = usePermissions("inventory");
  const [centers, setCenters] = useState<DistributionCenter[]>([]);
  const [contacts, setContacts] = useState<CenterContact[]>([]);
  const [inventory, setInventory] = useState<CenterInventoryItem[]>([]);
  const [transfers, setTransfers] = useState<InventoryTransfer[]>([]);
  const [changeLogs, setChangeLogs] = useState<InventoryChangeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("details");
  const [detailSearch, setDetailSearch] = useState("");
  const [selectedCenter, setSelectedCenter] = useState<string | null>(null);

  const prefs = useTablePreferences("InventoryPage", {
    sortField: "name",
  });

  const detailSortKey = prefs.sortField as "name" | "sku" | "total" | null;
  const detailSortDir = prefs.sortDir;

  const [showAddCenter, setShowAddCenter] = useState(false);
  const [newCenterName, setNewCenterName] = useState("");
  const [newCenterCity, setNewCenterCity] = useState("");

  const [showAddContact, setShowAddContact] = useState(false);
  const [addContactCenterId, setAddContactCenterId] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [newContactRole, setNewContactRole] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");

  // Transfer dialog
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferFrom, setTransferFrom] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [transferProduct, setTransferProduct] = useState("");
  const [transferQty, setTransferQty] = useState("");
  const [transferNotes, setTransferNotes] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: c }, { data: ct }, { data: inv }, { data: tr }, { data: logs }] = await Promise.all([
      supabase.from("distribution_centers").select("*").order("is_main", { ascending: false }).order("name"),
      supabase.from("center_contacts").select("*"),
      supabase.from("center_inventory").select("*"),
      supabase.from("inventory_transfers").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("inventory_change_log").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    // Deduplicate centers by name — keep the first occurrence (main first, then alphabetical)
    if (c) {
      const seen = new Map<string, typeof c[0]>();
      const dupeIds: string[] = [];
      c.forEach(center => {
        if (seen.has(center.name)) {
          dupeIds.push(center.id);
        } else {
          seen.set(center.name, center);
        }
      });
      // Remove "יחידת היבואנים" or similar non-standard centers
      const filtered = Array.from(seen.values()).filter(center => !center.name.includes("יבואנים"));
      setCenters(filtered as DistributionCenter[]);
      // Clean up duplicates in background
      if (dupeIds.length > 0) {
        dupeIds.forEach(id => supabase.from("distribution_centers").delete().eq("id", id));
      }
      // Clean up "יבואנים" center
      const yevoanim = Array.from(seen.values()).find(center => center.name.includes("יבואנים"));
      if (yevoanim) {
        supabase.from("distribution_centers").delete().eq("id", yevoanim.id);
      }
    }
    if (ct) setContacts(ct as CenterContact[]);
    if (tr) setTransfers(tr as InventoryTransfer[]);
    if (logs) setChangeLogs(logs as InventoryChangeLog[]);

    // Auto-sync: if main center has no inventory records, populate from products.stock_qty
    const mainC = c?.find(center => center.is_main);
    if (mainC && inv && products.length > 0) {
      const mainInv = inv.filter(i => i.center_id === mainC.id);
      if (mainInv.length === 0) {
        const rows = products
          .filter(p => p.stock_qty > 0)
          .map(p => ({ center_id: mainC.id, product_id: p.id, quantity: p.stock_qty, min_stock: 0 }));
        if (rows.length > 0) {
          await supabase.from("center_inventory").upsert(rows as never[], { onConflict: "center_id,product_id" });
          const { data: freshInv } = await supabase.from("center_inventory").select("*");
          if (freshInv) {
            setInventory(freshInv as CenterInventoryItem[]);
            setLoading(false);
            return;
          }
        }
      }
    }
    if (inv) setInventory(inv as CenterInventoryItem[]);
    setLoading(false);
  }, [products]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const mainCenter = centers.find(c => c.is_main);
  const bondedCenters = centers.filter(c => !c.is_main);
  const getContactsForCenter = (centerId: string) => contacts.filter(c => c.center_id === centerId);

  // Filter inventory by product scope when applicable
  const visibleInventory = isScoped
    ? inventory.filter(i => i.product_id && scopedProductIds.has(i.product_id))
    : inventory;

  const getTotalQty = (centerId: string) => visibleInventory.filter(i => i.center_id === centerId).reduce((sum, i) => sum + i.quantity, 0);

  // Low stock alerts
  const lowStockAlerts = visibleInventory.filter(i => i.min_stock > 0 && i.quantity < i.min_stock);

  const handleAddCenter = async () => {
    if (!newCenterName.trim()) return;
    const { error } = await supabase.from("distribution_centers").insert({ name: newCenterName, type: "custom", city: newCenterCity || null, is_main: false } as never);
    if (error) { toast.error("שגיאה בהוספת מרכז: " + error.message); return; }
    setNewCenterName(""); setNewCenterCity(""); setShowAddCenter(false);
    toast.success("מרכז הפצה נוסף"); fetchData();
  };

  const handleDeleteCenter = async (id: string) => {
    const { error } = await supabase.from("distribution_centers").delete().eq("id", id);
    if (error) { toast.error("שגיאה במחיקת מרכז: " + error.message); return; }
    toast.success("מרכז הפצה נמחק"); fetchData();
  };

  const handleAddContact = async () => {
    if (!newContactName.trim() || !addContactCenterId) return;
    const { error } = await supabase.from("center_contacts").insert({ center_id: addContactCenterId, name: newContactName, role: newContactRole || null, phone: newContactPhone || null } as never);
    if (error) { toast.error("שגיאה בהוספת איש קשר: " + error.message); return; }
    setNewContactName(""); setNewContactRole(""); setNewContactPhone(""); setShowAddContact(false);
    toast.success("איש קשר נוסף"); fetchData();
  };

  const handleUpdateInventory = async (centerId: string, productId: string, qty: number) => {
    const existing = inventory.find(i => i.center_id === centerId && i.product_id === productId);
    const oldQty = existing?.quantity ?? 0;

    if (existing) {
      const { error } = await supabase.from("center_inventory").update({ quantity: qty } as never).eq("id", existing.id);
      if (error) { toast.error("שגיאה בעדכון מלאי: " + error.message); return; }
    } else {
      const { error } = await supabase.from("center_inventory").insert({ center_id: centerId, product_id: productId, quantity: qty } as never);
      if (error) { toast.error("שגיאה בעדכון מלאי: " + error.message); return; }
    }
    // Log the change
    await supabase.from("inventory_change_log").insert({
      product_id: productId,
      center_id: centerId,
      old_quantity: oldQty,
      new_quantity: qty,
      change_type: "manual",
      changed_by: currentUser?.name || null,
    } as never);
    // Trigger handles syncing to products.stock_qty automatically
    refreshProducts();
    fetchData();
  };

  const handleUpdateMinStock = async (centerId: string, productId: string, minStock: number) => {
    const existing = inventory.find(i => i.center_id === centerId && i.product_id === productId);
    if (existing) {
      const { error } = await supabase.from("center_inventory").update({ min_stock: minStock } as never).eq("id", existing.id);
      if (error) { toast.error("שגיאה בעדכון מינימום: " + error.message); return; }
    } else {
      const { error } = await supabase.from("center_inventory").insert({ center_id: centerId, product_id: productId, quantity: 0, min_stock: minStock } as never);
      if (error) { toast.error("שגיאה בעדכון מינימום: " + error.message); return; }
    }
    fetchData();
  };

  const handleTransfer = async () => {
    if (!transferFrom || !transferTo || !transferProduct || !transferQty) return;
    const qty = parseInt(transferQty);
    if (qty <= 0) return;

    const sourceInv = inventory.find(i => i.center_id === transferFrom && i.product_id === transferProduct);
    if (!sourceInv || sourceInv.quantity < qty) {
      toast.error("אין מספיק מלאי במרכז המקור");
      return;
    }

    const { error: srcErr } = await supabase.from("center_inventory").update({ quantity: sourceInv.quantity - qty } as never).eq("id", sourceInv.id);
    if (srcErr) { toast.error("שגיאה בעדכון מלאי מקור: " + srcErr.message); return; }

    const destInv = inventory.find(i => i.center_id === transferTo && i.product_id === transferProduct);
    if (destInv) {
      const { error: dstErr } = await supabase.from("center_inventory").update({ quantity: destInv.quantity + qty } as never).eq("id", destInv.id);
      if (dstErr) { toast.error("שגיאה בעדכון מלאי יעד: " + dstErr.message); return; }
    } else {
      const { error: dstErr } = await supabase.from("center_inventory").insert({ center_id: transferTo, product_id: transferProduct, quantity: qty } as never);
      if (dstErr) { toast.error("שגיאה בעדכון מלאי יעד: " + dstErr.message); return; }
    }

    const { error: transferErr } = await supabase.from("inventory_transfers").insert({
      from_center_id: transferFrom,
      to_center_id: transferTo,
      product_id: transferProduct,
      quantity: qty,
      notes: transferNotes || null,
      transferred_by: currentUser?.name || null,
    } as never);
    if (transferErr) { toast.error("שגיאה בתיעוד ההעברה: " + transferErr.message); return; }

    // Log transfer changes
    await supabase.from("inventory_change_log").insert([
      { product_id: transferProduct, center_id: transferFrom, old_quantity: sourceInv?.quantity || 0, new_quantity: (sourceInv?.quantity || 0) - qty, change_type: "transfer_out", changed_by: currentUser?.name || null, reason: transferNotes || null },
      { product_id: transferProduct, center_id: transferTo, old_quantity: destInv?.quantity || 0, new_quantity: (destInv?.quantity || 0) + qty, change_type: "transfer_in", changed_by: currentUser?.name || null, reason: transferNotes || null },
    ] as never);
    // Trigger handles syncing to products.stock_qty automatically
    refreshProducts();

    setTransferFrom(""); setTransferTo(""); setTransferProduct(""); setTransferQty(""); setTransferNotes("");
    setShowTransfer(false);
    toast.success(`הועברו ${qty} יחידות`);
    fetchData();
  };

  const getCenterName = (id: string | null) => centers.find(c => c.id === id)?.name || "—";
  const getProductName = (id: string | null) => products.find(p => p.id === id)?.name || "—";

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">טוען...</div>;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">מלאי ומרכזי הפצה</h1>
          <p className="text-muted-foreground text-sm">{centers.length} מרכזים · {products.length} מוצרים</p>
        </div>
        {hasEdit && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowTransfer(true)}>
              <ArrowLeftRight className="h-4 w-4 me-2" />העבר מלאי
            </Button>
            <Button onClick={() => setShowAddCenter(true)}>
              <Plus className="h-4 w-4 me-2" />הוסף מרכז הפצה
            </Button>
          </div>
        )}
      </div>

      {/* Low stock alerts banner */}
      {lowStockAlerts.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="font-semibold text-destructive text-sm">התראות מלאי נמוך ({lowStockAlerts.length})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {lowStockAlerts.map(alert => (
                <Badge key={alert.id} variant="destructive" className="text-xs">
                  {getProductName(alert.product_id)} ב{getCenterName(alert.center_id)}: {alert.quantity}/{alert.min_stock}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="details">פירוט מלאי</TabsTrigger>
          <TabsTrigger value="transfers" className="flex items-center gap-1">
            <History className="h-3.5 w-3.5" />
            היסטוריית העברות
          </TabsTrigger>
          <TabsTrigger value="changelog" className="flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" />
            לוג שינויים
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          {/* Center filter */}
          <div className="flex gap-2 flex-wrap">
            <Button variant={selectedCenter === null ? "default" : "outline"} size="sm" onClick={() => setSelectedCenter(null)}>כל המרכזים</Button>
            {centers.map(c => (
              <Button key={c.id} variant={selectedCenter === c.id ? "default" : "outline"} size="sm" onClick={() => setSelectedCenter(c.id)}>{c.name}</Button>
            ))}
          </div>
          {/* Search + sort */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="חיפוש לפי שם מוצר או SKU..."
                value={detailSearch}
                onChange={e => setDetailSearch(e.target.value)}
                className="pr-9"
              />
            </div>
            <div className="flex gap-1">
              {([
                { key: "name" as const, label: "שם" },
                { key: "sku" as const, label: "SKU" },
                { key: "total" as const, label: "סה״כ" },
              ]).map(({ key, label }) => (
                <Button
                  key={key}
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => prefs.toggleSort(key)}
                >
                  {label}
                  {detailSortKey === key ? (
                    detailSortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDownIcon className="h-3 w-3" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-40" />
                  )}
                </Button>
              ))}
            </div>
          </div>
          {/* ── Mobile card view (< md) ── */}
          {(() => {
            const displayCenters = selectedCenter
              ? [centers.find(c => c.id === selectedCenter)!].filter(Boolean)
              : centers;
            let filtered = products.filter(p => {
              if (!detailSearch) return true;
              const q = detailSearch.toLowerCase();
              return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
            });
            if (detailSortKey) {
              filtered = [...filtered].sort((a, b) => {
                let cmp = 0;
                if (detailSortKey === "name") cmp = a.name.localeCompare(b.name, "he");
                else if (detailSortKey === "sku") cmp = a.sku.localeCompare(b.sku);
                else if (detailSortKey === "total") {
                  const aTotal = displayCenters.reduce((s, c) => s + (inventory.find(i => i.center_id === c.id && i.product_id === a.id)?.quantity || 0), 0);
                  const bTotal = displayCenters.reduce((s, c) => s + (inventory.find(i => i.center_id === c.id && i.product_id === b.id)?.quantity || 0), 0);
                  cmp = aTotal - bTotal;
                }
                return detailSortDir === "asc" ? cmp : -cmp;
              });
            }
            const total = (p: typeof products[0]) => displayCenters.reduce((s, c) => s + (inventory.find(i => i.center_id === c.id && i.product_id === p.id)?.quantity || 0), 0);
            return (
              <>
                {/* Mobile cards */}
                <div className="md:hidden space-y-3">
                  {filtered.map(p => (
                    <Card key={p.id} className="rounded-2xl">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground leading-tight">{p.name}</p>
                            <p className="text-xs text-muted-foreground font-mono mt-0.5" dir="ltr">{p.sku}</p>
                          </div>
                          <span className="text-xl font-bold text-foreground shrink-0">{total(p)}</span>
                        </div>
                        <div className="divide-y divide-border/50">
                          {displayCenters.map(c => {
                            const inv = inventory.find(i => i.center_id === c.id && i.product_id === p.id);
                            const isLow = inv && inv.min_stock > 0 && inv.quantity < inv.min_stock;
                            return (
                              <div key={c.id} className="flex items-center justify-between py-2 gap-3">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Warehouse className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  <span className="text-sm text-muted-foreground truncate">{c.name}</span>
                                  {isLow && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {hasEdit ? (
                                    <>
                                      <input
                                        key={`qty-${c.id}-${p.id}-${inv?.quantity}`}
                                        type="number"
                                        defaultValue={inv?.quantity ?? 0}
                                        onBlur={e => {
                                          const val = parseInt(e.target.value) || 0;
                                          if (val !== (inv?.quantity ?? 0)) handleUpdateInventory(c.id, p.id, val);
                                        }}
                                        className={`h-9 w-16 text-center rounded-md border bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary ${isLow ? "border-destructive text-destructive" : "border-border"}`}
                                      />
                                      <span className="text-muted-foreground text-xs">/</span>
                                      <input
                                        key={`min-${c.id}-${p.id}-${inv?.min_stock}`}
                                        type="number"
                                        defaultValue={inv?.min_stock ?? 0}
                                        onBlur={e => {
                                          const val = parseInt(e.target.value) || 0;
                                          if (val !== (inv?.min_stock ?? 0)) handleUpdateMinStock(c.id, p.id, val);
                                        }}
                                        className="h-9 w-14 text-center rounded-md border border-border bg-muted/30 text-xs text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                      />
                                    </>
                                  ) : (
                                    <>
                                      <span className={`text-sm font-medium ${isLow ? "text-destructive" : "text-foreground"}`}>{inv?.quantity ?? 0}</span>
                                      <span className="text-muted-foreground text-xs">/ {inv?.min_stock ?? 0}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {filtered.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">לא נמצאו מוצרים</p>
                  )}
                </div>

                {/* Desktop table */}
                <Card className="hidden md:block">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">מוצר</TableHead>
                          <TableHead className="text-right">SKU</TableHead>
                          {displayCenters.map(c => (
                            <TableHead key={c.id} className="text-center min-w-[140px]">
                              <div>{c.name}</div>
                              <div className="text-[10px] text-muted-foreground font-normal">כמות / מינימום</div>
                            </TableHead>
                          ))}
                          <TableHead className="text-center">סה״כ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map(p => {
                          const totalForProduct = displayCenters.reduce((sum, c) => {
                            const inv = inventory.find(i => i.center_id === c.id && i.product_id === p.id);
                            return sum + (inv?.quantity || 0);
                          }, 0);
                          return (
                            <TableRow key={p.id}>
                              <TableCell className="font-medium text-right">{p.name}</TableCell>
                              <TableCell className="text-muted-foreground text-xs text-right" dir="ltr">{p.sku}</TableCell>
                              {displayCenters.map(c => {
                                const inv = inventory.find(i => i.center_id === c.id && i.product_id === p.id);
                                const isLow = inv && inv.min_stock > 0 && inv.quantity < inv.min_stock;
                                return (
                                  <TableCell key={c.id} className="text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      {hasEdit ? (
                                        <InlineEditField
                                          value={inv?.quantity ?? 0}
                                          type="number"
                                          onSave={(v) => handleUpdateInventory(c.id, p.id, parseInt(v) || 0)}
                                          className="min-w-[50px]"
                                          inputClassName={`w-16 h-7 text-center text-sm ${isLow ? "border-destructive bg-destructive/5" : ""}`}
                                          displayValue={
                                            <span className={`text-sm font-medium ${isLow ? "text-destructive" : ""}`}>
                                              {inv?.quantity ?? 0}
                                            </span>
                                          }
                                        />
                                      ) : (
                                        <span className={`text-sm font-medium ${isLow ? "text-destructive" : ""}`}>
                                          {inv?.quantity ?? 0}
                                        </span>
                                      )}
                                      <span className="text-muted-foreground text-xs">/</span>
                                      {hasEdit ? (
                                        <InlineEditField
                                          value={inv?.min_stock ?? 0}
                                          type="number"
                                          onSave={(v) => handleUpdateMinStock(c.id, p.id, parseInt(v) || 0)}
                                          className="min-w-[40px]"
                                          inputClassName="w-14 h-7 text-center text-xs"
                                          displayValue={
                                            <span className="text-xs text-muted-foreground">{inv?.min_stock ?? 0}</span>
                                          }
                                        />
                                      ) : (
                                        <span className="text-xs text-muted-foreground">{inv?.min_stock ?? 0}</span>
                                      )}
                                      {isLow && <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />}
                                    </div>
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-center font-bold">{totalForProduct}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </>
            );
          })()}
        </TabsContent>

        <TabsContent value="transfers" className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <History className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">היסטוריית העברות ({transfers.length})</span>
          </div>
          {transfers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">אין העברות מלאי עדיין</p>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {transfers.map(t => (
                  <Card key={t.id} className="rounded-2xl">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-foreground leading-tight">{getProductName(t.product_id)}</p>
                        <Badge variant="secondary" className="text-sm font-bold shrink-0">{t.quantity}</Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <span>{getCenterName(t.from_center_id)}</span>
                        <ArrowDownIcon className="h-3.5 w-3.5 -rotate-90 shrink-0" />
                        <span>{getCenterName(t.to_center_id)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{t.transferred_by ? `ע״י ${t.transferred_by}` : ""}</span>
                        <span>{new Date(t.created_at).toLocaleDateString("he-IL")} {new Date(t.created_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      {t.notes && <p className="text-xs text-muted-foreground border-t border-border/50 pt-2">{t.notes}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
              {/* Desktop table */}
              <Card className="hidden md:block">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">תאריך</TableHead>
                          <TableHead className="text-right">מוצר</TableHead>
                          <TableHead className="text-right">ממרכז</TableHead>
                          <TableHead className="text-right">למרכז</TableHead>
                          <TableHead className="text-center">כמות</TableHead>
                          <TableHead className="text-right">בוצע ע״י</TableHead>
                          <TableHead className="text-right">הערות</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transfers.map(t => (
                          <TableRow key={t.id}>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(t.created_at).toLocaleDateString("he-IL")} {new Date(t.created_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                            </TableCell>
                            <TableCell className="font-medium">{getProductName(t.product_id)}</TableCell>
                            <TableCell>{getCenterName(t.from_center_id)}</TableCell>
                            <TableCell>{getCenterName(t.to_center_id)}</TableCell>
                            <TableCell className="text-center font-bold">{t.quantity}</TableCell>
                            <TableCell className="text-muted-foreground text-xs">{t.transferred_by || "—"}</TableCell>
                            <TableCell className="text-muted-foreground text-xs">{t.notes || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="changelog" className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">לוג שינויי מלאי ({changeLogs.length})</span>
          </div>
          {changeLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">אין שינויים עדיין</p>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {changeLogs.map(log => {
                  const diff = (log.new_quantity ?? 0) - (log.old_quantity ?? 0);
                  const typeLabels: Record<string, string> = {
                    manual: "ידני",
                    transfer_in: "העברה נכנסת",
                    transfer_out: "העברה יוצאת",
                  };
                  return (
                    <Card key={log.id} className="rounded-2xl">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground leading-tight truncate">{getProductName(log.product_id)}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{getCenterName(log.center_id)}</p>
                          </div>
                          <Badge variant={diff > 0 ? "default" : diff < 0 ? "destructive" : "secondary"} className="text-sm font-bold shrink-0">
                            {diff > 0 ? `+${diff}` : diff}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">{log.old_quantity ?? "—"}</span>
                          <ArrowDownIcon className="h-3.5 w-3.5 -rotate-90 text-muted-foreground shrink-0" />
                          <span className="font-bold text-foreground">{log.new_quantity ?? "—"}</span>
                          <span className="text-xs text-muted-foreground ms-auto">{typeLabels[log.change_type] || log.change_type}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{log.changed_by ? `ע״י ${log.changed_by}` : ""}</span>
                          <span>{new Date(log.created_at).toLocaleDateString("he-IL")} {new Date(log.created_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        {log.reason && <p className="text-xs text-muted-foreground border-t border-border/50 pt-2">{log.reason}</p>}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              {/* Desktop table */}
              <Card className="hidden md:block">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">תאריך</TableHead>
                          <TableHead className="text-right">מוצר</TableHead>
                          <TableHead className="text-right">מרכז</TableHead>
                          <TableHead className="text-center">לפני</TableHead>
                          <TableHead className="text-center">אחרי</TableHead>
                          <TableHead className="text-center">שינוי</TableHead>
                          <TableHead className="text-right">סוג</TableHead>
                          <TableHead className="text-right">בוצע ע״י</TableHead>
                          <TableHead className="text-right">סיבה</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {changeLogs.map(log => {
                          const diff = (log.new_quantity ?? 0) - (log.old_quantity ?? 0);
                          const typeLabels: Record<string, string> = {
                            manual: "ידני",
                            transfer_in: "העברה נכנסת",
                            transfer_out: "העברה יוצאת",
                          };
                          return (
                            <TableRow key={log.id}>
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                {new Date(log.created_at).toLocaleDateString("he-IL")} {new Date(log.created_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                              </TableCell>
                              <TableCell className="font-medium">{getProductName(log.product_id)}</TableCell>
                              <TableCell>{getCenterName(log.center_id)}</TableCell>
                              <TableCell className="text-center text-muted-foreground">{log.old_quantity ?? "—"}</TableCell>
                              <TableCell className="text-center font-bold">{log.new_quantity ?? "—"}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant={diff > 0 ? "default" : diff < 0 ? "destructive" : "secondary"} className="text-xs">
                                  {diff > 0 ? `+${diff}` : diff}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs">{typeLabels[log.change_type] || log.change_type}</TableCell>
                              <TableCell className="text-muted-foreground text-xs">{log.changed_by || "—"}</TableCell>
                              <TableCell className="text-muted-foreground text-xs">{log.reason || "—"}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Center Dialog */}
      <Dialog open={showAddCenter} onOpenChange={setShowAddCenter}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>הוסף מרכז הפצה</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">שם המרכז</Label>
              <Input value={newCenterName} onChange={e => setNewCenterName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">עיר (אופציונלי)</Label>
              <Input value={newCenterCity} onChange={e => setNewCenterCity(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="flex-row-reverse gap-2 sm:justify-start">
            <Button onClick={handleAddCenter} disabled={!newCenterName.trim()}>הוסף</Button>
            <Button variant="outline" onClick={() => setShowAddCenter(false)}>ביטול</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Contact Dialog */}
      <Dialog open={showAddContact} onOpenChange={setShowAddContact}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>הוסף איש קשר</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">שם</Label>
              <Input value={newContactName} onChange={e => setNewContactName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">תפקיד</Label>
              <Input value={newContactRole} onChange={e => setNewContactRole(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">טלפון</Label>
              <Input value={newContactPhone} onChange={e => setNewContactPhone(e.target.value)} dir="ltr" />
            </div>
          </div>
          <DialogFooter className="flex-row-reverse gap-2 sm:justify-start">
            <Button onClick={handleAddContact} disabled={!newContactName.trim()}>הוסף</Button>
            <Button variant="outline" onClick={() => setShowAddContact(false)}>ביטול</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={showTransfer} onOpenChange={setShowTransfer}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>העברת מלאי בין מרכזים</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">ממרכז</Label>
              <Select value={transferFrom} onValueChange={setTransferFrom}>
                <SelectTrigger><SelectValue placeholder="בחר מרכז מקור" /></SelectTrigger>
                <SelectContent>{centers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">למרכז</Label>
              <Select value={transferTo} onValueChange={setTransferTo}>
                <SelectTrigger><SelectValue placeholder="בחר מרכז יעד" /></SelectTrigger>
                <SelectContent>{centers.filter(c => c.id !== transferFrom).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">מוצר</Label>
              <Select value={transferProduct} onValueChange={setTransferProduct}>
                <SelectTrigger><SelectValue placeholder="בחר מוצר" /></SelectTrigger>
                <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">כמות</Label>
              <Input type="number" min={1} value={transferQty} onChange={e => setTransferQty(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">הערות</Label>
              <Textarea value={transferNotes} onChange={e => setTransferNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter className="flex-row-reverse gap-2 sm:justify-start">
            <Button onClick={handleTransfer} disabled={!transferFrom || !transferTo || !transferProduct || !transferQty}>העבר</Button>
            <Button variant="outline" onClick={() => setShowTransfer(false)}>ביטול</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
