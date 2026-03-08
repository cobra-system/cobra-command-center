import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useData, type Priority, type OrderStatus } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { OrderStatusBadge } from "@/components/StatusBadge";
import { Plus, Trash2, CalendarIcon, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { NewOrderDialog } from "@/components/orders/NewOrderDialog";

const allStatuses: { value: OrderStatus; label: string }[] = [
  { value: "PENDING", label: "ממתין" },
  { value: "ORDERED", label: "הוזמן" },
  { value: "SHIPPED", label: "נשלח" },
  { value: "ARRIVED", label: "הגיע" },
  { value: "CANCELLED", label: "בוטל" },
];

const priorities: { value: Priority; label: string }[] = [
  { value: "דחוף", label: "דחוף" },
  { value: "גבוה", label: "גבוה" },
  { value: "בינוני", label: "בינוני" },
  { value: "נמוך", label: "נמוך" },
];

const priorityOrder: Record<string, number> = { "דחוף": 0, "גבוה": 1, "בינוני": 2, "נמוך": 3 };
const statusOrder: Record<string, number> = { PENDING: 0, ORDERED: 1, SHIPPED: 2, ARRIVED: 3, CANCELLED: 4 };

type SortField = "priority" | "product" | "qty" | "supplier" | "shipping" | "status" | "order_date" | "etd" | "eta" | "total_price" | "payment";
type SortDir = "asc" | "desc" | null;

const statusFilterOptions = [
  { value: "all", label: "הכל" },
  ...allStatuses.filter(s => s.value !== "CANCELLED"),
];

export default function OrdersPage() {
  const { orders, updateOrderStatus, addOrder, suppliers, products } = useData();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all"); // all | paid | unpaid

  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") { setSortField(null); setSortDir(null); }
      else setSortDir("asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const filtered = useMemo(() => {
    let result = orders.filter(o => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (priorityFilter !== "all" && o.priority !== priorityFilter) return false;
      if (paymentFilter === "paid" && !o.payment_date) return false;
      if (paymentFilter === "unpaid" && o.payment_date) return false;
      if (search) {
        const q = search.toLowerCase();
        const itemNames = o.items.map(i => i.name).join(" ").toLowerCase();
        const supplier = (o.supplier_name || "").toLowerCase();
        if (!itemNames.includes(q) && !supplier.includes(q)) return false;
      }
      return true;
    });

    if (sortField && sortDir) {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        switch (sortField) {
          case "priority": cmp = (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9); break;
          case "product": cmp = (a.items.map(i => i.name).join(", ")).localeCompare(b.items.map(i => i.name).join(", "), "he"); break;
          case "qty": cmp = a.items.reduce((s, i) => s + i.qty, 0) - b.items.reduce((s, i) => s + i.qty, 0); break;
          case "supplier": cmp = (a.supplier_name || "").localeCompare(b.supplier_name || "", "he"); break;
          case "shipping": cmp = (a.shipping || "").localeCompare(b.shipping || "", "he"); break;
          case "status": cmp = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9); break;
          case "order_date": cmp = (a.order_date || "").localeCompare(b.order_date || ""); break;
          case "etd": cmp = (a.etd || "").localeCompare(b.etd || ""); break;
          case "eta": cmp = (a.eta || "").localeCompare(b.eta || ""); break;
          case "total_price": cmp = (a.total_price || 0) - (b.total_price || 0); break;
          case "payment": cmp = (a.payment_date || "").localeCompare(b.payment_date || ""); break;
        }
        return sortDir === "desc" ? -cmp : cmp;
      });
    }

    return result;
  }, [orders, statusFilter, priorityFilter, paymentFilter, search, sortField, sortDir]);

  const navigateToSupplier = (supplierName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const s = suppliers.find(s => s.company === supplierName);
    if (s) navigate(`/suppliers/${s.id}`);
  };

  const ThButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th className="text-right p-3 font-semibold text-foreground">
      <button onClick={() => toggleSort(field)} className="flex items-center gap-1 hover:text-primary transition-colors">
        {children}
        <SortIcon field={field} />
      </button>
    </th>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">הזמנות</h1>
        <NewOrderDialog suppliers={suppliers} products={products} addOrder={addOrder} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="חיפוש לפי מוצר או ספק..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
        </div>
        <div className="flex bg-secondary rounded-lg p-1">
          {statusFilterOptions.map(s => (
            <button key={s.value} onClick={() => setStatusFilter(s.value)} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              statusFilter === s.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}>{s.label}</button>
          ))}
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="עדיפות" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל העדיפויות</SelectItem>
            {priorities.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-[120px]"><SelectValue placeholder="תשלום" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל התשלומים</SelectItem>
            <SelectItem value="paid">שולם</SelectItem>
            <SelectItem value="unpaid">לא שולם</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <ThButton field="priority">עדיפות</ThButton>
              <ThButton field="product">מוצר</ThButton>
              <ThButton field="qty">כמות</ThButton>
              <ThButton field="supplier">ספק</ThButton>
              <ThButton field="shipping">משלוח</ThButton>
              <ThButton field="status">סטטוס</ThButton>
              <ThButton field="order_date">תאריך הזמנה</ThButton>
              <ThButton field="etd">ETD</ThButton>
              <ThButton field="eta">ETA</ThButton>
              <ThButton field="total_price">סה״כ</ThButton>
              <ThButton field="payment">תשלום</ThButton>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr><td colSpan={11} className="p-8 text-center text-muted-foreground">אין הזמנות</td></tr>
            ) : filtered.map(order => (
              <tr key={order.id} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => navigate(`/orders/${order.id}`)}>
                <td className="p-3"><PriorityBadge priority={order.priority as Priority} /></td>
                <td className="p-3 font-medium text-foreground max-w-[200px] truncate">{order.items.map(i => i.name).join(", ")}</td>
                <td className="p-3 text-muted-foreground">{order.items.reduce((s, i) => s + i.qty, 0)}</td>
                <td className="p-3">
                  {order.supplier_name ? (
                    <button onClick={(e) => navigateToSupplier(order.supplier_name!, e)} className="text-primary hover:underline text-sm">
                      {order.supplier_name}
                    </button>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="p-3 text-muted-foreground">{order.shipping || "—"}</td>
                <td className="p-3" onClick={e => e.stopPropagation()}>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="cursor-pointer"><OrderStatusBadge status={order.status as OrderStatus} /></button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-1" align="start">
                      <div className="flex flex-col gap-0.5">
                        {allStatuses.map(s => (
                          <button
                            key={s.value}
                            onClick={() => updateOrderStatus(order.id, s.value)}
                            className={cn(
                              "px-3 py-1.5 rounded text-xs font-medium text-right transition-colors hover:bg-muted",
                              order.status === s.value && "bg-muted"
                            )}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </td>
                <td className="p-3 text-muted-foreground text-xs">{order.order_date ? new Date(order.order_date).toLocaleDateString("he-IL") : "—"}</td>
                <td className="p-3 text-muted-foreground text-xs">{order.etd ? new Date(order.etd).toLocaleDateString("he-IL") : "—"}</td>
                <td className="p-3 text-muted-foreground text-xs">{order.eta ? new Date(order.eta).toLocaleDateString("he-IL") : "—"}</td>
                <td className="p-3 text-muted-foreground text-xs">{order.total_price ? `$${order.total_price.toLocaleString()}` : "—"}</td>
                <td className="p-3">
                  {order.payment_date ? (
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-success/15 text-success">שולם</span>
                  ) : (
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-warning/15 text-warning">ממתין</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
