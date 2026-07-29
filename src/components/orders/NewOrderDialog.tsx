import { useState, useEffect, useMemo, useCallback } from "react";
import { type Priority, type Order, type OrderItem, type Supplier, type Product, type ProductComponent } from "@/contexts/AppContext";
import { useOrders } from "@/contexts/AppContext";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DateInput } from "@/components/ui/date-input";
import { toast } from "sonner";
import { orderSchema } from "@/lib/schemas/orderSchema";

const priorities: { value: Priority; label: string }[] = [
  { value: "דחוף", label: "דחוף" },
  { value: "גבוה", label: "גבוה" },
  { value: "בינוני", label: "בינוני" },
  { value: "נמוך", label: "נמוך" },
];

type ItemType = "product" | "component";
interface ItemRow { type: ItemType; name: string; qty: string; price: string; currency: string; productId: string; componentId: string; }

interface FlatComponent extends ProductComponent { productName: string; }

interface Props {
  suppliers: Supplier[];
  products: Product[];
  addOrder: (order: Omit<Order, "id" | "items"> & { items: Omit<OrderItem, "id" | "order_id">[] }) => Promise<string | undefined>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultProductId?: string;
  defaultSupplierId?: string;
  defaultQuantity?: number;
  defaultNotes?: string;
  defaultPriority?: Priority;
  hideTrigger?: boolean;
  onOrderCreated?: (orderId: string) => void;
}

export function NewOrderDialog({ suppliers, products, addOrder, open: controlledOpen, onOpenChange, defaultProductId, defaultSupplierId, defaultQuantity, defaultNotes, defaultPriority, hideTrigger, onOrderCreated }: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (controlledOpen !== undefined && onOpenChange) {
      onOpenChange(v);
    } else {
      setInternalOpen(v);
    }
  };

  const [priority, setPriority] = useState<Priority>("בינוני");
  const [supplierId, setSupplierId] = useState("");
  const [shipping, setShipping] = useState("");
  const [destinationSupplierId, setDestinationSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [etd, setEtd] = useState<Date>();
  const [eta, setEta] = useState<Date>();
  const [tracking_number, setTrackingNumber] = useState("");
  const [items, setItems] = useState<ItemRow[]>([{ type: "product", name: "", qty: "", price: "", currency: "USD", productId: "", componentId: "" }]);

  const { orders } = useOrders();

  const allComponents: FlatComponent[] = products.flatMap(p =>
    (p.components || []).map(c => ({ ...c, productName: p.name }))
  );

  // Last price actually used per product, taken from the most recent order that
  // included it (by order date). Lets us pre-fill the price the user paid last
  // time instead of only the catalog purchase price.
  const lastPriceByProduct = useMemo(() => {
    const map = new Map<string, { price: number; currency: string }>();
    const sorted = [...orders].sort((a, b) => (b.order_date || "").localeCompare(a.order_date || ""));
    for (const o of sorted) {
      for (const it of o.items || []) {
        if (it.product_id && it.price != null && !map.has(it.product_id)) {
          map.set(it.product_id, { price: it.price, currency: it.currency || "USD" });
        }
      }
    }
    return map;
  }, [orders]);

  // Resolve the price to pre-fill for a product: last used price if we have one,
  // otherwise fall back to the product's catalog purchase price.
  const priceForProduct = useCallback((prod: Product): { price: string; currency: string } => {
    const last = lastPriceByProduct.get(prod.id);
    if (last) return { price: String(last.price), currency: last.currency };
    return { price: prod.purchase_price?.toString() || "", currency: prod.price_currency || "USD" };
  }, [lastPriceByProduct]);

  const supplierOptions = suppliers.map(s => ({ value: s.id, label: `${s.company} — ${s.contact_name}` }));
  const productOptions = products.map(p => ({
    value: p.id,
    label: p.name,
    keywords: p.sku ? [p.sku] : undefined,
    hint: p.sku || undefined,
  }));
  const componentOptions = allComponents.map(c => ({
    value: c.id,
    label: `${c.name} — ${c.productName}`,
    keywords: c.sku ? [c.sku] : undefined,
    hint: c.sku || undefined,
  }));

  const resetForm = () => {
    setPriority("בינוני"); setSupplierId(""); setShipping(""); setDestinationSupplierId(""); setNotes("");
    setEtd(undefined); setEta(undefined); setTrackingNumber("");
    setItems([{ type: "product", name: "", qty: "", price: "", currency: "USD", productId: "", componentId: "" }]);
  };

  // Handle defaults when dialog opens
  useEffect(() => {
    if (!open) return;

    if (defaultSupplierId) {
      setSupplierId(defaultSupplierId);
    }
    if (defaultNotes) {
      setNotes(defaultNotes);
    }
    if (defaultPriority) {
      setPriority(defaultPriority);
    }

    if (defaultProductId) {
      const prod = products.find(p => p.id === defaultProductId);
      if (prod) {
        const { price, currency } = priceForProduct(prod);
        setItems([{
          type: "product",
          name: prod.name,
          qty: defaultQuantity ? String(defaultQuantity) : "1",
          price,
          currency,
          productId: prod.id,
          componentId: ""
        }]);
        // Auto-set supplier if product has one
        if (prod.supplier && !defaultSupplierId) {
          const s = suppliers.find(s => s.company === prod.supplier);
          if (s) setSupplierId(s.id);
        }
      }
    }
  }, [open, defaultProductId, defaultSupplierId, defaultNotes, defaultPriority, defaultQuantity, products, suppliers, priceForProduct]);

  const updateItem = (idx: number, field: keyof ItemRow, value: string) =>
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));

  const addItemRow = () =>
    setItems(prev => [...prev, { type: "product", name: "", qty: "", price: "", currency: "USD", productId: "", componentId: "" }]);

  const removeItemRow = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const selectProduct = (idx: number, productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (prod) {
      const { price, currency } = priceForProduct(prod);
      setItems(prev => prev.map((item, i) => i === idx
        ? { ...item, productId, componentId: "", name: prod.name, price, currency }
        : item));
    }
  };

  const selectComponent = (idx: number, componentId: string) => {
    const comp = allComponents.find(c => c.id === componentId);
    if (comp) {
      setItems(prev => prev.map((item, i) => i === idx
        ? { ...item, componentId, productId: "", name: `${comp.name} (${comp.productName})`, price: comp.price?.toString() || "" }
        : item));
    }
  };

  const setItemType = (idx: number, type: ItemType) => {
    setItems(prev => prev.map((item, i) => i === idx
      ? { ...item, type, name: "", productId: "", componentId: "", price: "" }
      : item));
  };

  const handleSubmit = async () => {
    const rawItems = items
      .filter(i => i.name.trim() && Number(i.qty) > 0)
      .map(item => ({
        name: item.name,
        qty: Number(item.qty),
        unit_price: Number(item.price) || null,
        currency: item.currency || "USD",
        product_id: item.productId || null,
        component_id: item.componentId || null,
      }));

    const result = orderSchema.safeParse({
      supplier_id: supplierId,
      priority,
      shipping: shipping || undefined,
      notes: notes.trim() || undefined,
      etd: etd?.toISOString() || undefined,
      eta: eta?.toISOString() || undefined,
      tracking_number: tracking_number.trim() || undefined,
      items: rawItems,
    });

    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }

    const supplier = suppliers.find(s => s.id === supplierId);
    const destSupplier = destinationSupplierId ? suppliers.find(s => s.id === destinationSupplierId) : undefined;

    const newOrderId = await addOrder({
      priority,
      supplier_id: supplierId || undefined,
      supplier_name: supplier?.company || undefined,
      shipping: shipping || undefined,
      destination_supplier_id: destinationSupplierId || undefined,
      destination_supplier_name: destSupplier?.company || undefined,
      status: "PENDING",
      order_date: new Date().toISOString(),
      etd: etd?.toISOString(),
      eta: eta?.toISOString(),
      total_price: rawItems.reduce((s, i) => s + (i.unit_price || 0) * i.qty, 0) || undefined,
      notes: notes.trim() || undefined,
      tracking_number: tracking_number.trim() || undefined,
      items: rawItems.map(item => ({
        name: item.name,
        qty: item.qty,
        price: item.unit_price ?? undefined,
        currency: item.currency,
        product_id: item.product_id || undefined,
      })),
    });
    if (newOrderId && onOrderCreated) onOrderCreated(newOrderId);
    resetForm();
    setOpen(false);
  };

  const trigger = hideTrigger ? null : (
    <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-2" />הזמנה חדשה</Button></DialogTrigger>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      {trigger}
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>יצירת הזמנה חדשה</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>עדיפות</Label>
              <Select value={priority} onValueChange={v => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{priorities.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ספק</Label>
              <Combobox
                value={supplierId}
                onValueChange={setSupplierId}
                options={supplierOptions}
                placeholder="בחר ספק"
                searchPlaceholder="חיפוש ספק..."
              />
              {suppliers.find(s => s.id === supplierId)?.country === "ישראל" && (
                <div className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-1">
                  🇮🇱 ספק ישראלי — תהליך מקומי (אישור + חתימה)
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>שיטת משלוח</Label>
            <Select value={shipping} onValueChange={setShipping}>
              <SelectTrigger><SelectValue placeholder="בחר שיטת משלוח..." /></SelectTrigger>
              <SelectContent>
                {["ים", "אוויר", "יבשה", "שילוב", "בין ספקים"].map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {shipping === "בין ספקים" && (
            <div className="space-y-2">
              <Label>ספק יעד</Label>
              <Combobox
                value={destinationSupplierId}
                onValueChange={setDestinationSupplierId}
                options={supplierOptions}
                placeholder="בחר ספק יעד..."
                searchPlaceholder="חיפוש ספק..."
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>ETD (תאריך יציאה)</Label>
              <DateInput value={etd} onChange={setEtd} clearable />
            </div>
            <div className="space-y-2">
              <Label>ETA (תאריך הגעה)</Label>
              <DateInput value={eta} onChange={setEta} clearable />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>פריטים להזמנה</Label>
              <Button type="button" variant="ghost" size="sm" onClick={addItemRow}>
                <Plus className="h-3 w-3 ml-1" />הוסף שורה
              </Button>
            </div>

            {items.map((item, idx) => (
              <div key={idx} className="space-y-1 p-2 rounded-lg border bg-muted/10">
                <div className="flex gap-1 mb-1">
                  <Button type="button" size="sm" variant={item.type === "product" ? "default" : "outline"} className="h-6 text-xs px-2" onClick={() => setItemType(idx, "product")}>מוצר</Button>
                  <Button type="button" size="sm" variant={item.type === "component" ? "default" : "outline"} className="h-6 text-xs px-2" onClick={() => setItemType(idx, "component")}>רכיב</Button>
                  {items.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 mr-auto" onClick={() => removeItemRow(idx)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    {item.type === "product" ? (
                      <Combobox
                        value={item.productId}
                        onValueChange={v => selectProduct(idx, v)}
                        options={productOptions}
                        placeholder="בחר מוצר"
                        searchPlaceholder="חיפוש מוצר..."
                        className="h-8 text-sm"
                      />
                    ) : (
                      <Combobox
                        value={item.componentId}
                        onValueChange={v => selectComponent(idx, v)}
                        options={componentOptions}
                        placeholder="בחר רכיב"
                        searchPlaceholder="חיפוש רכיב..."
                        emptyText={allComponents.length === 0 ? "אין רכיבים" : "לא נמצאו תוצאות"}
                        className="h-8 text-sm"
                      />
                    )}
                  </div>
                  <div className="w-20"><Input type="number" value={item.qty} onChange={e => updateItem(idx, "qty", e.target.value)} placeholder="כמות" className="h-8 text-sm" /></div>
                  <div className="flex gap-1 w-32">
                    <Input type="number" value={item.price} onChange={e => updateItem(idx, "price", e.target.value)} placeholder="מחיר" className="h-8 text-sm flex-1 min-w-0" />
                    <Select value={item.currency} onValueChange={v => updateItem(idx, "currency", v)}>
                      <SelectTrigger className="h-8 w-14 shrink-0 text-xs px-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">$</SelectItem>
                        <SelectItem value="ILS">₪</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label>מספר מעקב</Label>
            <Input value={tracking_number} onChange={e => setTrackingNumber(e.target.value)} placeholder="מספר עקיבות שיחה..." />
          </div>

          <div className="space-y-2"><Label>הערות</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="הערות להזמנה..." rows={2} /></div>
          <Button onClick={handleSubmit} disabled={!items.some(i => i.name && Number(i.qty) > 0)} className="w-full">צור הזמנה</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
