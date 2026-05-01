/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Product, categories, divisions } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabase";

const productCategories = categories.filter(c => c !== "הכל");
const productTypes = ["מוגמר", "מורכב"];
const shippingMethods = ["אוויר", "ים", "יבשה", "שילוב", "בין ספקים"];

interface Supplier {
  id: string;
  company: string;
  country: string | null;
}

interface ProductEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product;
  onSave: (id: string, updates: Record<string, any>) => Promise<void>;
}

export default function ProductEditDialog({ open, onOpenChange, product, onSave }: ProductEditDialogProps) {
  const [fields, setFields] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    supabase.from("suppliers").select("id, company, country").order("company").then(({ data }) => {
      if (data) setSuppliers(data);
    });
  }, []);

  useEffect(() => {
    if (open && product) {
      setFields({
        name: product.name || "",
        sku: product.sku || "",
        category: product.category || "",
        division: product.division || "",
        product_type: product.product_type || "",
        description: product.description || "",
        supplier: product.supplier || "",
        shipping: product.shipping || "",
        purchase_price: product.purchase_price ?? "",
        sale_price: product.sale_price ?? "",
        monthly_order: product.monthly_order ?? "",
        monthly_sales_avg: product.monthly_sales_avg ?? "",
        stock_qty: product.stock_qty ?? 0,
        lead_time_days: product.lead_time_days ?? "",
        end_product_url: product.end_product_url || "",
        end_product_image: product.end_product_image || "",
        notes: product.notes || "",
      });
    }
  }, [open, product]);

  const set = (key: string, value: any) => setFields(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Record<string, any> = {};
      const numericFields = ["purchase_price", "sale_price", "monthly_order", "monthly_sales_avg", "stock_qty", "lead_time_days"];
      const textFields = ["name", "sku", "category", "division", "product_type", "description", "supplier", "shipping", "end_product_url", "end_product_image", "notes"];

      for (const key of textFields) {
        updates[key] = fields[key] === "" ? null : fields[key];
      }
      // name, sku, category, product_type are required
      updates.name = fields.name;
      updates.sku = fields.sku;
      updates.category = fields.category;
      updates.product_type = fields.product_type;

      for (const key of numericFields) {
        const val = fields[key];
        updates[key] = val === "" || val === null || val === undefined ? null : Number(val);
      }
      updates.stock_qty = updates.stock_qty ?? 0;

      await onSave(product.id, updates);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const numField = (key: string, label: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" value={fields[key] ?? ""} onChange={e => set(key, e.target.value)} />
    </div>
  );

  const textField = (key: string, label: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={fields[key] ?? ""} onChange={e => set(key, e.target.value)} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg md:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>עריכת מוצר</DialogTitle></DialogHeader>
        <div className="space-y-5 pt-2">
          {/* Basic Info */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">פרטים בסיסיים</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {textField("name", "שם מוצר")}
              {textField("sku", "מק״ט")}
              <div className="space-y-1">
                <Label className="text-xs">קטגוריה</Label>
                <Select value={fields.category || ""} onValueChange={v => set("category", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {productCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">חטיבות</Label>
                <div className="flex flex-wrap gap-1 p-2 border rounded-md min-h-[36px]">
                  {divisions.map(d => {
                    const current = (fields.division || "").split(",").map((s: string) => s.trim()).filter(Boolean);
                    const selected = current.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          const newVals = selected ? current.filter((v: string) => v !== d) : [...current, d];
                          set("division", newVals.join(", "));
                        }}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${selected ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"}`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">סוג מוצר</Label>
                <Select value={fields.product_type || ""} onValueChange={v => set("product_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {productTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">תיאור</Label>
                <Textarea value={fields.description ?? ""} onChange={e => set("description", e.target.value)} rows={2} />
              </div>
            </div>
          </div>

          {/* Supplier & Shipping */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">ספק ומשלוח</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">ספק</Label>
                <Select value={fields.supplier || ""} onValueChange={v => set("supplier", v)}>
                  <SelectTrigger><SelectValue placeholder="בחר ספק..." /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.company}>{s.company}{s.country ? ` (${s.country})` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">שיטת משלוח</Label>
                <Select value={fields.shipping || ""} onValueChange={v => set("shipping", v)}>
                  <SelectTrigger><SelectValue placeholder="בחר..." /></SelectTrigger>
                  <SelectContent>
                    {shippingMethods.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {numField("lead_time_days", "זמן אספקה (ימים)")}
            </div>
          </div>

          {/* Pricing */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">מחירים</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {numField("purchase_price", "מחיר רכישה ($)")}
              {numField("sale_price", "מחיר מכירה ($)")}
            </div>
          </div>

          {/* Inventory */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">מלאי והזמנות</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {numField("stock_qty", "מלאי קיים")}
              {numField("monthly_order", "הזמנה חודשית")}
              {numField("monthly_sales_avg", "ממוצע צריכה שנתי (SAP)")}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              מלאי בדרך ומכירות חודשיות מחושבים אוטומטית מהזמנות ומהיסטוריית הוצאות המלאי.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">קישורים</h3>
            <div className="grid grid-cols-1 gap-3">
              {textField("end_product_url", "קישור לאתר המוצר")}
              {textField("end_product_image", "קישור לתמונת המוצר")}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label className="text-xs">הערות</Label>
            <Textarea value={fields.notes ?? ""} onChange={e => set("notes", e.target.value)} rows={2} />
          </div>

          <Button onClick={handleSave} className="w-full" disabled={saving}>
            {saving ? "שומר..." : "שמור שינויים"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
