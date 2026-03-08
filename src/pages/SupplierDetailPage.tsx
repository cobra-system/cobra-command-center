import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useData, useAuth, type Supplier, type Priority, type OrderStatus } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { OrderStatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowRight, Pencil, Trash2, ExternalLink, Mail, Phone, Globe, TruckIcon } from "lucide-react";
import { InlineEditField } from "@/components/InlineEditField";
import SapSyncBadge from "@/components/SapSyncBadge";
import { toast } from "sonner";

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { suppliers, orders, products, updateSupplier, deleteSupplier } = useData();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const supplier = suppliers.find(s => s.id === id);

  if (!supplier) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-lg text-muted-foreground">ספק לא נמצא</p>
        <Button variant="outline" onClick={() => navigate("/suppliers")}><ArrowRight className="h-4 w-4 ml-2" />חזרה לספקים</Button>
      </div>
    );
  }

  const isManager = currentUser?.role === "MANAGER";
  const relatedOrders = orders.filter(o => o.supplier_id === supplier.id || o.supplier_name === supplier.company);
  const relatedProducts = products.filter(p => p.supplier === supplier.company);

  const handleDelete = async () => {
    await deleteSupplier(supplier.id);
    toast.success("ספק נמחק בהצלחה");
    navigate("/suppliers");
  };

  const handleInlineSave = async (field: string, value: string) => {
    const updates: Partial<Supplier> = {};
    (updates as any)[field] = value || null;
    await updateSupplier(supplier.id, updates);
    toast.success("עודכן");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate("/suppliers")}><ArrowRight className="h-5 w-5" /></Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{supplier.company}</h1>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">{supplier.country === "ישראל" ? "🇮🇱 ישראל" : "🌍 חו״ל"}</p>
            <SapSyncBadge sapCode={(supplier as any).sap_code} />
          </div>
        </div>
        {isManager && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4 ml-1" />עריכה</Button>
            <Button variant="destructive" size="sm" onClick={() => setDeleteConfirm(true)}><Trash2 className="h-4 w-4 ml-1" />מחיקה</Button>
          </div>
        )}
      </div>

      {/* Contact Info */}
      <div className="bg-card rounded-xl border shadow-sm p-5">
        <h2 className="text-lg font-semibold text-foreground mb-4">פרטי קשר</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <InlineEditField label="איש קשר" value={supplier.contact_name} onSave={(v) => handleInlineSave("contact_name", v)} disabled={!isManager} />
          <InlineEditField
            label="אימייל"
            value={supplier.email}
            onSave={(v) => handleInlineSave("email", v)}
            disabled={!isManager}
            displayValue={supplier.email ? (
              <a href={`mailto:${supplier.email}`} className="text-sm text-accent hover:underline flex items-center gap-1" dir="ltr">
                <Mail className="h-3 w-3" />{supplier.email}
              </a>
            ) : "—"}
          />
          <InlineEditField
            label="טלפון"
            value={supplier.phone}
            onSave={(v) => handleInlineSave("phone", v)}
            disabled={!isManager}
            displayValue={supplier.phone ? (
              <a href={`tel:${supplier.phone}`} className="text-sm text-accent hover:underline flex items-center gap-1" dir="ltr">
                <Phone className="h-3 w-3" />{supplier.phone}
              </a>
            ) : "—"}
          />
          <InlineEditField
            label="אתר"
            value={supplier.website}
            onSave={(v) => handleInlineSave("website", v)}
            disabled={!isManager}
            displayValue={supplier.website ? (
              <a href={supplier.website.startsWith("http") ? supplier.website : `https://${supplier.website}`} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline flex items-center gap-1" dir="ltr">
                <Globe className="h-3 w-3" />{supplier.website}
              </a>
            ) : "—"}
          />
        </div>
        <div className="mt-4 pt-4 border-t grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InlineEditField label="מדינה" value={supplier.country} onSave={(v) => handleInlineSave("country", v)} disabled={!isManager} />
          <InlineEditField label="תנאי תשלום" value={supplier.payment_terms} onSave={(v) => handleInlineSave("payment_terms", v)} disabled={!isManager} />
          <InlineEditField label="מוצרים" value={supplier.products} onSave={(v) => handleInlineSave("products", v)} disabled={!isManager} />
          <InlineEditField label="הערות" value={supplier.notes} onSave={(v) => handleInlineSave("notes", v)} disabled={!isManager} />
        </div>
      </div>

      {/* Related Products */}
      <div className="bg-card rounded-xl border shadow-sm p-5">
        <h2 className="text-lg font-semibold text-foreground mb-4">מוצרים משויכים ({relatedProducts.length})</h2>
        {relatedProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-right p-3 font-semibold text-foreground">מוצר</th>
                <th className="text-right p-3 font-semibold text-foreground">מק״ט</th>
                <th className="text-right p-3 font-semibold text-foreground">קטגוריה</th>
                <th className="text-right p-3 font-semibold text-foreground">מלאי</th>
              </tr></thead>
              <tbody className="divide-y">
                {relatedProducts.map(p => (
                  <tr key={p.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/products/${p.id}`)}>
                    <td className="p-3 font-medium text-foreground">{p.name}</td>
                    <td className="p-3 text-muted-foreground font-mono text-xs" dir="ltr">{p.sku}</td>
                    <td className="p-3 text-muted-foreground">{p.category}</td>
                    <td className="p-3 text-muted-foreground">{p.stock_qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">אין מוצרים משויכים לספק זה</p>
        )}
      </div>

      {/* Related Orders */}
      <div className="bg-card rounded-xl border shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4"><TruckIcon className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold text-foreground">היסטוריית הזמנות ({relatedOrders.length})</h2></div>
        {relatedOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-right p-3 font-semibold text-foreground">עדיפות</th>
                <th className="text-right p-3 font-semibold text-foreground">פריטים</th>
                <th className="text-right p-3 font-semibold text-foreground">סה״כ</th>
                <th className="text-right p-3 font-semibold text-foreground">סטטוס</th>
                <th className="text-right p-3 font-semibold text-foreground">תאריך</th>
              </tr></thead>
              <tbody className="divide-y">
                {relatedOrders.map(order => (
                  <tr key={order.id} className="cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/orders/${order.id}`)}>
                    <td className="p-3"><PriorityBadge priority={order.priority as Priority} /></td>
                    <td className="p-3 text-muted-foreground text-xs">{order.items.map(i => i.name).join(", ")}</td>
                    <td className="p-3 text-muted-foreground">{order.total_price ? `$${order.total_price}` : "—"}</td>
                    <td className="p-3"><OrderStatusBadge status={order.status as OrderStatus} /></td>
                    <td className="p-3 text-muted-foreground text-xs">{order.order_date ? new Date(order.order_date).toLocaleDateString("he-IL") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">אין הזמנות קשורות לספק זה</p>
        )}
      </div>

      {/* Edit Dialog */}
      <SupplierEditDialog open={editOpen} onOpenChange={setEditOpen} supplier={supplier} onSave={updateSupplier} />

      {/* Delete Confirm */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>מחיקת ספק</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">האם למחוק את הספק <strong>{supplier.company}</strong>? פעולה זו לא ניתנת לביטול.</p>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirm(false)}>ביטול</Button>
            <Button variant="destructive" onClick={handleDelete}>מחק</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Inline edit dialog component
function SupplierEditDialog({ open, onOpenChange, supplier, onSave }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier;
  onSave: (id: string, updates: Partial<Supplier>) => Promise<void>;
}) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = (key: string, value: string) => setFields(prev => ({ ...prev, [key]: value }));

  if (open && Object.keys(fields).length === 0) {
    const init: Record<string, string> = {
      company: supplier.company || "",
      contact_name: supplier.contact_name || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      country: supplier.country || "",
      website: supplier.website || "",
      products: supplier.products || "",
      notes: supplier.notes || "",
      payment_terms: supplier.payment_terms || "",
    };
    setTimeout(() => setFields(init), 0);
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Partial<Supplier> = {};
      for (const [key, value] of Object.entries(fields)) {
        (updates as any)[key] = value || null;
      }
      updates.company = fields.company;
      updates.contact_name = fields.contact_name;
      await onSave(supplier.id, updates);
      onOpenChange(false);
      setFields({});
      toast.success("ספק עודכן בהצלחה");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setFields({}); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>עריכת ספק</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">שם חברה *</Label>
              <Input value={fields.company ?? ""} onChange={e => set("company", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">איש קשר *</Label>
              <Input value={fields.contact_name ?? ""} onChange={e => set("contact_name", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">אימייל</Label>
              <Input type="email" value={fields.email ?? ""} onChange={e => set("email", e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">טלפון</Label>
              <Input value={fields.phone ?? ""} onChange={e => set("phone", e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">מדינה</Label>
              <Input value={fields.country ?? ""} onChange={e => set("country", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">אתר</Label>
              <Input value={fields.website ?? ""} onChange={e => set("website", e.target.value)} dir="ltr" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">תנאי תשלום</Label>
            <Input value={fields.payment_terms ?? ""} onChange={e => set("payment_terms", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">מוצרים</Label>
            <Input value={fields.products ?? ""} onChange={e => set("products", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">הערות</Label>
            <Textarea value={fields.notes ?? ""} onChange={e => set("notes", e.target.value)} rows={2} />
          </div>
          <Button onClick={handleSave} className="w-full" disabled={saving || !fields.company?.trim() || !fields.contact_name?.trim()}>
            {saving ? "שומר..." : "שמור שינויים"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
