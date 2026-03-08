import { useParams, useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { useData, useAuth, categories, divisions, type Priority, type OrderStatus } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { OrderStatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Package, Boxes, TruckIcon, Pencil, ExternalLink } from "lucide-react";
import ProductIssuesTab from "@/components/ProductIssuesTab";
import ProductEditDialog from "@/components/products/ProductEditDialog";
import SupplierComparisonPanel from "@/components/SupplierComparisonPanel";
import { InlineEditField } from "@/components/InlineEditField";
import { toast } from "sonner";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { products, orders, updateProduct, suppliers } = useData();
  const [editOpen, setEditOpen] = useState(false);

  // Hooks must be before any early return
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
