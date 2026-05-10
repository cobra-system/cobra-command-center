import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import ProductFormDialog from "@/components/products/ProductFormDialog";

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
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Create-product flow
  const [productCreateOpen, setProductCreateOpen] = useState(false);
  const [productCreateName, setProductCreateName] = useState("");
  const [pendingProductMatchName, setPendingProductMatchName] = useState<string | null>(null);

  // Post-submit "attach to division" prompt
  const [attachPrompt, setAttachPrompt] = useState<{ productId: string; productName: string } | null>(null);

  const isEdit = !!editingRequest;
  const divisionProductIds = new Set(divisionProducts.map(dp => dp.product_id));
  // Show ALL products (not only the ones already linked to this division). If the
  // user picks one outside their set, we ask after submission whether to attach it.
  const productOptions = allProducts.map(p => ({
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
      setNotes(seed.notes ?? "");
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
      setNotes("");
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

  // When a new product is created via the inline ProductFormDialog, the products
  // list refetches; this effect picks up the freshly created entry by name and
  // selects it automatically.
  useEffect(() => {
    if (!pendingProductMatchName) return;
    const match = allProducts.find(p => p.name.trim() === pendingProductMatchName.trim());
    if (match) {
      handleProductChange(match.id);
      setPendingProductMatchName(null);
    }
    // intentionally leaving handleProductChange out of deps: it's defined inline above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allProducts, pendingProductMatchName]);

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

    // If the chosen product isn't linked to this division yet, offer to attach.
    if (!isEdit && productId && !divisionProductIds.has(productId)) {
      setAttachPrompt({ productId, productName: productName.trim() });
    } else {
      onOpenChange(false);
    }
    onCreated();
  };

  const handleAttachConfirm = async () => {
    if (!attachPrompt) return;
    const { error } = await supabase
      .from("division_products")
      .insert({ division, product_id: attachPrompt.productId });
    if (error) {
      toast.error("שגיאה בצירוף המוצר לחטיבה");
    } else {
      toast.success("המוצר צורף לחטיבה");
    }
    setAttachPrompt(null);
    onOpenChange(false);
    onCreated();
  };

  const handleAttachDismiss = () => {
    setAttachPrompt(null);
    onOpenChange(false);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "עריכת בקשת הזמנה" : "בקשת הזמנה חדשה"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Product picker — searches across ALL products. If the search yields
              nothing the user can create a brand-new product inline. */}
          <div className="space-y-1.5">
            <Label>מוצר</Label>
            <Combobox
              value={productId}
              onValueChange={handleProductChange}
              options={productOptions}
              placeholder="בחר מוצר..."
              searchPlaceholder='חיפוש לפי שם או מק"ט...'
              emptyText="לא נמצאו מוצרים"
              createNewLabel="צור מוצר חדש"
              onCreateNew={(name) => {
                setProductCreateName(name);
                setProductCreateOpen(true);
              }}
            />
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>מלאי חטיבה</Label>
              <Input type="number" value={divisionStock} onChange={e => setDivisionStock(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>צפי רבעון</Label>
              <Input type="number" value={quarterlyForecast} onChange={e => setQuarterlyForecast(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>תאריך ביצוע הזמנה</Label>
              <Input type="date" value={orderExecutionDate} onChange={e => setOrderExecutionDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>הערות</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>ביטול</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? (isEdit ? "שומר..." : "שולח...") : (isEdit ? "שמור שינויים" : "שלח בקשה")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Inline product creation triggered from the combobox empty state */}
    <ProductFormDialog
      open={productCreateOpen}
      onOpenChange={setProductCreateOpen}
      presetProductName={productCreateName}
      presetDivision={division}
      onCreated={() => setPendingProductMatchName(productCreateName)}
    />

    {/* Post-submit prompt to add the chosen product to this division's product set */}
    <AlertDialog open={!!attachPrompt} onOpenChange={(o) => { if (!o) handleAttachDismiss(); }}>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle>צירוף מוצר לחטיבה</AlertDialogTitle>
          <AlertDialogDescription>
            המוצר &quot;{attachPrompt?.productName}&quot; אינו משויך לחטיבת {division}.
            לצרף אותו לרשימת המוצרים הקבועה של החטיבה?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleAttachDismiss}>לא, רק הפעם</AlertDialogCancel>
          <AlertDialogAction onClick={handleAttachConfirm}>כן, צרף לחטיבה</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
