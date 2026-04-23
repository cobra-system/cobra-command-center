import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useData } from "@/contexts/AppContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowRight, Package, Pencil, Trash2, Save, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhotoCaptureButton } from "@/components/ui/PhotoCaptureButton";
import { toast } from "sonner";

export default function ComponentDetailPage() {
  const { productId, componentId } = useParams<{ productId: string; componentId: string }>();
  const navigate = useNavigate();
  const { products, suppliers, updateComponent, deleteComponent } = useData();
  const { hasEdit } = usePermissions("products");
  const { hasEdit: hasInventoryEdit } = usePermissions("inventory");
  const canEditStock = hasEdit || hasInventoryEdit;

  const product = products.find(p => p.id === productId);
  const component = product?.components?.find(c => c.id === componentId);

  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState({
    name: "",
    sku: "",
    supplier: "",
    origin: "",
    stock_qty: "",
    price: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  if (!product || !component) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-lg text-muted-foreground">פריט לא נמצא</p>
        <Button variant="outline" onClick={() => navigate(productId ? `/products/${productId}` : "/products")}>
          <ArrowRight className="h-4 w-4 ml-2" />חזרה למוצר
        </Button>
      </div>
    );
  }

  const startEdit = () => {
    setFields({
      name: component.name || "",
      sku: component.sku || "",
      supplier: component.supplier || "",
      origin: component.origin || "",
      stock_qty: component.stock_qty?.toString() || "",
      price: component.price?.toString() || "",
      notes: component.notes || "",
    });
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const saveEdit = async () => {
    if (!fields.name.trim()) { toast.error("שם הפריט הוא שדה חובה"); return; }
    setSaving(true);
    try {
      await updateComponent(component.id, {
        name: fields.name,
        sku: fields.sku || null,
        supplier: fields.supplier || null,
        origin: fields.origin || null,
        stock_qty: fields.stock_qty ? Number(fields.stock_qty) : null,
        price: fields.price ? Number(fields.price) : null,
        notes: fields.notes || null,
      });
      toast.success("הפריט עודכן");
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    await deleteComponent(component.id);
    toast.success("הפריט נמחק");
    navigate(`/products/${productId}`);
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={() => navigate("/products")} className="hover:text-foreground transition-colors">מוצרים</button>
        <span>/</span>
        <button onClick={() => navigate(`/products/${productId}`)} className="hover:text-foreground transition-colors">{product.name}</button>
        <span>/</span>
        <span className="text-foreground font-medium">{component.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="shrink-0">
            <PhotoCaptureButton
              imageUrl={component.image_url}
              storagePath={`components/${component.id}`}
              onSave={async (url) => { await updateComponent(component.id, { image_url: url }); }}
              disabled={!canEditStock}
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{component.name}</h1>
            {component.sku && (
              <p className="text-sm text-muted-foreground font-mono mt-0.5" dir="ltr">{component.sku}</p>
            )}
            <div className="flex items-center gap-1.5 mt-1">
              <Package className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                פריט של{" "}
                <button onClick={() => navigate(`/products/${productId}`)} className="text-primary hover:underline">
                  {product.name}
                </button>
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {hasEdit && !editing && (
            <Button variant="outline" size="sm" onClick={startEdit}>
              <Pencil className="h-4 w-4 ml-1" />ערוך
            </Button>
          )}
          {hasEdit && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4 ml-1" />מחק
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>מחיקת פריט</AlertDialogTitle>
                  <AlertDialogDescription>
                    האם למחוק את הפריט "{component.name}"? פעולה זו אינה ניתנת לביטול.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>ביטול</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    מחק
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Details Card */}
      <div className="bg-card rounded-xl border shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">פרטי פריט</h2>
          {editing && (
            <div className="flex gap-2">
              <Button size="sm" onClick={saveEdit} disabled={saving}>
                <Save className="h-4 w-4 ml-1" />{saving ? "שומר..." : "שמור"}
              </Button>
              <Button size="sm" variant="outline" onClick={cancelEdit} disabled={saving}>
                <X className="h-4 w-4 ml-1" />ביטול
              </Button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">שם פריט *</Label>
              <Input value={fields.name} onChange={e => setFields(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">מק״ט</Label>
              <Input value={fields.sku} onChange={e => setFields(p => ({ ...p, sku: e.target.value.toUpperCase() }))} dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">ספק</Label>
              <Select value={fields.supplier || "__none__"} onValueChange={v => setFields(p => ({ ...p, supplier: v === "__none__" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="בחר ספק" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">ללא</SelectItem>
                  {suppliers.map(s => <SelectItem key={s.id} value={s.company}>{s.company}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">מוצא</Label>
              <Input value={fields.origin} onChange={e => setFields(p => ({ ...p, origin: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">מלאי</Label>
              <Input type="number" value={fields.stock_qty} onChange={e => setFields(p => ({ ...p, stock_qty: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">מחיר ($)</Label>
              <Input type="number" value={fields.price} onChange={e => setFields(p => ({ ...p, price: e.target.value }))} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">הערות</Label>
              <Input value={fields.notes} onChange={e => setFields(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {[
              { label: "שם פריט", value: component.name },
              { label: 'מק"ט', value: component.sku || "—", mono: true },
              { label: "ספק", value: component.supplier || "—", isSupplier: true },
              { label: "מוצא", value: component.origin || "—" },
              { label: "מלאי", value: component.stock_qty ?? "—" },
              { label: "מחיר ($)", value: component.price != null ? `$${component.price}` : "—" },
              { label: "הערות", value: component.notes || "—", wide: true },
            ].map(item => (
              <div key={item.label} className={item.wide ? "sm:col-span-2" : ""}>
                <dt className="text-xs text-muted-foreground mb-0.5">{item.label}</dt>
                <dd className={`font-medium text-foreground ${item.mono ? "font-mono text-xs" : ""}`}>
                  {item.isSupplier && component.supplier ? (() => {
                    const s = suppliers.find(sup => sup.company === component.supplier);
                    return s ? (
                      <button onClick={() => navigate(`/suppliers/${s.id}`)} className="text-primary hover:underline">
                        {component.supplier}
                      </button>
                    ) : component.supplier;
                  })() : item.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
