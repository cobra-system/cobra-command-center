import { useParams, useNavigate } from "react-router-dom";
import { useData } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { OrderStatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Package, Boxes, TruckIcon, AlertTriangle } from "lucide-react";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { products, orders } = useData();

  const product = products.find(p => p.id === id);
  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-lg text-muted-foreground">מוצר לא נמצא</p>
        <Button variant="outline" onClick={() => navigate("/products")}>
          <ArrowRight className="h-4 w-4 ml-2" />חזרה למוצרים
        </Button>
      </div>
    );
  }

  // Find related orders
  const relatedOrders = orders.filter(o =>
    o.items.some(item => item.name === product.name || item.productId === product.id)
  );

  const stockStatus = product.stockQty === 0
    ? { label: "אזל מהמלאי", className: "bg-destructive/15 text-destructive" }
    : product.monthlyOrder && product.stockQty < product.monthlyOrder
    ? { label: "מלאי נמוך", className: "bg-warning/15 text-warning" }
    : { label: "תקין", className: "bg-success/15 text-success" };

  const details: { label: string; value: string | number | undefined }[] = [
    { label: "קטגוריה", value: product.category },
    { label: "חטיבה", value: product.division },
    { label: "מק״ט", value: product.sku },
    { label: "סוג מוצר", value: product.productType },
    { label: "תיאור", value: product.description },
    { label: "ספק", value: product.supplier },
    { label: "מקור ספק", value: product.supplierOrigin },
    { label: "שיטת משלוח", value: product.shipping },
    { label: "מחיר רכישה", value: product.purchasePrice ? `$${product.purchasePrice}` : undefined },
    { label: "מחיר מכירה", value: product.salePrice ? `$${product.salePrice}` : undefined },
    { label: "מכירות חודשיות", value: product.monthlySales },
    { label: "הזמנה חודשית", value: product.monthlyOrder },
    { label: "מלאי קיים", value: product.stockQty },
    { label: "בדרך", value: product.incomingQty },
    { label: "הערות", value: product.notes },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/products")}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{product.name}</h1>
          <p className="text-sm text-muted-foreground font-mono" dir="ltr">{product.sku}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${stockStatus.className}`}>
          {stockStatus.label}
        </span>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          product.productType === "מורכב" ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"
        }`}>
          {product.productType}
        </span>
      </div>

      {/* Details grid */}
      <div className="bg-card rounded-xl border shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Package className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">פרטי מוצר</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {details.filter(d => d.value !== undefined && d.value !== "").map(d => (
            <div key={d.label} className="space-y-1">
              <p className="text-xs text-muted-foreground">{d.label}</p>
              <p className="text-sm font-medium text-foreground">{d.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stock indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "מלאי קיים", value: product.stockQty, icon: Boxes, danger: product.stockQty === 0 },
          { label: "בדרך", value: product.incomingQty, icon: TruckIcon },
          { label: "מכירות חודשיות", value: product.monthlySales ?? "—" },
          { label: "הזמנה חודשית", value: product.monthlyOrder ?? "—", icon: product.monthlyOrder && product.stockQty < product.monthlyOrder ? AlertTriangle : undefined },
        ].map((item) => (
          <div key={item.label} className="bg-card rounded-xl border p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
            <p className={`text-2xl font-bold ${item.danger ? "text-destructive" : "text-foreground"}`}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Components (for מורכב products) */}
      {product.productType === "מורכב" && (
        <div className="bg-card rounded-xl border shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Boxes className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold text-foreground">רכיבים</h2>
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
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {product.components.map(comp => (
                    <tr key={comp.id}>
                      <td className="p-3 font-medium text-foreground">{comp.name}</td>
                      <td className="p-3 text-muted-foreground font-mono text-xs" dir="ltr">{comp.sku || "—"}</td>
                      <td className="p-3 text-muted-foreground">{comp.supplier || "—"}</td>
                      <td className="p-3 text-muted-foreground">{comp.origin || "—"}</td>
                      <td className="p-3 text-muted-foreground">{comp.stockQty ?? "—"}</td>
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
        </div>
      )}

      {/* Related orders */}
      <div className="bg-card rounded-xl border shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <TruckIcon className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">היסטוריית הזמנות</h2>
        </div>
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
                  const relevantItem = order.items.find(i => i.name === product.name || i.productId === product.id);
                  return (
                    <tr key={order.id}>
                      <td className="p-3"><PriorityBadge priority={order.priority} /></td>
                      <td className="p-3 text-muted-foreground">{order.supplierName || "—"}</td>
                      <td className="p-3 text-muted-foreground">{relevantItem?.qty || "—"}</td>
                      <td className="p-3"><OrderStatusBadge status={order.status} /></td>
                      <td className="p-3 text-muted-foreground text-xs">
                        {order.eta ? new Date(order.eta).toLocaleDateString("he-IL") : "—"}
                      </td>
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
    </div>
  );
}
