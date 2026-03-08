import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useData, useAuth, type Priority, type OrderStatus } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { OrderStatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";

import { ArrowRight, Package, Boxes, TruckIcon, Pencil, ExternalLink } from "lucide-react";
import ProductIssuesTab from "@/components/ProductIssuesTab";
import ProductEditDialog from "@/components/products/ProductEditDialog";
import SupplierComparisonPanel from "@/components/SupplierComparisonPanel";
import { toast } from "sonner";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { products, orders, updateProduct } = useData();

  const [editOpen, setEditOpen] = useState(false);
  

  const product = products.find(p => p.id === id);

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-lg text-muted-foreground">מוצר לא נמצא</p>
        <Button variant="outline" onClick={() => navigate("/products")}><ArrowRight className="h-4 w-4 ml-2" />חזרה למוצרים</Button>
      </div>
    );
  }

  const relatedOrders = orders.filter(o => o.items.some(item => item.name === product.name || item.product_id === product.id));

  const stockStatus = product.stock_qty === 0
    ? { label: "אזל מהמלאי", className: "bg-destructive/15 text-destructive" }
    : product.monthly_order && product.stock_qty < product.monthly_order
    ? { label: "מלאי נמוך", className: "bg-warning/15 text-warning" }
    : { label: "תקין", className: "bg-success/15 text-success" };

  const details: { label: string; value: string | number | undefined | null }[] = [
    { label: "קטגוריה", value: product.category },
    { label: "חטיבה", value: product.division },
    { label: "מק״ט", value: product.sku },
    { label: "סוג מוצר", value: product.product_type },
    { label: "תיאור", value: product.description },
    { label: "ספק", value: product.supplier },
    { label: "מקור ספק", value: product.supplier_origin },
    { label: "שיטת משלוח", value: product.shipping },
    { label: "מחיר רכישה", value: product.purchase_price ? `$${product.purchase_price}` : undefined },
    { label: "מחיר מכירה", value: product.sale_price ? `$${product.sale_price}` : undefined },
    { label: "מכירות חודשיות", value: product.monthly_sales },
    { label: "הזמנה חודשית", value: product.monthly_order },
    { label: "מלאי קיים", value: product.stock_qty },
    { label: "בדרך", value: product.incoming_qty },
    { label: "הערות", value: product.notes },
  ];

  const openEditDialog = () => {
    setEditFields({
      stock_qty: product.stock_qty,
      incoming_qty: product.incoming_qty,
      purchase_price: product.purchase_price || "",
      sale_price: product.sale_price || "",
      monthly_order: product.monthly_order || "",
      notes: product.notes || "",
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    const updates: Record<string, any> = {};
    for (const key of Object.keys(editFields)) {
      const val = editFields[key];
      updates[key] = val === "" ? null : (typeof val === "string" && !isNaN(Number(val)) && key !== "notes" ? Number(val) : val);
    }
    await updateProduct(product.id, updates);
    toast.success("המוצר עודכן");
    setEditOpen(false);
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
        <Button variant="outline" size="sm" onClick={openEditDialog}><Pencil className="h-4 w-4 ml-1" />עריכה</Button>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${stockStatus.className}`}>{stockStatus.label}</span>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          product.product_type === "מורכב" ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"
        }`}>{product.product_type}</span>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>עריכת מוצר</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            {[
              { key: "stock_qty", label: "מלאי קיים", type: "number" },
              { key: "incoming_qty", label: "בדרך", type: "number" },
              { key: "purchase_price", label: "מחיר רכישה ($)", type: "number" },
              { key: "sale_price", label: "מחיר מכירה ($)", type: "number" },
              { key: "monthly_order", label: "הזמנה חודשית", type: "number" },
            ].map(f => (
              <div key={f.key} className="space-y-1">
                <Label>{f.label}</Label>
                <Input type={f.type} value={editFields[f.key] ?? ""} onChange={e => setEditFields(prev => ({ ...prev, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div className="space-y-1">
              <Label>הערות</Label>
              <Textarea value={editFields.notes ?? ""} onChange={e => setEditFields(prev => ({ ...prev, notes: e.target.value }))} rows={2} />
            </div>
            <Button onClick={handleSaveEdit} className="w-full">שמור שינויים</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="bg-card rounded-xl border shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4"><Package className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold text-foreground">פרטי מוצר</h2></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {details.filter(d => d.value != null && d.value !== "").map(d => (
            <div key={d.label} className="space-y-1">
              <p className="text-xs text-muted-foreground">{d.label}</p>
              <p className="text-sm font-medium text-foreground">{d.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "מלאי קיים", value: product.stock_qty, danger: product.stock_qty === 0 },
          { label: "בדרך", value: product.incoming_qty },
          { label: "מכירות חודשיות", value: product.monthly_sales ?? "—" },
          { label: "הזמנה חודשית", value: product.monthly_order ?? "—" },
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
          <div className="flex items-center gap-2 mb-4"><Boxes className="h-5 w-5 text-accent" /><h2 className="text-lg font-semibold text-foreground">רכיבים (BOM)</h2></div>
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
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {product.components.map(comp => (
                    <tr key={comp.id}>
                      <td className="p-3 font-medium text-foreground">{comp.name}</td>
                      <td className="p-3 text-muted-foreground font-mono text-xs" dir="ltr">{comp.sku || "—"}</td>
                      <td className="p-3 text-muted-foreground">{comp.supplier || "—"}</td>
                      <td className="p-3 text-muted-foreground">{comp.origin || "—"}</td>
                      <td className="p-3 text-muted-foreground">{comp.stock_qty ?? "—"}</td>
                      <td className="p-3 text-muted-foreground">{comp.price ? `$${comp.price}` : "—"}</td>
                      <td className="p-3 text-muted-foreground text-xs">{comp.notes || "—"}</td>
                    </tr>
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
                    <tr key={order.id}>
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
