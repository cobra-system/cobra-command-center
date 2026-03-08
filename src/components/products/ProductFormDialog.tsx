import { useState } from "react";
import { useData, categories, type Product, type ProductComponent } from "@/contexts/AppContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editProduct?: Product | null;
}

interface CompDraft {
  name: string;
  sku: string;
  supplier: string;
  origin: string;
  stock_qty: string;
  price: string;
  notes: string;
}

const emptyComp = (): CompDraft => ({ name: "", sku: "", supplier: "", origin: "", stock_qty: "", price: "", notes: "" });

export default function ProductFormDialog({ open, onOpenChange, editProduct }: Props) {
  const { addProduct, updateProduct, suppliers } = useData();

  const [form, setForm] = useState(() => initForm(editProduct));
  const [comps, setComps] = useState<CompDraft[]>(() =>
    editProduct?.components?.map(c => ({
      name: c.name, sku: c.sku || "", supplier: c.supplier || "",
      origin: c.origin || "", stock_qty: String(c.stock_qty ?? ""), price: String(c.price ?? ""), notes: c.notes || "",
    })) || []
  );

  function initForm(p?: Product | null) {
    return {
      name: p?.name || "",
      sku: p?.sku || "",
      category: p?.category || "מיגון ואיתור",
      division: p?.division || "",
      product_type: p?.product_type || "מוגמר",
      supplier: p?.supplier || "",
      supplier_origin: p?.supplier_origin || "",
      shipping: p?.shipping || "",
      purchase_price: String(p?.purchase_price ?? ""),
      sale_price: String(p?.sale_price ?? ""),
      monthly_sales: String(p?.monthly_sales ?? ""),
      monthly_order: String(p?.monthly_order ?? ""),
      stock_qty: String(p?.stock_qty ?? 0),
      incoming_qty: String(p?.incoming_qty ?? 0),
      reorder_point: String(p?.reorder_point ?? ""),
      lead_time_days: String(p?.lead_time_days ?? ""),
      notes: p?.notes || "",
      description: p?.description || "",
      end_product_url: p?.end_product_url || "",
    };
  }

  // Reset when dialog opens with new product
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setForm(initForm(editProduct));
      setComps(editProduct?.components?.map(c => ({
        name: c.name, sku: c.sku || "", supplier: c.supplier || "",
        origin: c.origin || "", stock_qty: String(c.stock_qty ?? ""), price: String(c.price ?? ""), notes: c.notes || "",
      })) || []);
    }
    onOpenChange(v);
  };

  const setField = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const numOrNull = (v: string) => v === "" ? null : Number(v);

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.sku.trim()) {
      toast.error("שם ומק״ט הם שדות חובה");
      return;
    }

    const productData: any = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      category: form.category,
      division: form.division || null,
      product_type: form.product_type,
      supplier: form.supplier || null,
      supplier_origin: form.supplier_origin || null,
      shipping: form.shipping || null,
      purchase_price: numOrNull(form.purchase_price),
      sale_price: numOrNull(form.sale_price),
      monthly_sales: numOrNull(form.monthly_sales),
      monthly_order: numOrNull(form.monthly_order),
      stock_qty: Number(form.stock_qty) || 0,
      incoming_qty: Number(form.incoming_qty) || 0,
      reorder_point: numOrNull(form.reorder_point),
      lead_time_days: numOrNull(form.lead_time_days),
      notes: form.notes || null,
      description: form.description || null,
      end_product_url: form.end_product_url || null,
    };

    const compData = comps.filter(c => c.name.trim()).map(c => ({
      name: c.name.trim(),
      sku: c.sku || null,
      supplier: c.supplier || null,
      origin: c.origin || null,
      stock_qty: numOrNull(c.stock_qty),
      price: numOrNull(c.price),
      notes: c.notes || null,
    }));

    if (editProduct) {
      await updateProduct(editProduct.id, productData);
      toast.success("המוצר עודכן");
    } else {
      await addProduct(productData, compData);
      toast.success("המוצר נוצר");
    }
    onOpenChange(false);
  };

  const catOptions = categories.filter(c => c !== "הכל");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editProduct ? "עריכת מוצר" : "הוספת מוצר חדש"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>שם מוצר *</Label>
              <Input value={form.name} onChange={e => setField("name", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>מק״ט *</Label>
              <Input value={form.sku} onChange={e => setField("sku", e.target.value)} dir="ltr" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>קטגוריה</Label>
              <Select value={form.category} onValueChange={v => setField("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{catOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>סוג</Label>
              <Select value={form.product_type} onValueChange={v => setField("product_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="מוגמר">מוגמר</SelectItem>
                  <SelectItem value="מורכב">מורכב</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>חטיבה</Label>
              <Input value={form.division} onChange={e => setField("division", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>ספק</Label>
              <Select value={form.supplier || "__none__"} onValueChange={v => setField("supplier", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="בחר ספק" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">ללא</SelectItem>
                  {suppliers.map(s => <SelectItem key={s.id} value={s.company}>{s.company}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>מקור ספק</Label>
              <Input value={form.supplier_origin} onChange={e => setField("supplier_origin", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label>מלאי</Label>
              <Input type="number" value={form.stock_qty} onChange={e => setField("stock_qty", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>בדרך</Label>
              <Input type="number" value={form.incoming_qty} onChange={e => setField("incoming_qty", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>מחיר רכישה</Label>
              <Input type="number" value={form.purchase_price} onChange={e => setField("purchase_price", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>מחיר מכירה</Label>
              <Input type="number" value={form.sale_price} onChange={e => setField("sale_price", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label>הזמנה חודשית</Label>
              <Input type="number" value={form.monthly_order} onChange={e => setField("monthly_order", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>מכירות חודשיות</Label>
              <Input type="number" value={form.monthly_sales} onChange={e => setField("monthly_sales", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>נק׳ הזמנה מחדש</Label>
              <Input type="number" value={form.reorder_point} onChange={e => setField("reorder_point", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>זמן אספקה (ימים)</Label>
              <Input type="number" value={form.lead_time_days} onChange={e => setField("lead_time_days", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>תיאור</Label>
            <Textarea value={form.description} onChange={e => setField("description", e.target.value)} rows={2} />
          </div>

          <div className="space-y-1">
            <Label>הערות</Label>
            <Textarea value={form.notes} onChange={e => setField("notes", e.target.value)} rows={2} />
          </div>

          {/* Components section - only for new composite products */}
          {!editProduct && form.product_type === "מורכב" && (
            <div className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">רכיבים (BOM)</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setComps(prev => [...prev, emptyComp()])}>
                  <Plus className="h-3 w-3 ml-1" />רכיב
                </Button>
              </div>
              {comps.map((comp, i) => (
                <div key={i} className="grid grid-cols-[1fr_80px_120px_80px_80px_auto] gap-2 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">שם *</Label>
                    <Input value={comp.name} onChange={e => { const nc = [...comps]; nc[i].name = e.target.value; setComps(nc); }} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">מק״ט</Label>
                    <Input value={comp.sku} onChange={e => { const nc = [...comps]; nc[i].sku = e.target.value; setComps(nc); }} className="h-8 text-xs" dir="ltr" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">ספק</Label>
                    <Input value={comp.supplier} onChange={e => { const nc = [...comps]; nc[i].supplier = e.target.value; setComps(nc); }} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">מלאי</Label>
                    <Input type="number" value={comp.stock_qty} onChange={e => { const nc = [...comps]; nc[i].stock_qty = e.target.value; setComps(nc); }} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">מחיר</Label>
                    <Input type="number" value={comp.price} onChange={e => { const nc = [...comps]; nc[i].price = e.target.value; setComps(nc); }} className="h-8 text-xs" />
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setComps(prev => prev.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Button onClick={handleSubmit} disabled={!form.name.trim() || !form.sku.trim()} className="w-full">
            {editProduct ? "עדכן מוצר" : "צור מוצר"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
