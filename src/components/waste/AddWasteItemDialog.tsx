import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AppContext";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Package,
  Layers,
  User,
  Hash,
  Box,
  CalendarIcon,
  MessageSquare,
  Truck,
  Trash2,
  DollarSign,
  HelpCircle,
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  sku: string;
  components?: Array<{ id: string; name: string; sku: string }>;
}

interface Supplier {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  products: Product[];
}

type ActionType = "ממתין" | "החזרה לספק" | "השמדה" | "מכירה בערוץ שלישי" | "אחר";

const ACTION_OPTIONS: { value: ActionType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "ממתין", label: "ממתין (טרם הוחלט)", icon: <Box className="h-4 w-4" />, color: "text-muted-foreground" },
  { value: "החזרה לספק", label: "החזרה לספק", icon: <Truck className="h-4 w-4" />, color: "text-blue-600" },
  { value: "השמדה", label: "השמדה", icon: <Trash2 className="h-4 w-4" />, color: "text-destructive" },
  { value: "מכירה בערוץ שלישי", label: "מכירה בערוץ שלישי", icon: <DollarSign className="h-4 w-4" />, color: "text-amber-600" },
  { value: "אחר", label: "אחר (עם פירוט)", icon: <HelpCircle className="h-4 w-4" />, color: "text-purple-600" },
];

export function AddWasteItemDialog({ open, onClose, onSaved, products }: Props) {
  const { currentUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Core fields
  const [itemSource, setItemSource] = useState<"product" | "component">("product");
  const [productName, setProductName] = useState("");
  const [sku, setSku] = useState("");
  const [productId, setProductId] = useState<string | null>(null);
  const [componentId, setComponentId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [inUse, setInUse] = useState(false);
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  // Action
  const [action, setAction] = useState<ActionType>("ממתין");

  // Action-specific fields
  const [supplierId, setSupplierId] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [otherDetail, setOtherDetail] = useState("");

  useEffect(() => {
    if (!open) return;
    // Reset
    setItemSource("product");
    setProductName("");
    setSku("");
    setProductId(null);
    setComponentId(null);
    setQuantity(1);
    setInUse(false);
    setNotes("");
    setDate(new Date().toISOString().slice(0, 10));
    setAction("ממתין");
    setSupplierId("");
    setTrackingNumber("");
    setReturnReason("");
    setBuyerName("");
    setSalePrice("");
    setOtherDetail("");

    supabase.from("suppliers").select("id, name").order("name").then(({ data }) => {
      setSuppliers(data ?? []);
    });
  }, [open]);

  const productOptions = useMemo(
    () => products.map((p) => ({ value: p.name, label: p.name })),
    [products]
  );
  const productMap = useMemo(() => {
    const map = new Map<string, { id: string; sku: string }>();
    products.forEach((p) => map.set(p.name, { id: p.id, sku: p.sku }));
    return map;
  }, [products]);
  const componentOptions = useMemo(
    () => products.flatMap((p) =>
      (p.components || []).map((c) => ({ value: c.name, label: `${c.name} — ${p.name}` }))
    ),
    [products]
  );
  const componentMap = useMemo(() => {
    const map = new Map<string, { id: string; sku: string; product_id: string }>();
    products.forEach((p) => {
      (p.components || []).forEach((c) => {
        if (!map.has(c.name)) map.set(c.name, { id: c.id, sku: c.sku || "", product_id: p.id });
      });
    });
    return map;
  }, [products]);

  const supplierOptions = useMemo(
    () => suppliers.map((s) => ({ value: s.id, label: s.name })),
    [suppliers]
  );

  const isProductFromSystem = useMemo(() => {
    if (itemSource === "component") return componentMap.has(productName);
    return productMap.has(productName);
  }, [itemSource, productName, productMap, componentMap]);

  const handleProductSelect = (val: string) => {
    const hit = productMap.get(val);
    setProductName(val);
    setSku(hit?.sku ?? "");
    setProductId(hit?.id ?? null);
    setComponentId(null);
  };

  const handleComponentSelect = (val: string) => {
    const hit = componentMap.get(val);
    setProductName(val);
    setSku(hit?.sku ?? "");
    setProductId(hit?.product_id ?? null);
    setComponentId(hit?.id ?? null);
  };

  const handleSwitchSource = (src: "product" | "component") => {
    setItemSource(src);
    setProductName("");
    setSku("");
    setProductId(null);
    setComponentId(null);
  };

  const isValid = () => {
    if (!productName.trim()) return false;
    if (quantity < 1) return false;
    if (action === "החזרה לספק" && !supplierId) return false;
    if (action === "מכירה בערוץ שלישי" && !buyerName.trim()) return false;
    if (action === "אחר" && !otherDetail.trim()) return false;
    return true;
  };

  const handleSave = async () => {
    if (!currentUser || !isValid()) return;
    setSaving(true);
    try {
      const dispositionType = action === "ממתין" ? null : action;
      const dispositionDate = dispositionType ? new Date().toISOString() : null;

      const itemPayload: Record<string, unknown> = {
        product_name: productName.trim(),
        sku: sku.trim(),
        quantity,
        in_use: inUse,
        recommendations: action === "אחר" ? otherDetail.trim() : notes.trim() || null,
        product_id: productId,
        component_id: componentId,
        created_by: currentUser.id,
        created_by_name: currentUser.name,
        disposition_type: dispositionType,
        disposition_date: dispositionDate,
        created_at: new Date(date).toISOString(),
      };

      if (action === "מכירה בערוץ שלישי") {
        itemPayload.sale_buyer_name = buyerName.trim();
        itemPayload.sale_price = salePrice ? parseFloat(salePrice) : null;
      }

      const { data: newItem, error: itemErr } = await supabase
        .from("waste_items")
        .insert(itemPayload)
        .select()
        .single();

      if (itemErr) throw itemErr;

      if (action === "החזרה לספק") {
        const { data: ret, error: retErr } = await supabase
          .from("supplier_returns")
          .insert({
            supplier_id: supplierId,
            return_reason: returnReason || null,
            tracking_number: trackingNumber || null,
            created_by: currentUser.id,
            created_by_name: currentUser.name,
          })
          .select()
          .single();

        if (retErr) throw retErr;

        const { error: linkErr } = await supabase
          .from("waste_items")
          .update({ supplier_return_id: ret.id })
          .eq("id", newItem.id);

        if (linkErr) throw linkErr;
      }

      toast.success("פריט הבלאי נוסף בהצלחה");
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "שגיאה בהוספת פריט";
      logger.error("AddWasteItemDialog save error", err);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Package className="h-5 w-5 text-primary" />
            הוספת פריט בלאי
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Reported by */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted/40 rounded-lg">
            <User className="h-4 w-4" />
            <span>מדווח ע"י: <strong className="text-foreground">{currentUser?.name ?? "—"}</strong></span>
          </div>

          {/* Product / Component */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium flex items-center gap-2">
                {itemSource === "component" ? <Layers className="h-4 w-4 text-primary" /> : <Package className="h-4 w-4 text-primary" />}
                {itemSource === "component" ? "שם הפריט" : "שם המוצר"} *
              </Label>
              <div className="inline-flex rounded-md border bg-muted/40 p-0.5 gap-0.5">
                {(["product", "component"] as const).map((s) => (
                  <button key={s} type="button" onClick={() => handleSwitchSource(s)}
                    className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${itemSource === s ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    {s === "product" ? "מוצר" : "פריט"}
                  </button>
                ))}
              </div>
            </div>
            {itemSource === "component" ? (
              <Combobox value={productName} onValueChange={handleComponentSelect} options={componentOptions}
                placeholder="בחר פריט מוצר..." searchPlaceholder="חיפוש פריט..." emptyText="לא נמצא פריט" allowCustomValue />
            ) : (
              <Combobox value={productName} onValueChange={handleProductSelect} options={productOptions}
                placeholder="בחר או הקלד שם מוצר..." searchPlaceholder="חיפוש מוצר..." emptyText="לא נמצא מוצר" allowCustomValue />
            )}
          </div>

          {/* SKU + Quantity + Date row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1"><Hash className="h-3.5 w-3.5 text-primary" />מק"ט</Label>
              <Input placeholder="XXX-000" value={sku} onChange={(e) => setSku(e.target.value)}
                disabled={isProductFromSystem} className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1"><Box className="h-3.5 w-3.5 text-primary" />כמות *</Label>
              <Input type="number" min={1} value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="text-center" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1"><CalendarIcon className="h-3.5 w-3.5 text-primary" />תאריך</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          {/* In use */}
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
            <Checkbox id="in-use" checked={inUse} onCheckedChange={(c) => setInUse(!!c)} />
            <Label htmlFor="in-use" className="cursor-pointer text-sm">הפריט עדיין בשימוש</Label>
          </div>

          <Separator />

          {/* Action */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">פעולה</Label>
            <Select value={action} onValueChange={(v) => setAction(v as ActionType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className={`flex items-center gap-2 ${opt.color}`}>
                      {opt.icon}
                      {opt.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action-specific fields */}
          {action === "החזרה לספק" && (
            <div className="space-y-4 p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-200/60 dark:border-blue-800/40">
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <Truck className="h-3.5 w-3.5" /> פרטי החזרה לספק
              </p>
              <div className="space-y-2">
                <Label className="text-sm">ספק *</Label>
                <Combobox value={supplierId} onValueChange={setSupplierId} options={supplierOptions}
                  placeholder="בחר ספק..." searchPlaceholder="חיפוש ספק..." emptyText="לא נמצא ספק" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">סיבת החזרה</Label>
                <Input placeholder="מוצר פגום, אי-התאמה..." value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">מספר מעקב (DHL / משלוח)</Label>
                <Input placeholder="JD1234567890..." value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)} className="font-mono" />
              </div>
            </div>
          )}

          {action === "מכירה בערוץ שלישי" && (
            <div className="space-y-4 p-4 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg border border-amber-200/60 dark:border-amber-800/40">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5" /> פרטי המכירה
              </p>
              <div className="space-y-2">
                <Label className="text-sm">שם הקונה *</Label>
                <Input placeholder="שם הקונה..." value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">מחיר (₪, אופציונלי)</Label>
                <Input type="number" min={0} step={0.01} placeholder="0.00" value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)} />
              </div>
            </div>
          )}

          {action === "אחר" && (
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1">
                <HelpCircle className="h-3.5 w-3.5 text-purple-500" /> פירוט הפעולה *
              </Label>
              <Textarea placeholder="תאר את הפעולה שתבוצע..." value={otherDetail}
                onChange={(e) => setOtherDetail(e.target.value)} rows={3} />
            </div>
          )}

          {/* Notes (not shown when action=אחר since detail replaces it) */}
          {action !== "אחר" && (
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5 text-primary" /> הערות (אופציונלי)
              </Label>
              <Textarea placeholder="הערות נוספות..." value={notes}
                onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>ביטול</Button>
          <Button onClick={handleSave} disabled={saving || !isValid()} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
            הוסף פריט בלאי
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
