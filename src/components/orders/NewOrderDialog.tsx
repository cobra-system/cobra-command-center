import { useState } from "react";
import { type Priority, type Order, type OrderItem, type Supplier, type Product } from "@/contexts/AppContext";
import { Plus, Trash2, CalendarIcon } from "lucide-react";
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

const priorities: { value: Priority; label: string }[] = [
  { value: "P0", label: "P0 — דחוף" },
  { value: "P1", label: "P1 — גבוה" },
  { value: "P2", label: "P2 — רגיל" },
  { value: "P3", label: "P3 — נמוך" },
];

interface ItemRow { name: string; qty: string; price: string; productId: string; }

interface Props {
  suppliers: Supplier[];
  products: Product[];
  addOrder: (order: Omit<Order, "id" | "items"> & { items: Omit<OrderItem, "id" | "order_id">[] }) => Promise<void>;
}

export function NewOrderDialog({ suppliers, products, addOrder }: Props) {
  const [open, setOpen] = useState(false);
  const [priority, setPriority] = useState<Priority>("P2");
  const [supplierId, setSupplierId] = useState("");
  const [shipping, setShipping] = useState("");
  const [notes, setNotes] = useState("");
  const [etd, setEtd] = useState<Date>();
  const [eta, setEta] = useState<Date>();
  const [items, setItems] = useState<ItemRow[]>([{ name: "", qty: "", price: "", productId: "" }]);

  const resetForm = () => { setPriority("P2"); setSupplierId(""); setShipping(""); setNotes(""); setEtd(undefined); setEta(undefined); setItems([{ name: "", qty: "", price: "", productId: "" }]); };
  const updateItem = (idx: number, field: keyof ItemRow, value: string) => setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  const addItemRow = () => setItems(prev => [...prev, { name: "", qty: "", price: "", productId: "" }]);
  const removeItemRow = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const selectProduct = (idx: number, productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (prod) {
      setItems(prev => prev.map((item, i) => i === idx ? { ...item, productId, name: prod.name, price: prod.purchase_price?.toString() || "" } : item));
    }
  };

  const handleSubmit = async () => {
    const validItems = items.filter(i => i.name.trim() && Number(i.qty) > 0);
    if (validItems.length === 0) return;
    const supplier = suppliers.find(s => s.id === supplierId);

    await addOrder({
      priority,
      supplier_id: supplierId || undefined,
      supplier_name: supplier?.company || undefined,
      shipping: shipping || undefined,
      status: "PENDING",
      order_date: new Date().toISOString(),
      etd: etd?.toISOString(),
      eta: eta?.toISOString(),
      total_price: validItems.reduce((s, i) => s + (Number(i.price) || 0) * Number(i.qty), 0) || undefined,
      notes: notes.trim() || undefined,
      items: validItems.map(item => ({ name: item.name, qty: Number(item.qty), price: Number(item.price) || undefined, product_id: item.productId || undefined })),
    });
    resetForm();
    setOpen(false);
  };

  const DateField = ({ label, value, onChange }: { label: string; value?: Date; onChange: (d?: Date) => void }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-start text-right font-normal", !value && "text-muted-foreground")}>
            <CalendarIcon className="h-4 w-4 ml-2" />
            {value ? format(value, "dd/MM/yyyy") : "בחר תאריך"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={value} onSelect={d => onChange(d)} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 ml-2" />הזמנה חדשה</Button></DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>יצירת הזמנה חדשה</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>עדיפות</Label>
              <Select value={priority} onValueChange={v => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{priorities.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ספק</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="בחר ספק" /></SelectTrigger>
                <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.company} — {s.contact_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2"><Label>שיטת משלוח</Label><Input value={shipping} onChange={e => setShipping(e.target.value)} placeholder="ימי / אווירי / יבשתי..." /></div>
          <div className="grid grid-cols-2 gap-4">
            <DateField label="ETD (תאריך יציאה)" value={etd} onChange={setEtd} />
            <DateField label="ETA (תאריך הגעה)" value={eta} onChange={setEta} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between"><Label>מוצרים</Label><Button type="button" variant="ghost" size="sm" onClick={addItemRow}><Plus className="h-3 w-3 ml-1" />הוסף שורה</Button></div>
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-end">
                <div className="flex-1">
                  {idx === 0 && <span className="text-xs text-muted-foreground">מוצר</span>}
                  <Select value={item.productId} onValueChange={v => selectProduct(idx, v)}>
                    <SelectTrigger><SelectValue placeholder="בחר מוצר" /></SelectTrigger>
                    <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="w-20">{idx === 0 && <span className="text-xs text-muted-foreground">כמות</span>}<Input type="number" value={item.qty} onChange={e => updateItem(idx, "qty", e.target.value)} placeholder="0" /></div>
                <div className="w-24">{idx === 0 && <span className="text-xs text-muted-foreground">מחיר</span>}<Input type="number" value={item.price} onChange={e => updateItem(idx, "price", e.target.value)} placeholder="$" /></div>
                {items.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => removeItemRow(idx)} className="shrink-0"><Trash2 className="h-4 w-4 text-destructive" /></Button>}
              </div>
            ))}
          </div>
          <div className="space-y-2"><Label>הערות</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="הערות להזמנה..." rows={2} /></div>
          <Button onClick={handleSubmit} disabled={!items.some(i => i.name && Number(i.qty) > 0)} className="w-full">צור הזמנה</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
