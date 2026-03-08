import { useState, useEffect, useCallback } from "react";
import { useData } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Warehouse, ArrowDown, ArrowRight, Phone, User, Pencil, Trash2, Building2 } from "lucide-react";
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
}

export default function InventoryPage() {
  const { products } = useData();
  const [centers, setCenters] = useState<DistributionCenter[]>([]);
  const [contacts, setContacts] = useState<CenterContact[]>([]);
  const [inventory, setInventory] = useState<CenterInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedCenter, setSelectedCenter] = useState<string | null>(null);

  // Add center dialog
  const [showAddCenter, setShowAddCenter] = useState(false);
  const [newCenterName, setNewCenterName] = useState("");
  const [newCenterCity, setNewCenterCity] = useState("");

  // Add contact dialog
  const [showAddContact, setShowAddContact] = useState(false);
  const [addContactCenterId, setAddContactCenterId] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [newContactRole, setNewContactRole] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: c }, { data: ct }, { data: inv }] = await Promise.all([
      supabase.from("distribution_centers").select("*").order("is_main", { ascending: false }).order("name"),
      supabase.from("center_contacts").select("*"),
      supabase.from("center_inventory").select("*"),
    ]);
    if (c) setCenters(c as DistributionCenter[]);
    if (ct) setContacts(ct as CenterContact[]);
    if (inv) setInventory(inv as CenterInventoryItem[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const mainCenter = centers.find(c => c.is_main);
  const bondedCenters = centers.filter(c => !c.is_main);

  const getContactsForCenter = (centerId: string) => contacts.filter(c => c.center_id === centerId);
  const getInventoryForCenter = (centerId: string) => inventory.filter(i => i.center_id === centerId);

  const getTotalQty = (centerId: string) => {
    return getInventoryForCenter(centerId).reduce((sum, i) => sum + i.quantity, 0);
  };

  const handleAddCenter = async () => {
    if (!newCenterName.trim()) return;
    await supabase.from("distribution_centers").insert({
      name: newCenterName,
      type: "custom",
      city: newCenterCity || null,
      is_main: false,
    } as any);
    setNewCenterName("");
    setNewCenterCity("");
    setShowAddCenter(false);
    toast.success("מרכז הפצה נוסף");
    fetchData();
  };

  const handleDeleteCenter = async (id: string) => {
    await supabase.from("distribution_centers").delete().eq("id", id);
    toast.success("מרכז הפצה נמחק");
    fetchData();
  };

  const handleAddContact = async () => {
    if (!newContactName.trim() || !addContactCenterId) return;
    await supabase.from("center_contacts").insert({
      center_id: addContactCenterId,
      name: newContactName,
      role: newContactRole || null,
      phone: newContactPhone || null,
    } as any);
    setNewContactName("");
    setNewContactRole("");
    setNewContactPhone("");
    setShowAddContact(false);
    toast.success("איש קשר נוסף");
    fetchData();
  };

  const handleUpdateInventory = async (centerId: string, productId: string, qty: number) => {
    const existing = inventory.find(i => i.center_id === centerId && i.product_id === productId);
    if (existing) {
      await supabase.from("center_inventory").update({ quantity: qty } as any).eq("id", existing.id);
    } else {
      await supabase.from("center_inventory").insert({
        center_id: centerId,
        product_id: productId,
        quantity: qty,
      } as any);
    }
    fetchData();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">טוען...</div>;
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">מלאי ומרכזי הפצה</h1>
          <p className="text-muted-foreground text-sm">{centers.length} מרכזים · {products.length} מוצרים</p>
        </div>
        <Button onClick={() => setShowAddCenter(true)}>
          <Plus className="h-4 w-4 ml-2" />
          הוסף מרכז הפצה
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">סקירה כללית</TabsTrigger>
          <TabsTrigger value="flow">זרימת מלאי</TabsTrigger>
          <TabsTrigger value="details">פירוט מלאי</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Main center card */}
          {mainCenter && (
            <Card className="border-2 border-primary/30">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{mainCenter.name}</CardTitle>
                  <Badge variant="default">ראשי</Badge>
                  {mainCenter.city && <span className="text-sm text-muted-foreground">· {mainCenter.city}</span>}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 mb-3">
                  {getContactsForCenter(mainCenter.id).map(ct => (
                    <div key={ct.id} className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg px-3 py-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{ct.name}</span>
                      {ct.role && <span className="text-muted-foreground">({ct.role})</span>}
                      {ct.phone && <span className="text-muted-foreground">{ct.phone}</span>}
                    </div>
                  ))}
                  <Button size="sm" variant="ghost" onClick={() => { setAddContactCenterId(mainCenter.id); setShowAddContact(true); }}>
                    <Plus className="h-3 w-3 ml-1" /> איש קשר
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">סה"כ יחידות: <strong className="text-foreground">{getTotalQty(mainCenter.id)}</strong></p>
              </CardContent>
            </Card>
          )}

          {/* Bonded centers grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bondedCenters.map(center => (
              <Card key={center.id} className="relative group">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Warehouse className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base">{center.name}</CardTitle>
                    </div>
                    {!center.is_main && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteCenter(center.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <Badge variant="secondary" className="w-fit text-xs">{center.type === 'bonded' ? 'בונדד' : center.type === 'custom' ? 'מותאם' : 'ראשי'}</Badge>
                </CardHeader>
                <CardContent className="space-y-2">
                  {getContactsForCenter(center.id).map(ct => (
                    <div key={ct.id} className="flex items-center gap-2 text-xs">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{ct.name}</span>
                      {ct.role && <span className="text-muted-foreground">· {ct.role}</span>}
                      {ct.phone && (
                        <a href={`tel:${ct.phone}`} className="text-primary hover:underline flex items-center gap-1 mr-auto">
                          <Phone className="h-3 w-3" />{ct.phone}
                        </a>
                      )}
                    </div>
                  ))}
                  <Button size="sm" variant="ghost" className="text-xs h-6" onClick={() => { setAddContactCenterId(center.id); setShowAddContact(true); }}>
                    <Plus className="h-3 w-3 ml-1" /> איש קשר
                  </Button>
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">סה"כ יחידות: <strong className="text-foreground">{getTotalQty(center.id)}</strong></p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="flow">
          <FlowVisualization
            mainCenter={mainCenter}
            bondedCenters={bondedCenters}
            inventory={inventory}
            products={products}
          />
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={selectedCenter === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCenter(null)}
            >
              כל המרכזים
            </Button>
            {centers.map(c => (
              <Button
                key={c.id}
                variant={selectedCenter === c.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCenter(c.id)}
              >
                {c.name}
              </Button>
            ))}
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>מוצר</TableHead>
                  <TableHead>SKU</TableHead>
                  {(selectedCenter ? [centers.find(c => c.id === selectedCenter)!] : centers).map(c => (
                    <TableHead key={c.id} className="text-center">{c.name}</TableHead>
                  ))}
                  <TableHead className="text-center">סה"כ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map(p => {
                  const displayCenters = selectedCenter ? [centers.find(c => c.id === selectedCenter)!] : centers;
                  const totalForProduct = displayCenters.reduce((sum, c) => {
                    const inv = inventory.find(i => i.center_id === c.id && i.product_id === p.id);
                    return sum + (inv?.quantity || 0);
                  }, 0);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{p.sku}</TableCell>
                      {displayCenters.map(c => {
                        const inv = inventory.find(i => i.center_id === c.id && i.product_id === p.id);
                        return (
                          <TableCell key={c.id} className="text-center">
                            <Input
                              type="number"
                              min={0}
                              value={inv?.quantity ?? 0}
                              onChange={e => handleUpdateInventory(c.id, p.id, parseInt(e.target.value) || 0)}
                              className="w-20 h-7 text-center mx-auto text-sm"
                            />
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-bold">{totalForProduct}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Center Dialog */}
      <Dialog open={showAddCenter} onOpenChange={setShowAddCenter}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>הוסף מרכז הפצה</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="שם המרכז" value={newCenterName} onChange={e => setNewCenterName(e.target.value)} />
            <Input placeholder="עיר (אופציונלי)" value={newCenterCity} onChange={e => setNewCenterCity(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={handleAddCenter}>הוסף</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Contact Dialog */}
      <Dialog open={showAddContact} onOpenChange={setShowAddContact}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>הוסף איש קשר</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="שם" value={newContactName} onChange={e => setNewContactName(e.target.value)} />
            <Input placeholder="תפקיד" value={newContactRole} onChange={e => setNewContactRole(e.target.value)} />
            <Input placeholder="טלפון" value={newContactPhone} onChange={e => setNewContactPhone(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={handleAddContact}>הוסף</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Flow visualization component
function FlowVisualization({
  mainCenter,
  bondedCenters,
  inventory,
  products,
}: {
  mainCenter: DistributionCenter | undefined;
  bondedCenters: DistributionCenter[];
  inventory: CenterInventoryItem[];
  products: any[];
}) {
  if (!mainCenter) return null;

  const mainQty = inventory.filter(i => i.center_id === mainCenter.id).reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="space-y-8">
      {/* Incoming orders */}
      <div className="flex flex-col items-center gap-4">
        <Card className="w-64 text-center border-dashed border-2 border-muted-foreground/30">
          <CardContent className="py-4">
            <p className="font-medium text-muted-foreground">הזמנות נכנסות</p>
            <p className="text-xs text-muted-foreground">ייבוא מספקים</p>
          </CardContent>
        </Card>

        <div className="flex flex-col items-center">
          <ArrowDown className="h-8 w-8 text-primary animate-bounce" />
        </div>

        {/* Main distribution center */}
        <Card className="w-80 text-center border-2 border-primary/40 shadow-lg">
          <CardContent className="py-6">
            <Building2 className="h-8 w-8 mx-auto text-primary mb-2" />
            <p className="font-bold text-lg">{mainCenter.name}</p>
            <p className="text-2xl font-bold text-primary mt-2">{mainQty}</p>
            <p className="text-xs text-muted-foreground">יחידות במלאי</p>
          </CardContent>
        </Card>

        <div className="flex flex-col items-center">
          <ArrowDown className="h-8 w-8 text-muted-foreground" />
        </div>
      </div>

      {/* Bonded distribution centers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {bondedCenters.map(center => {
          const centerQty = inventory.filter(i => i.center_id === center.id).reduce((s, i) => s + i.quantity, 0);
          const productCount = inventory.filter(i => i.center_id === center.id && i.quantity > 0).length;

          return (
            <div key={center.id} className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-1 text-muted-foreground">
                <ArrowRight className="h-5 w-5" />
              </div>
              <Card className="w-full text-center hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <Warehouse className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                  <p className="font-semibold text-sm">{center.name}</p>
                  <p className="text-xl font-bold text-foreground mt-1">{centerQty}</p>
                  <p className="text-xs text-muted-foreground">{productCount} מוצרים</p>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
