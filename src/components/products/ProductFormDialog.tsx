import { useState, useCallback } from "react";
import { useData, useAuth, categories, divisions, type Product, type ProductComponent } from "@/contexts/AppContext";
import { canSeePrices } from "@/lib/permissions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { CategorySelect } from "@/components/ui/CategorySelect";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { productSchema, productComponentSchema } from "@/lib/schemas/productSchema";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editProduct?: Product | null;
  presetSupplierId?: string;
  presetSupplierName?: string;
  presetProductName?: string;
  presetDivision?: string;
  onCreated?: () => void;
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

export default function ProductFormDialog({ open, onOpenChange, editProduct, presetSupplierId, presetSupplierName, presetProductName, presetDivision, onCreated }: Props) {
  const { addProduct, updateProduct, suppliers, products } = useData();
  const { currentUser } = useAuth();
  const showPrices = canSeePrices(currentUser);

  const [form, setForm] = useState(() => initForm(editProduct, presetDivision));
  const [comps, setComps] = useState<CompDraft[]>(() =>
    editProduct?.components?.map(c => ({
      name: c.name, sku: c.sku || "", supplier: c.supplier || "",
      origin: c.origin || "", stock_qty: String(c.stock_qty ?? ""), price: String(c.price ?? ""), notes: c.notes || "",
    })) || []
  );
  // When the typed name matches an existing product (exact or close), we
  // prompt instead of creating a duplicate: attach the existing product to
  // this division, or cancel.
  const [existingPrompt, setExistingPrompt] = useState<Product | null>(null);

  function initForm(p?: Product | null, preDiv?: string) {
    return {
      name: p?.name || (!p && presetProductName) || "",
      sku: p?.sku || "",
      category: p?.category || "מיגון ואיתור",
      division: p?.division || (!p && preDiv) || "",
      product_type: p?.product_type || "מוגמר",
      supplier: p?.supplier || (!p && presetSupplierName) || "",
      shipping: p?.shipping || "",
      purchase_price: String(p?.purchase_price ?? ""),
      sale_price: String(p?.sale_price ?? ""),
      price_currency: p?.price_currency || "USD",
      monthly_order: String(p?.monthly_order ?? ""),
      stock_qty: String(p?.stock_qty ?? 0),
      lead_time_days: String(p?.lead_time_days ?? ""),
      notes: p?.notes || "",
      description: p?.description || "",
      end_product_url: p?.end_product_url || "",
    };
  }

  // Reset when dialog opens with new product
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setForm(initForm(editProduct, presetDivision));
      setComps(editProduct?.components?.map(c => ({
        name: c.name, sku: c.sku || "", supplier: c.supplier || "",
        origin: c.origin || "", stock_qty: String(c.stock_qty ?? ""), price: String(c.price ?? ""), notes: c.notes || "",
      })) || []);
    }
    onOpenChange(v);
  };

  const setField = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  // Detect an existing product with a matching or close-matching name. Compared
  // by trimmed lowercase: exact equality first, otherwise a substring match
  // either way (≥3 chars). Only meaningful when creating, not editing.
  const findExistingMatch = useCallback((): Product | null => {
    if (editProduct) return null;
    const q = form.name.trim().toLowerCase();
    if (!q) return null;
    const exact = products.find(p => p.name.trim().toLowerCase() === q);
    if (exact) return exact;
    if (q.length < 3) return null;
    return products.find(p => {
      const pn = p.name.trim().toLowerCase();
      return pn.includes(q) || q.includes(pn);
    }) ?? null;
  }, [form.name, products, editProduct]);

  const numOrNull = (v: string) => v === "" ? null : Number(v);

  const handleSubmit = async () => {
    // If a product with the same/similar name already exists, ask whether to
    // attach it to the current division instead of silently creating a duplicate.
    const existing = findExistingMatch();
    if (existing) {
      setExistingPrompt(existing);
      return;
    }
    await persistProduct();
  };

  const handleAttachExistingToDivision = async () => {
    if (!existingPrompt) return;
    const targetDivision = presetDivision || form.division;
    if (!targetDivision) {
      toast.error("לא נבחרה חטיבה לצירוף");
      setExistingPrompt(null);
      return;
    }
    // Each division gets one row per product; conflict is silent so the
    // operation is idempotent (e.g. user confirms twice).
    const divisions = targetDivision.split(",").map(d => d.trim()).filter(Boolean);
    const rows = divisions.map(d => ({ division: d, product_id: existingPrompt.id }));
    const { error } = await supabase
      .from("division_products")
      .upsert(rows, { onConflict: "division,product_id" });
    if (error) {
      toast.error("שגיאה בצירוף המוצר לחטיבה");
      return;
    }
    toast.success("המוצר צורף לחטיבה");
    setExistingPrompt(null);
    onCreated?.();
    onOpenChange(false);
  };

  const persistProduct = async () => {
    // Build raw data for Zod validation
    const rawProduct = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      category: form.category,
      division: form.division || null,
      product_type: form.product_type,
      supplier: form.supplier || null,
      shipping: form.shipping || null,
      purchase_price: numOrNull(form.purchase_price),
      sale_price: numOrNull(form.sale_price),
      price_currency: form.price_currency,
      monthly_order: numOrNull(form.monthly_order),
      stock_qty: Number(form.stock_qty) || 0,
      lead_time_days: numOrNull(form.lead_time_days),
      notes: form.notes || null,
      description: form.description || null,
      end_product_url: form.end_product_url || null,
    };

    const productResult = productSchema.safeParse(rawProduct);
    if (!productResult.success) {
      const firstError = productResult.error.errors[0];
      toast.error(firstError.message);
      return;
    }
    // zod widens every key to optional under this project's non-strict
    // tsconfig; the parse above has already enforced name and sku.
    const productData = productResult.data as Omit<Product, "id" | "components">;

    const rawComps = comps.filter(c => c.name.trim()).map(c => ({
      name: c.name.trim(),
      sku: c.sku || null,
      supplier: c.supplier || null,
      origin: c.origin || null,
      stock_qty: numOrNull(c.stock_qty),
      price: numOrNull(c.price),
      notes: c.notes || null,
    }));

    for (const comp of rawComps) {
      const compResult = productComponentSchema.safeParse(comp);
      if (!compResult.success) {
        toast.error(compResult.error.errors[0].message);
        return;
      }
    }
    const compData = rawComps;

    try {
      if (editProduct) {
        await updateProduct(editProduct.id, productData);
      } else {
        await addProduct(productData, compData);
        onCreated?.();
      }
      onOpenChange(false);
    } catch {
      // error already shown by AppContext
    }
  };

  const catOptions = categories.filter(c => c !== "הכל");

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg md:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editProduct ? "עריכת מוצר" : "הוספת מוצר חדש"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>שם מוצר *</Label>
              <Input value={form.name} onChange={e => setField("name", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>מק״ט *</Label>
              <Input value={form.sku} onChange={e => setField("sku", e.target.value.toUpperCase())} dir="ltr" />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>קטגוריה</Label>
              <CategorySelect value={form.category} onValueChange={v => setField("category", v)} />
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
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <Label>חטיבות</Label>
              <div className="flex flex-wrap gap-1 p-2 border rounded-md min-h-[36px]">
                {divisions.map(d => {
                  const current = (form.division || "").split(",").map(s => s.trim()).filter(Boolean);
                  const selected = current.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        const newVals = selected ? current.filter(v => v !== d) : [...current, d];
                        setField("division", newVals.join(", "));
                      }}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${selected ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"}`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>ספק</Label>
              <Combobox
                value={form.supplier || ""}
                onValueChange={v => setField("supplier", v)}
                options={[{ value: "", label: "ללא" }, ...suppliers.map(s => ({ value: s.company, label: s.company }))]}
                placeholder="בחר ספק"
                searchPlaceholder="חיפוש ספק..."
              />
            </div>
          </div>

          <div className={showPrices ? "grid grid-cols-2 sm:grid-cols-3 gap-3" : "grid grid-cols-1 gap-3"}>
            <div className="space-y-1">
              <Label>מלאי</Label>
              <Input type="number" value={form.stock_qty} onChange={e => setField("stock_qty", e.target.value)} />
            </div>
            {showPrices && (
              <>
                <div className="space-y-1">
                  <Label>מחיר רכישה</Label>
                  <div className="flex gap-1">
                    <Input type="number" value={form.purchase_price} onChange={e => setField("purchase_price", e.target.value)} className="flex-1" />
                    <Select value={form.price_currency} onValueChange={v => setField("price_currency", v)}>
                      <SelectTrigger className="w-16 shrink-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">$</SelectItem>
                        <SelectItem value="ILS">₪</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <Label>מחיר מכירה</Label>
                  <div className="flex gap-1">
                    <Input type="number" value={form.sale_price} onChange={e => setField("sale_price", e.target.value)} className="flex-1" />
                    <span className="flex items-center text-sm text-muted-foreground px-2 border rounded-md bg-muted/30 shrink-0">
                      {form.price_currency === "ILS" ? "₪" : "$"}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>הזמנה חודשית</Label>
              <Input type="number" value={form.monthly_order} onChange={e => setField("monthly_order", e.target.value)} />
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
                <div key={i} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">שם *</Label>
                      <Input value={comp.name} onChange={e => { const nc = [...comps]; nc[i].name = e.target.value; setComps(nc); }} className="h-8 text-xs" />
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setComps(prev => prev.filter((_, j) => j !== i))}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">מק״ט</Label>
                      <Input value={comp.sku} onChange={e => { const nc = [...comps]; nc[i].sku = e.target.value.toUpperCase(); setComps(nc); }} className="h-8 text-xs" dir="ltr" />
                    </div>
                    <div className="space-y-1 col-span-2 sm:col-span-1">
                      <Label className="text-xs">ספק</Label>
                      <Combobox
                        value={comp.supplier || ""}
                        onValueChange={v => { const nc = [...comps]; nc[i].supplier = v; setComps(nc); }}
                        options={[{ value: "", label: "ללא" }, ...suppliers.map(s => ({ value: s.company, label: s.company }))]}
                        placeholder="בחר ספק"
                        searchPlaceholder="חיפוש..."
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">מדינת מקור</Label>
                      <Input value={comp.origin} onChange={e => { const nc = [...comps]; nc[i].origin = e.target.value; setComps(nc); }} className="h-8 text-xs" placeholder="לדוג' סין" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">מלאי</Label>
                      <Input type="number" value={comp.stock_qty} onChange={e => { const nc = [...comps]; nc[i].stock_qty = e.target.value; setComps(nc); }} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">מחיר</Label>
                      <Input type="number" value={comp.price} onChange={e => { const nc = [...comps]; nc[i].price = e.target.value; setComps(nc); }} className="h-8 text-xs" />
                    </div>
                  </div>
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

    <AlertDialog open={!!existingPrompt} onOpenChange={(o) => { if (!o) setExistingPrompt(null); }}>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle>לא ניתן ליצור מוצר כפול</AlertDialogTitle>
          <AlertDialogDescription>
            {existingPrompt && (
              <>
                המוצר &quot;{existingPrompt.name}&quot;{existingPrompt.sku ? ` (מק״ט ${existingPrompt.sku})` : ""} כבר קיים במערכת — זו הסיבה שהיצירה לא הצליחה.
                {presetDivision || form.division ? " ניתן לצרף את המוצר הקיים לחטיבה שלך במקום ליצור כפול." : " האם לנווט אל המוצר הקיים?"}
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setExistingPrompt(null)}>בטל</AlertDialogCancel>
          {(presetDivision || form.division) && (
            <AlertDialogAction onClick={handleAttachExistingToDivision}>צרף לחטיבה</AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
