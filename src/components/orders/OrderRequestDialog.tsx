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
import type { Product, OrderRequest } from "@/contexts/types";
import type { OrderRequestUrgency, OrderRequestType } from "@/contexts/types";
import { URGENCY_OPTIONS, ORDER_TYPE_OPTIONS } from "./orderRequestUtils";
import { updateDivisionStock } from "./divisionStockHelpers";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  division: string;
  divisionProducts: { product_id: string; products: { id: string; name: string; sku: string } }[];
  allProducts: Product[];
  onCreated: () => void;
  /** When provided, dialog enters edit mode for this request. */
  editingRequest?: OrderRequest | null;
  /** When provided, dialog opens in CREATE mode but with these fields prefilled. */
  template?: OrderRequest | null;
}

export function OrderRequestDialog({
  open,
  onOpenChange,
  division,
  divisionProducts,
  allProducts,
  onCreated,
  editingRequest,
  template,
}: Props) {
  const { currentUser } = useAuth();
  const [productId, setProductId] = useState("");
  const [productName, setProductName] = useState("");
  const [productSku, setProductSku] = useState("");
  const [supplier, setSupplier] = useState("");
  const [quantity, setQuantity] = useState("");
  const [currentConsumption, setCurrentConsumption] = useState("");
  const [reason, setReason] = useState("");
  const [urgency, setUrgency] = useState<OrderRequestUrgency>("רגיל");
  const [orderType, setOrderType] = useState<OrderRequestType>("חודשית");
  const [divisionStock, setDivisionStock] = useState("");
  const [quarterlyForecast, setQuarterlyForecast] = useState("");
  const [orderExecutionDate, setOrderExecutionDate] = useState("");
  const [shippingType, setShippingType] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEdit = !!editingRequest;
  const divisionProductIds = new Set(divisionProducts.map(dp => dp.product_id));
  const productOptions = allProducts
    .filter(p => divisionProductIds.has(p.id))
    .map(p => ({
      value: p.id,
      label: p.name,
      hint: p.sku || undefined,
      keywords: p.sku ? [p.sku] : undefined,
    }));

  useEffect(() => {
    if (!open) return;
    const today = new Date().toISOString().slice(0, 10);
    const seed = editingRequest ?? template ?? null;
    if (seed) {
      setProductId(seed.product_id ?? "");
      setProductName(seed.product_name ?? "");
      setProductSku(seed.product_sku ?? "");
      setSupplier(seed.supplier ?? "");
      setQuantity(seed.required_to_order != null ? String(seed.required_to_order) : (seed.quantity != null ? String(seed.quantity) : ""));
      setCurrentConsumption(seed.current_consumption ?? "");
      setReason(seed.reason ?? "");
      setUrgency(seed.urgency ?? "רגיל");
      setOrderType(seed.order_type ?? "חודשית");
      setDivisionStock(seed.division_stock != null ? String(seed.division_stock) : "");
      setQuarterlyForecast(seed.quarterly_forecast != null ? String(seed.quarterly_forecast) : "");
      setOrderExecutionDate(seed.order_execution_date ?? today);
      setShippingType(seed.shipping_type ?? "");
      setPaymentStatus(seed.payment_status ?? "");
      setNotes(seed.notes ?? "");
      setShowAdvanced(true);
    } else {
      setProductId("");
      setProductName("");
      setProductSku("");
      setSupplier("");
      setQuantity("");
      setCurrentConsumption("");
      setReason("");
      setUrgency("רגיל");
      setOrderType("חודשית");
      setDivisionStock("");
      setQuarterlyForecast("");
      setOrderExecutionDate(today);
      setShippingType("");
      setPaymentStatus("");
      setNotes("");
      setShowAdvanced(false);
    }
  }, [open, editingRequest, template]);

  const handleProductChange = (id: string) => {
    setProductId(id);
    const prod = allProducts.find(p => p.id === id);
    if (prod) {
      setSupplier(prod.supplier ?? "");
      setProductName(prod.name);
      setProductSku(prod.sku ?? "");
    }
  };

  const numOrNull = (s: string): number | null => {
    if (!s.trim()) return null;
    const n = Number(s);
    return Number.isNaN(n) ? null : n;
  };

  const handleSubmit = async () => {
    const qty = quantity.trim() ? Number(quantity) : null;
    if (qty !== null && (Number.isNaN(qty) || qty < 0)) {
      toast.error("כמות לא תקינה");
      return;
    }
    if (!productName.trim()) {
      toast.error("יש להזין שם מוצר");
      return;
    }

    const supplierIdMatch = await supabase
      .from("suppliers")
      .select("id")
      .eq("company", supplier)
      .maybeSingle();

    const payload = {
      division,
      product_id: productId || null,
      product_name: productName.trim(),
      product_sku: productSku.trim() || null,
      supplier: supplier.trim() || null,
      supplier_id: supplierIdMatch.data?.id ?? null,
      quantity: qty,
      required_to_order: qty,
      urgency,
      order_type: orderType,
      current_consumption: currentConsumption.trim() || null,
      reason: reason.trim() || null,
      // division_stock lives on division_products only; we write it separately below
      quarterly_forecast: numOrNull(quarterlyForecast),
      order_execution_date: orderExecutionDate || null,
      shipping_type: shippingType.trim() || null,
      payment_status: paymentStatus.trim() || null,
      notes: notes.trim() || null,
    };

    setSaving(true);
    let error;
    if (isEdit && editingRequest) {
      ({ error } = await supabase.from("order_requests").update(payload).eq("id", editingRequest.id));
    } else {
      ({ error } = await supabase.from("order_requests").insert({
        ...payload,
        created_by: currentUser?.id ?? null,
        created_by_name: currentUser?.name ?? null,
      }));
    }
    setSaving(false);

    if (error) {
      toast.error(isEdit ? "שגיאה בעדכון הבקשה" : "שגיאה ביצירת הבקשה");
      return;
    }

    // If a product is selected and the user touched the stock field, write the
    // value to the canonical place (division_products). Skipping silently when
    // no product is selected — the planning row exists but isn't tied to a product.
    const stockNum = numOrNull(divisionStock);
    if (productId && stockNum !== null) {
      const stockResult = await updateDivisionStock(division, productId, stockNum);
      if (!stockResult.ok) {
        // Don't fail the whole save — the request was saved
        toast.error("הבקשה נשמרה, אך עדכון המלאי נכשל: " + (stockResult.error ?? ""));
      }
    }

    toast.success(isEdit ? "הבקשה עודכנה" : "הבקשה נשלחה בהצלחה");
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "עריכת בקשת הזמנה" : "בקשת הזמנה חדשה"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Product picker (free text fallback for planning rows without a product) */}
          <div className="space-y-1.5">
            <Label>מוצר {productOptions.length === 0 && <span className="text-xs text-muted-foreground">(הזן ידנית)</span>}</Label>
            {productOptions.length > 0 ? (
              <Combobox
                value={productId}
                onValueChange={handleProductChange}
                options={productOptions}
                placeholder="בחר מוצר..."
                searchPlaceholder='חיפוש לפי שם או מק"ט...'
                emptyText="לא נמצאו מוצרים"
              />
            ) : (
              <Input value={productName} onChange={e => setProductName(e.target.value)} placeholder="שם מוצר" />
            )}
          </div>

          {/* When a product is picked, show its SKU + name as readouts; else allow editing */}
          {productId ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>שם תצוגה</Label>
                <Input value={productName} onChange={e => setProductName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>מק״ט</Label>
                <Input value={productSku} onChange={e => setProductSku(e.target.value)} dir="ltr" />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>מק״ט</Label>
              <Input value={productSku} onChange={e => setProductSku(e.target.value)} dir="ltr" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>ספק</Label>
            <Input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="שם ספק" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>כמות</Label>
              <Input
                type="number"
                min="0"
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
                  {URGENCY_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>סוג הזמנה</Label>
            <Select value={orderType} onValueChange={v => setOrderType(v as OrderRequestType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ORDER_TYPE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>צריכה חודשית ממוצעת</Label>
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
              rows={2}
            />
          </div>

          {/* Advanced planning fields toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(s => !s)}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            {showAdvanced ? "הסתר שדות תכנון מתקדמים" : "הצג שדות תכנון מתקדמים"}
          </button>

          {showAdvanced && (
            <div className="space-y-4 border-t pt-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">מלאי חטיבה</Label>
                  <Input type="number" value={divisionStock} onChange={e => setDivisionStock(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">צפי רבעון</Label>
                  <Input type="number" value={quarterlyForecast} onChange={e => setQuarterlyForecast(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">תאריך ביצוע הזמנה</Label>
                  <Input type="date" value={orderExecutionDate} onChange={e => setOrderExecutionDate(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">סוג משלוח</Label>
                  <Input value={shippingType} onChange={e => setShippingType(e.target.value)} placeholder="ים / אוויר / יבשה" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">סטטוס תשלום</Label>
                  <Input value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">הערות</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2 border-t">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>ביטול</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? (isEdit ? "שומר..." : "שולח...") : (isEdit ? "שמור שינויים" : "שלח בקשה")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
