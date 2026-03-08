import { useParams, useNavigate } from "react-router-dom";
import { useData, type Priority, type OrderStatus } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { OrderStatusBadge } from "@/components/StatusBadge";
import { ArrowRight, Package, Truck, Calendar, DollarSign, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const allStatuses: { value: OrderStatus; label: string }[] = [
  { value: "PENDING", label: "ממתין" },
  { value: "ORDERED", label: "הוזמן" },
  { value: "SHIPPED", label: "נשלח" },
  { value: "ARRIVED", label: "הגיע" },
  { value: "CANCELLED", label: "בוטל" },
];

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { orders, updateOrderStatus, suppliers, products } = useData();

  const order = orders.find(o => o.id === id);
  if (!order) return <div className="p-8 text-center text-muted-foreground">הזמנה לא נמצאה</div>;

  const supplier = order.supplier_id ? suppliers.find(s => s.id === order.supplier_id) : null;

  const InfoCard = ({ icon: Icon, label, value }: { icon: any; label: string; value: string | React.ReactNode }) => (
    <div className="bg-card rounded-xl border p-4 space-y-1">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="text-sm font-semibold text-foreground">{value}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/orders")}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">תיק הזמנה</h1>
          <p className="text-sm text-muted-foreground">
            {order.items.map(i => i.name).join(", ")}
          </p>
        </div>
        <PriorityBadge priority={order.priority as Priority} />
      </div>

      {/* Status + quick info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border p-4 space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">סטטוס</div>
          <Select value={order.status} onValueChange={v => updateOrderStatus(order.id, v as OrderStatus)}>
            <SelectTrigger className="h-8">
              <SelectValue>
                <OrderStatusBadge status={order.status as OrderStatus} />
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {allStatuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <InfoCard
          icon={Truck}
          label="ספק"
          value={
            supplier ? (
              <button onClick={() => navigate(`/suppliers/${supplier.id}`)} className="text-primary hover:underline">
                {supplier.company}
              </button>
            ) : order.supplier_name || "—"
          }
        />
        <InfoCard icon={Calendar} label="תאריך הזמנה" value={order.order_date ? new Date(order.order_date).toLocaleDateString("he-IL") : "—"} />
        <InfoCard icon={DollarSign} label="סה״כ" value={order.total_price ? `$${order.total_price.toLocaleString()}` : "—"} />
      </div>

      {/* Dates & shipping */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <InfoCard icon={Calendar} label="ETD (יציאה)" value={order.etd ? new Date(order.etd).toLocaleDateString("he-IL") : "—"} />
        <InfoCard icon={Calendar} label="ETA (הגעה)" value={order.eta ? new Date(order.eta).toLocaleDateString("he-IL") : "—"} />
        <InfoCard icon={Truck} label="שיטת משלוח" value={order.shipping || "—"} />
      </div>

      {/* Items */}
      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center gap-2">
          <Package className="h-4 w-4 text-accent" />
          <h2 className="font-semibold text-foreground">פריטים ({order.items.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-right p-3 font-semibold text-foreground">מוצר</th>
              <th className="text-right p-3 font-semibold text-foreground">כמות</th>
              <th className="text-right p-3 font-semibold text-foreground">מחיר יחידה</th>
              <th className="text-right p-3 font-semibold text-foreground">סה״כ</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {order.items.map(item => {
              const linkedProduct = item.product_id ? products.find(p => p.id === item.product_id) : products.find(p => p.name === item.name);
              return (
                <tr key={item.id} className={linkedProduct ? "cursor-pointer hover:bg-muted/30" : ""} onClick={() => linkedProduct && navigate(`/products/${linkedProduct.id}`)}>
                  <td className="p-3 font-medium text-foreground">
                    {linkedProduct ? (
                      <span className="text-primary hover:underline">{item.name}</span>
                    ) : item.name}
                  </td>
                  <td className="p-3 text-muted-foreground">{item.qty}</td>
                  <td className="p-3 text-muted-foreground">{item.price ? `$${item.price}` : "—"}</td>
                  <td className="p-3 text-muted-foreground">{item.price ? `$${(item.price * item.qty).toLocaleString()}` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Notes */}
      {order.notes && (
        <div className="bg-card rounded-xl border p-4 space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
            <FileText className="h-3.5 w-3.5" />
            הערות
          </div>
          <p className="text-sm text-foreground whitespace-pre-wrap">{order.notes}</p>
        </div>
      )}
    </div>
  );
}
