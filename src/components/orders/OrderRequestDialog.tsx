import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AppContext";
import type { Product } from "@/contexts/types";
import type { OrderRequestUrgency, OrderRequestType } from "@/contexts/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  division: string;
  divisionProducts: { product_id: string; products: { id: string; name: string; sku: string } }[];
  allProducts: Product[];
  onCreated: () => void;
}

const URGENCY_OPTIONS: { value: OrderRequestUrgency; label: string }[] = [
  { value: "דחוף", label: "דחוף" },
  { value: "רגיל", label: "רגיל" },
  { value: "נמוך", label: "נמוך" },
];

const ORDER_TYPE_OPTIONS: { value: OrderRequestType; label: string }[] = [
  { value: "מיידית", label: "מיידית" },
  { value: "חודשית", label: "חודשית" },
  { value: "רבעונית", label: "רבעונית" },
  { value: "חצי שנתית", label: "חצי שנתית" },
];

export function OrderRequestDialog({ open, onOpenChange, division, divisionProducts, allProducts, onCreated }: Props) {
  const { currentUser } = useAuth();
  const [productId, setProductId] = useState("");
  const [supplier, setSupplier] = useState("");
  const [quantity, setQuantity] = useState("");
  const [currentConsumption, setCurrentConsumption] = useState("");
  const [reason, setReason] = useState("");
  const [urgency, setUrgency] = useState<OrderRequestUrgency>("רגיל");
  const [orderType, setOrderType] = useState<OrderRequestType>("חודשית");
  const [saving, setSaving] = useState(false);

  const divisionProductIds = new Set(divisionProducts.map(dp => dp.product_id));
  const productOptions = allProducts
    .filter(p => divisionProductIds.has(p.id))
    .map(p => ({ value: p.id, label: p.name }));

  useEffect(() => {
    if (!open) {
      setProductId("");
      setSupplier("");
      setQuantity("");
      setCurrentConsumption("");
      setReason("");
      setUrgency("רגיל");
      setOrderType("חודשית");
    }
  }, [open]);

  const handleProductChange = (id: string) => {
    setProductId(id);
    const prod = allProducts.find(p => p.id === id);
    setSupplier(prod?.supplier ?? "");
  };

  const handleSubmit = async () => {
    if (!productId) { toast.error("יש לבחור מוצר"); return; }
    const qty = Number(quantity);
    if (!qty || qty <= 0) { toast.error("יש להזין כמות תקינה"); return; }

    const prod = allProducts.find(p => p.id === productId);
    if (!prod) return;

    setSaving(true);
    const { error } = await supabase.from("order_requests").insert({
      division,
      product_id: productId,
      product_name: prod.name,
      supplier: supplier || null,
      current_consumption: currentConsumption.trim() || null,
      reason: reason.trim() || null,
      quantity: qty,
      urgency,
      order_type: orderType,
      created_by: currentUser?.id ?? null,
    });
    setSaving(false);

    if (error) { toast.error("שגיאה ביצירת הבקשה"); return; }
    toast.success("הבקשה נשלחה בהצלחה");
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>בקשת הזמנה חדשה</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>מוצר</Label>
            <Combobox
              value={productId}
              onValueChange={handleProductChange}
              options={productOptions}
              placeholder="בחר מוצר..."
              searchPlaceholder="חיפוש מוצר..."
              emptyText="לא נמצאו מוצרים"
            />
          </div>

          {supplier && (
            <div className="space-y-1.5">
              <Label>ספק</Label>
              <Input value={supplier} readOnly className="bg-muted/50 text-muted-foreground" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>כמות</Label>
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label>דחיפות</Label>
              <Select value={urgency} onValueChange={v => setUrgency(v as OrderRequestUrgency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {URGENCY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>סוג הזמנה</Label>
            <Select value={orderType} onValueChange={v => setOrderType(v as OrderRequestType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ORDER_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>צריכה נוכחית</Label>
            <Input
              value={currentConsumption}
              onChange={e => setCurrentConsumption(e.target.value)}
              placeholder="לדוגמה: 50 יחידות לחודש"
            />
          </div>

          <div className="space-y-1.5">
            <Label>סיבת ההזמנה</Label>
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="תיאור הצורך בהזמנה..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>ביטול</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "שולח..." : "שלח בקשה"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
