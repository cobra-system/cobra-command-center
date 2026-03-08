import { useParams, useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { useData, useAuth, categories, divisions, type ProductComponent, type Priority, type OrderStatus } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { OrderStatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowRight, Package, Boxes, TruckIcon, Pencil, ExternalLink, Plus, Trash2, Save, X } from "lucide-react";
import ProductIssuesTab from "@/components/ProductIssuesTab";
import ProductEditDialog from "@/components/products/ProductEditDialog";
import SupplierComparisonPanel from "@/components/SupplierComparisonPanel";
import { InlineEditField } from "@/components/InlineEditField";
import SapSyncBadge from "@/components/SapSyncBadge";
import { toast } from "sonner";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { products, orders, updateProduct, suppliers, addComponent, updateComponent, deleteComponent } = useData();
  const [editOpen, setEditOpen] = useState(false);
  const [addCompOpen, setAddCompOpen] = useState(false);
  const [editingCompId, setEditingCompId] = useState<string | null>(null);
  const [editCompFields, setEditCompFields] = useState<Record<string, string>>({});
  const [newComp, setNewComp] = useState({ name: "", sku: "", supplier: "", origin: "", stock_qty: "", price: "", notes: "" });
  const [savingComp, setSavingComp] = useState(false);

  const categoryOptions = useMemo(() => categories.filter(c => c !== "הכל").map(c => ({ value: c, label: c })), []);
  const supplierOptions = useMemo(() => suppliers.map(s => ({ value: s.company, label: s.company })), [suppliers]);
  const divisionOptions = useMemo(() => divisions.map(d => ({ value: d, label: d })), []);
  const productTypeOptions = [{ value: "פשוט", label: "פשוט" }, { value: "מורכב", label: "מורכב" }];
  const shippingOptions = [
    { value: "ים", label: "ים" }, { value: "אוויר", label: "אוויר" },
    { value: "יבשה", label: "יבשה" }, { value: "אקספרס", label: "אקספרס" },
  ];

  const product = products.find(p => p.id === id);
  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-lg text-muted-foreground">מוצר לא נמצא</p>
        <Button variant="outline" onClick={() => navigate("/products")}><ArrowRight className="h-4 w-4 ml-2" />חזרה למוצרים</Button>
      </div>
    );
  }

  const isManager = currentUser?.role === "MANAGER";
  const relatedOrders = orders.filter(o => o.items.some(item => item.name === product.name || item.product_id === product.id));

  const stockStatus = product.stock_qty === 0
    ? { label: "אזל מהמלאי", className: "bg-destructive/15 text-destructive" }
    : product.monthly_order && product.stock_qty < product.monthly_order
    ? { label: "מלאי נמוך", className: "bg-warning/15 text-warning" }
    : { label: "תקין", className: "bg-success/15 text-success" };

  const handleInlineSave = async (field: string, value: string) => {
    const numericFields = ["purchase_price", "sale_price", "monthly_sales", "monthly_order", "stock_qty", "incoming_qty"];
    const updates: Record<string, any> = {};
    updates[field] = numericFields.includes(field) ? (value ? Number(value) : null) : (value || null);
    await updateProduct(product.id, updates);
    toast.success("עודכן");
  };

  const details: { label: string; field: string; value: string | number | undefined | null; isSupplierLink?: boolean; options?: { value: string; label: string }[]; multiSelect?: boolean }[] = [
    { label: "קטגוריה", field: "category", value: product.category, options: categoryOptions },
    { label: "חטיבות", field: "division", value: product.division, options: divisionOptions, multiSelect: true },
    { label: "מק״ט", field: "sku", value: product.sku },
    { label: "סוג מוצר", field: "product_type", value: product.product_type, options: productTypeOptions },
    { label: "תיאור", field: "description", value: product.description },
    { label: "ספק", field: "supplier", value: product.supplier, isSupplierLink: true, options: supplierOptions },
    { label: "מקור ספק", field: "supplier_origin", value: product.supplier_origin },
    { label: "שיטת משלוח", field: "shipping", value: product.shipping, options: shippingOptions },
    { label: "מחיר רכישה", field: "purchase_price", value: product.purchase_price },
    { label: "מחיר מכירה", field: "sale_price", value: product.sale_price },
    { label: "מכירות חודשיות", field: "monthly_sales", value: product.monthly_sales },
    { label: "הזמנה חודשית", field: "monthly_order", value: product.monthly_order },
    { label: "מלאי קיים", field: "stock_qty", value: product.stock_qty },
    { label: "בדרך", field: "incoming_qty", value: product.incoming_qty },
    { label: "הערות", field: "notes", value: product.notes },
  ];

  const handleSaveEdit = async (id: string, updates: Record<string, any>) => {
    await updateProduct(id, updates);
    toast.success("המוצר עודכן");
  };

  const handleAddComponent = async () => {
    if (!newComp.name.trim()) return;
    setSavingComp(true);
    try {
      await addComponent({
        product_id: product.id,
        name: newComp.name,
        sku: newComp.sku || null,
        supplier: newComp.supplier || null,
        origin: newComp.origin || null,
        stock_qty: newComp.stock_qty ? Number(newComp.stock_qty) : null,
        price: newComp.price ? Number(newComp.price) : null,
        notes: newComp.notes || null,
      });
      setNewComp({ name: "", sku: "", supplier: "", origin: "", stock_qty: "", price: "", notes: "" });
      setAddCompOpen(false);
      toast.success("רכיב נוסף");
    } finally {
      setSavingComp(false);
    }
  };

  const startEditComp = (comp: ProductComponent) => {
    setEditingCompId(comp.id);
    setEditCompFields({
      name: comp.name || "",
      sku: comp.sku || "",
      supplier: comp.supplier || "",
      origin: comp.origin || "",
      stock_qty: comp.stock_qty?.toString() || "",
      price: comp.price?.toString() || "",
      notes: comp.notes || "",
    });
  };

  const handleSaveComp = async () => {
    if (!editingCompId) return;
    setSavingComp(true);
    try {
      await updateComponent(editingCompId, {
        name: editCompFields.name,
        sku: editCompFields.sku || null,
        supplier: editCompFields.supplier || null,
        origin: editCompFields.origin || null,
        stock_qty: editCompFields.stock_qty ? Number(editCompFields.stock_qty) : null,
        price: editCompFields.price ? Number(editCompFields.price) : null,
        notes: editCompFields.notes || null,
      });
      setEditingCompId(null);
      toast.success("רכיב עודכן");
    } finally {
      setSavingComp(false);
    }
  };

  const handleDeleteComp = async (compId: string) => {
    await deleteComponent(compId);
    toast.success("רכיב נמחק");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/products")}><ArrowRight className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{product.name}</h1>
          <p className="text-sm text-muted-foreground font-mono" dir="ltr">{product.sku}</p>
        </div>
        {product.end_product_url && (
          <Button variant="outline" size="sm" asChild>
            <a href={product.end_product_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 ml-1" />אתר המוצר</a>
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4 ml-1" />עריכה</Button>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${stockStatus.className}`}>{stockStatus.label}</span>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          product.product_type === "מורכב" ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"
        }`}>{product.product_type}</span>
        <SapSyncBadge sapCode={(product as any).sap_code} />
      </div>

      <ProductEditDialog open={editOpen} onOpenChange={setEditOpen} product={product} onSave={handleSaveEdit} />

      <div className="bg-card rounded-xl border shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4"><Package className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold text-foreground">פרטי מוצר</h2></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {details.filter(d => d.value != null && d.value !== "").map(d => {
            const supplierMatch = d.isSupplierLink && typeof d.value === "string" ? suppliers.find(s => s.company === d.value) : null;

            return (
              <InlineEditField
                key={d.label}
                label={d.label}
                value={d.value}
                displayValue={
                  supplierMatch ? (
                    <button onClick={() => navigate(`/suppliers/${supplierMatch.id}`)} className="text-sm font-medium text-primary hover:underline">
                      {d.value}
                    </button>
                  ) : d.field === "purchase_price" || d.field === "sale_price" ? (d.value ? `$${d.value}` : "—") : undefined
                }
                type={["purchase_price", "sale_price", "monthly_sales", "monthly_order", "stock_qty", "incoming_qty"].includes(d.field) ? "number" : "text"}
                onSave={(v) => handleInlineSave(d.field, v)}
                disabled={!isManager}
                options={d.options}
                multiSelect={d.multiSelect}
              />
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "מלאי קיים", field: "stock_qty", value: product.stock_qty, danger: product.stock_qty === 0 },
          { label: "בדרך", field: "incoming_qty", value: product.incoming_qty },
          { label: "מכירות חודשיות", field: "monthly_sales", value: product.monthly_sales ?? "—" },
          { label: "הזמנה חודשית", field: "monthly_order", value: product.monthly_order ?? "—" },
        ].map((item) => (
          <div key={item.label} className="bg-card rounded-xl border p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
            <p className={`text-2xl font-bold ${item.danger ? "text-destructive" : "text-foreground"}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* BOM - Components */}
      {product.product_type === "מורכב" && (
        <div className="bg-card rounded-xl border shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Boxes className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-semibold text-foreground">רכיבים (BOM)</h2>
            </div>
            {isManager && (
              <Button variant="outline" size="sm" onClick={() => setAddCompOpen(true)}>
                <Plus className="h-4 w-4 ml-1" />הוסף רכיב
              </Button>
            )}
          </div>
          {product.components && product.components.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-right p-3 font-semibold text-foreground">רכיב</th>
                    <th className="text-right p-3 font-semibold text-foreground">מק״ט</th>
                    <th className="text-right p-3 font-semibold text-foreground">ספק</th>
                    <th className="text-right p-3 font-semibold text-foreground">מקור</th>
                    <th className="text-right p-3 font-semibold text-foreground">מלאי</th>
                    <th className="text-right p-3 font-semibold text-foreground">מחיר</th>
                    <th className="text-right p-3 font-semibold text-foreground">הערות</th>
                    {isManager && <th className="text-right p-3 font-semibold text-foreground">פעולות</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {product.components.map(comp => (
                    editingCompId === comp.id ? (
                      <tr key={comp.id} className="bg-accent/5">
                        <td className="p-2"><Input value={editCompFields.name} onChange={e => setEditCompFields(p => ({ ...p, name: e.target.value }))} className="h-8 text-sm" /></td>
                        <td className="p-2"><Input value={editCompFields.sku} onChange={e => setEditCompFields(p => ({ ...p, sku: e.target.value }))} className="h-8 text-sm" dir="ltr" /></td>
                        <td className="p-2">
                          <Select value={editCompFields.supplier || "__none__"} onValueChange={v => setEditCompFields(p => ({ ...p, supplier: v === "__none__" ? "" : v }))}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="בחר ספק" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">ללא</SelectItem>
                              {suppliers.map(s => <SelectItem key={s.id} value={s.company}>{s.company}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2"><Input value={editCompFields.origin} onChange={e => setEditCompFields(p => ({ ...p, origin: e.target.value }))} className="h-8 text-sm" /></td>
                        <td className="p-2"><Input type="number" value={editCompFields.stock_qty} onChange={e => setEditCompFields(p => ({ ...p, stock_qty: e.target.value }))} className="h-8 text-sm w-20" /></td>
                        <td className="p-2"><Input type="number" value={editCompFields.price} onChange={e => setEditCompFields(p => ({ ...p, price: e.target.value }))} className="h-8 text-sm w-20" /></td>
                        <td className="p-2"><Input value={editCompFields.notes} onChange={e => setEditCompFields(p => ({ ...p, notes: e.target.value }))} className="h-8 text-sm" /></td>
                        <td className="p-2">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveComp} disabled={savingComp}>
                              <Save className="h-3.5 w-3.5 text-success" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingCompId(null)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={comp.id}>
                        <td className="p-3 font-medium text-foreground">{comp.name}</td>
                        <td className="p-3 text-muted-foreground font-mono text-xs" dir="ltr">{comp.sku || "—"}</td>
                        <td className="p-3 text-muted-foreground">{comp.supplier || "—"}</td>
                        <td className="p-3 text-muted-foreground">{comp.origin || "—"}</td>
                        <td className="p-3 text-muted-foreground">{comp.stock_qty ?? "—"}</td>
                        <td className="p-3 text-muted-foreground">{comp.price ? `$${comp.price}` : "—"}</td>
                        <td className="p-3 text-muted-foreground text-xs">{comp.notes || "—"}</td>
                        {isManager && (
                          <td className="p-3">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditComp(comp)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteComp(comp.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">לא הוגדרו רכיבים למוצר זה</p>
          )}
          {product.components && product.components.length > 0 && (
            <div className="mt-4 space-y-3">
              {product.components.map(comp => (
                <SupplierComparisonPanel key={comp.id} componentName={comp.name} productId={product.id} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Component Dialog */}
      <Dialog open={addCompOpen} onOpenChange={setAddCompOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>הוספת רכיב</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">שם רכיב *</Label>
                <Input value={newComp.name} onChange={e => setNewComp(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">מק״ט</Label>
                <Input value={newComp.sku} onChange={e => setNewComp(p => ({ ...p, sku: e.target.value }))} dir="ltr" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">ספק</Label>
                <Input value={newComp.supplier} onChange={e => setNewComp(p => ({ ...p, supplier: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">מקור</Label>
                <Input value={newComp.origin} onChange={e => setNewComp(p => ({ ...p, origin: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">מלאי</Label>
                <Input type="number" value={newComp.stock_qty} onChange={e => setNewComp(p => ({ ...p, stock_qty: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">מחיר ($)</Label>
                <Input type="number" value={newComp.price} onChange={e => setNewComp(p => ({ ...p, price: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">הערות</Label>
              <Input value={newComp.notes} onChange={e => setNewComp(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <Button onClick={handleAddComponent} className="w-full" disabled={savingComp || !newComp.name.trim()}>
              {savingComp ? "שומר..." : "הוסף רכיב"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Orders History */}
      <div className="bg-card rounded-xl border shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4"><TruckIcon className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold text-foreground">היסטוריית הזמנות</h2></div>
        {relatedOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-right p-3 font-semibold text-foreground">עדיפות</th>
                  <th className="text-right p-3 font-semibold text-foreground">ספק</th>
                  <th className="text-right p-3 font-semibold text-foreground">כמות</th>
                  <th className="text-right p-3 font-semibold text-foreground">סטטוס</th>
                  <th className="text-right p-3 font-semibold text-foreground">ETA</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {relatedOrders.map(order => {
                  const relevantItem = order.items.find(i => i.name === product.name || i.product_id === product.id);
                  return (
                    <tr key={order.id} className="cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/orders/${order.id}`)}>
                      <td className="p-3"><PriorityBadge priority={order.priority as Priority} /></td>
                      <td className="p-3 text-muted-foreground">{order.supplier_name || "—"}</td>
                      <td className="p-3 text-muted-foreground">{relevantItem?.qty || "—"}</td>
                      <td className="p-3"><OrderStatusBadge status={order.status as OrderStatus} /></td>
                      <td className="p-3 text-muted-foreground text-xs">{order.eta ? new Date(order.eta).toLocaleDateString("he-IL") : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">אין הזמנות קשורות למוצר זה</p>
        )}
      </div>

      {/* Product Issues Tab */}
      <div className="bg-card rounded-xl border shadow-sm p-5">
        <ProductIssuesTab productId={product.id} />
      </div>
    </div>
  );
}
