import { useState, useEffect, useCallback } from "react";
import { useData, useAuth } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
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
import { Plus, Warehouse, ArrowDown, Phone, User, Trash2, Building2, ArrowLeftRight, AlertTriangle, History, Users, Crown, Search, ArrowUpDown, ArrowUp, ArrowDown as ArrowDownIcon } from "lucide-react";
import { toast } from "sonner";

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
  const { products } = useData();
  const { currentUser } = useAuth();
  const [centers, setCenters] = useState<DistributionCenter[]>([]);
  const [contacts, setContacts] = useState<CenterContact[]>([]);
  const [inventory, setInventory] = useState<CenterInventoryItem[]>([]);
  const [transfers, setTransfers] = useState<InventoryTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("flow");
  const [detailSearch, setDetailSearch] = useState("");
  const [detailSortKey, setDetailSortKey] = useState<"name" | "sku" | "total" | null>(null);
  const [detailSortDir, setDetailSortDir] = useState<"asc" | "desc">("asc");
  const [selectedCenter, setSelectedCenter] = useState<string | null>(null);

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
    const [{ data: c }, { data: ct }, { data: inv }, { data: tr }] = await Promise.all([
      supabase.from("distribution_centers").select("*").order("is_main", { ascending: false }).order("name"),
      supabase.from("center_contacts").select("*"),
      supabase.from("center_inventory").select("*"),
      supabase.from("inventory_transfers").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    if (c) setCenters(c as DistributionCenter[]);
    if (ct) setContacts(ct as CenterContact[]);
    if (inv) setInventory(inv as CenterInventoryItem[]);
    if (tr) setTransfers(tr as InventoryTransfer[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const mainCenter = centers.find(c => c.is_main);
  const bondedCenters = centers.filter(c => !c.is_main);
  const mgmtCenter = bondedCenters.find(c => c.name.includes("יבואנים"));
  const regularBondedCenters = bondedCenters.filter(c => !c.name.includes("יבואנים"));
  const getContactsForCenter = (centerId: string) => contacts.filter(c => c.center_id === centerId);
  const getTotalQty = (centerId: string) => inventory.filter(i => i.center_id === centerId).reduce((sum, i) => sum + i.quantity, 0);

  // Low stock alerts
  const lowStockAlerts = inventory.filter(i => i.min_stock > 0 && i.quantity < i.min_stock);

  const handleAddCenter = async () => {
    if (!newCenterName.trim()) return;
    await supabase.from("distribution_centers").insert({ name: newCenterName, type: "custom", city: newCenterCity || null, is_main: false } as any);
    setNewCenterName(""); setNewCenterCity(""); setShowAddCenter(false);
    toast.success("מרכז הפצה נוסף"); fetchData();
  };

  const handleDeleteCenter = async (id: string) => {
    await supabase.from("distribution_centers").delete().eq("id", id);
    toast.success("מרכז הפצה נמחק"); fetchData();
  };

  const handleAddContact = async () => {
    if (!newContactName.trim() || !addContactCenterId) return;
    await supabase.from("center_contacts").insert({ center_id: addContactCenterId, name: newContactName, role: newContactRole || null, phone: newContactPhone || null } as any);
    setNewContactName(""); setNewContactRole(""); setNewContactPhone(""); setShowAddContact(false);
    toast.success("איש קשר נוסף"); fetchData();
  };

  const handleUpdateInventory = async (centerId: string, productId: string, qty: number) => {
    const existing = inventory.find(i => i.center_id === centerId && i.product_id === productId);
    if (existing) {
      await supabase.from("center_inventory").update({ quantity: qty } as any).eq("id", existing.id);
    } else {
      await supabase.from("center_inventory").insert({ center_id: centerId, product_id: productId, quantity: qty } as any);
    }
    fetchData();
  };

  const handleUpdateMinStock = async (centerId: string, productId: string, minStock: number) => {
    const existing = inventory.find(i => i.center_id === centerId && i.product_id === productId);
    if (existing) {
      await supabase.from("center_inventory").update({ min_stock: minStock } as any).eq("id", existing.id);
    } else {
      await supabase.from("center_inventory").insert({ center_id: centerId, product_id: productId, quantity: 0, min_stock: minStock } as any);
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

    await supabase.from("center_inventory").update({ quantity: sourceInv.quantity - qty } as any).eq("id", sourceInv.id);

    const destInv = inventory.find(i => i.center_id === transferTo && i.product_id === transferProduct);
    if (destInv) {
      await supabase.from("center_inventory").update({ quantity: destInv.quantity + qty } as any).eq("id", destInv.id);
    } else {
      await supabase.from("center_inventory").insert({ center_id: transferTo, product_id: transferProduct, quantity: qty } as any);
    }

    await supabase.from("inventory_transfers").insert({
      from_center_id: transferFrom,
      to_center_id: transferTo,
      product_id: transferProduct,
      quantity: qty,
      notes: transferNotes || null,
      transferred_by: currentUser?.name || null,
    } as any);

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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowTransfer(true)}>
            <ArrowLeftRight className="h-4 w-4 ml-2" />העבר מלאי
          </Button>
          <Button onClick={() => setShowAddCenter(true)}>
            <Plus className="h-4 w-4 ml-2" />הוסף מרכז הפצה
          </Button>
        </div>
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="flow">זרימת מלאי</TabsTrigger>
          <TabsTrigger value="details">פירוט מלאי</TabsTrigger>
          <TabsTrigger value="transfers" className="flex items-center gap-1">
            <History className="h-3.5 w-3.5" />
            היסטוריית העברות
          </TabsTrigger>
        </TabsList>

        <TabsContent value="flow">
          <FlowVisualization mainCenter={mainCenter} bondedCenters={bondedCenters} inventory={inventory} products={products} />
        </TabsContent>

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
                  onClick={() => {
                    if (detailSortKey === key) {
                      setDetailSortDir(d => d === "asc" ? "desc" : "asc");
                    } else {
                      setDetailSortKey(key);
                      setDetailSortDir("asc");
                    }
                  }}
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
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">מוצר</TableHead>
                    <TableHead className="text-right">SKU</TableHead>
                    {(selectedCenter ? [centers.find(c => c.id === selectedCenter)!].filter(Boolean) : centers).map(c => (
                      <TableHead key={c.id} className="text-center min-w-[140px]">
                        <div>{c.name}</div>
                        <div className="text-[10px] text-muted-foreground font-normal">כמות / מינימום</div>
                      </TableHead>
                    ))}
                    <TableHead className="text-center">סה״כ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
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
                    return filtered.map(p => {
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
                                  <Input
                                    type="number" min={0}
                                    value={inv?.quantity ?? 0}
                                    onChange={e => handleUpdateInventory(c.id, p.id, parseInt(e.target.value) || 0)}
                                    className={`w-16 h-7 text-center text-sm ${isLow ? "border-destructive bg-destructive/5" : ""}`}
                                  />
                                  <span className="text-muted-foreground text-xs">/</span>
                                  <Input
                                    type="number" min={0}
                                    value={inv?.min_stock ?? 0}
                                    onChange={e => handleUpdateMinStock(c.id, p.id, parseInt(e.target.value) || 0)}
                                    className="w-14 h-7 text-center text-xs text-muted-foreground"
                                    title="סף מינימום"
                                  />
                                  {isLow && <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />}
                                </div>
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-bold">{totalForProduct}</TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="transfers" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" />
                היסטוריית העברות ({transfers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transfers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">אין העברות מלאי עדיין</p>
              ) : (
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
              )}
            </CardContent>
          </Card>
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

function FlowVisualization({ mainCenter, bondedCenters, inventory, products }: {
  mainCenter: DistributionCenter | undefined; bondedCenters: DistributionCenter[];
  inventory: CenterInventoryItem[]; products: any[];
}) {
  if (!mainCenter) return null;
  const mainQty = inventory.filter(i => i.center_id === mainCenter.id).reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="space-y-8" dir="rtl">
      {/* Incoming orders → Main center */}
      <div className="flex flex-col items-center gap-4">
        <Card className="w-64 text-center border-dashed border-2 border-muted-foreground/30">
          <CardContent className="py-4">
            <p className="font-medium text-muted-foreground">הזמנות נכנסות</p>
            <p className="text-xs text-muted-foreground">ייבוא מספקים</p>
          </CardContent>
        </Card>
        <ArrowDown className="h-8 w-8 text-primary animate-bounce" />
        <Card className="w-80 text-center border-2 border-primary/40 shadow-lg">
          <CardContent className="py-6">
            <Building2 className="h-8 w-8 mx-auto text-primary mb-2" />
            <p className="font-bold text-lg">{mainCenter.name}</p>
            <p className="text-2xl font-bold text-primary mt-2">{mainQty}</p>
            <p className="text-xs text-muted-foreground">יחידות במלאי</p>
          </CardContent>
        </Card>
        <ArrowDown className="h-8 w-8 text-muted-foreground" />
      </div>

      {/* Bonded centers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bondedCenters.map(center => {
          const centerQty = inventory.filter(i => i.center_id === center.id).reduce((s, i) => s + i.quantity, 0);
          const productCount = inventory.filter(i => i.center_id === center.id && i.quantity > 0).length;
          const lowCount = inventory.filter(i => i.center_id === center.id && i.min_stock > 0 && i.quantity < i.min_stock).length;
          return (
            <Card key={center.id} className={`text-center hover:shadow-md transition-shadow ${lowCount > 0 ? "border-destructive/40" : ""}`}>
              <CardContent className="py-4">
                <Warehouse className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <p className="font-semibold text-sm">{center.name}</p>
                <p className="text-xl font-bold text-foreground mt-1">{centerQty}</p>
                <p className="text-xs text-muted-foreground">{productCount} מוצרים</p>
                {lowCount > 0 && (
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <AlertTriangle className="h-3 w-3 text-destructive" />
                    <span className="text-xs text-destructive">{lowCount} מתחת למינימום</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
