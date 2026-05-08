/* eslint-disable @typescript-eslint/no-explicit-any */
import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useData, useAuth, type Supplier, type SupplierContact, type Priority, type OrderStatus, type Product } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { OrderStatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowRight, Pencil, Trash2, ExternalLink, Mail, Phone, Globe, TruckIcon, UserPlus, Users, X, Link2, Search, Plus } from "lucide-react";
import DocumentsSection from "@/components/DocumentsSection";
import ProductFormDialog from "@/components/products/ProductFormDialog";
import { InlineEditField } from "@/components/InlineEditField";
import { usePermissions } from "@/hooks/usePermissions";
import { useProductScope } from "@/hooks/useProductScope";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { canSeePrices } from "@/lib/permissions";

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const showPrices = canSeePrices(currentUser);
  const { updateSupplier, deleteSupplier, refreshSuppliers, updateProduct } = useData();
  const { scopedSuppliers: suppliers, scopedOrders: orders, scopedProducts: products, isScoped } = useProductScope();
  const { hasEdit } = usePermissions("suppliers");

  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteContactConfirm, setDeleteContactConfirm] = useState<string | null>(null);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [editContactOpen, setEditContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<SupplierContact | null>(null);
  const [newContact, setNewContact] = useState({ name: "", role: "", email: "", phone: "" });
  const [savingContact, setSavingContact] = useState(false);
  const [linkProductOpen, setLinkProductOpen] = useState(false);
  const [linkProductSearch, setLinkProductSearch] = useState("");
  const [linkProductId, setLinkProductId] = useState("");
  const [linkingSaving, setLinkingSaving] = useState(false);
  const [createProductOpen, setCreateProductOpen] = useState(false);

  const supplier = suppliers.find(s => s.id === id);

  if (!supplier) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-lg text-muted-foreground">ספק לא נמצא</p>
        <Button variant="outline" onClick={() => navigate("/suppliers")}><ArrowRight className="h-4 w-4 ml-2" />חזרה לספקים</Button>
      </div>
    );
  }

  const relatedOrders = orders.filter(o => o.supplier_id === supplier.id || o.supplier_name === supplier.company);

  // Filter products by supplier_id (preferred) or supplier name (fallback)
  const relatedProducts = products.filter(p =>
    p.supplier_id === supplier.id || p.supplier === supplier.company
  );

  const componentProducts = products
    .filter(p => p.product_type === "מורכב" && p.components?.some(c => c.supplier === supplier.company))
    .filter(p => !relatedProducts.some(rp => rp.id === p.id))
    .map(p => ({
      product: p,
      components: p.components?.filter(c => c.supplier === supplier.company) || [],
    }));
  const contacts = supplier.contacts || [];

  const handleDelete = async () => {
    await deleteSupplier(supplier.id);
    toast.success("ספק נמחק בהצלחה");
    navigate("/suppliers");
  };

  const handleInlineSave = async (field: string, value: string) => {
    const updates: Partial<Supplier> = {};
    (updates as any)[field] = value || null;
    await updateSupplier(supplier.id, updates).catch(() => {});
  };

  const handleAddContact = async () => {
    if (!newContact.name.trim()) return;
    setSavingContact(true);
    try {
      const { error } = await supabase.from("supplier_contacts").insert({
        supplier_id: supplier.id,
        name: newContact.name,
        role: newContact.role || null,
        email: newContact.email || null,
        phone: newContact.phone || null,
        is_primary: contacts.length === 0,
      } as any);
      if (error) { toast.error("שגיאה בהוספת איש קשר: " + error.message); return; }
      await refreshSuppliers();
      setNewContact({ name: "", role: "", email: "", phone: "" });
      setAddContactOpen(false);
      toast.success("איש קשר נוסף");
    } finally {
      setSavingContact(false);
    }
  };

  const handleEditContact = async () => {
    if (!editingContact || !newContact.name.trim()) return;
    setSavingContact(true);
    try {
      const { error } = await supabase.from("supplier_contacts").update({
        name: newContact.name,
        role: newContact.role || null,
        email: newContact.email || null,
        phone: newContact.phone || null,
      }).eq("id", editingContact.id);
      if (error) { toast.error("שגיאה בעדכון איש קשר: " + error.message); return; }
      await refreshSuppliers();
      setNewContact({ name: "", role: "", email: "", phone: "" });
      setEditContactOpen(false);
      setEditingContact(null);
      toast.success("איש קשר עודכן");
    } finally {
      setSavingContact(false);
    }
  };

  const openEditContact = (contact: SupplierContact) => {
    setEditingContact(contact);
    setNewContact({
      name: contact.name,
      role: contact.role || "",
      email: contact.email || "",
      phone: contact.phone || "",
    });
    setEditContactOpen(true);
  };

  const handleDeleteContact = async (contactId: string) => {
    const { error } = await supabase.from("supplier_contacts").delete().eq("id", contactId);
    if (error) { toast.error("שגיאה במחיקת איש קשר: " + error.message); return; }
    await refreshSuppliers();
    toast.success("איש קשר נמחק");
  };

  const handleLinkProduct = async () => {
    if (!linkProductId) return;
    setLinkingSaving(true);
    try {
      await updateProduct(linkProductId, {
        supplier: supplier.company,
      });
      setLinkProductOpen(false);
      setLinkProductId("");
      setLinkProductSearch("");
      toast.success("מוצר שויך לספק");
    } finally {
      setLinkingSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate("/suppliers")} data-navigate-to="/suppliers"><ArrowRight className="h-5 w-5" /></Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground truncate">{supplier.company}</h1>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">{supplier.country === "ישראל" ? "🇮🇱 ישראל" : "🌍 חו״ל"}</p>
          </div>
        </div>
        {hasEdit && (
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
          <InlineEditField label="איש קשר ראשי" value={supplier.contact_name} onSave={(v) => handleInlineSave("contact_name", v)} disabled={!hasEdit} />
          <InlineEditField
            label="אימייל"
            value={supplier.email}
            onSave={(v) => handleInlineSave("email", v)}
            disabled={!hasEdit}
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
            disabled={!hasEdit}
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
            disabled={!hasEdit}
            displayValue={supplier.website ? (
              <a href={supplier.website.startsWith("http") ? supplier.website : `https://${supplier.website}`} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline flex items-center gap-1" dir="ltr">
                <Globe className="h-3 w-3" />{supplier.website}
              </a>
            ) : "—"}
          />
        </div>
        <div className="mt-4 pt-4 border-t grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InlineEditField label="מספר ספק" value={supplier.supplier_number} onSave={(v) => handleInlineSave("supplier_number", v)} disabled={!hasEdit} />
          <InlineEditField label="מדינה" value={supplier.country} onSave={(v) => handleInlineSave("country", v)} disabled={!hasEdit} />
          {showPrices && <InlineEditField label="תנאי תשלום" value={supplier.payment_terms} onSave={(v) => handleInlineSave("payment_terms", v)} disabled={!hasEdit} />}
          <InlineEditField label="מוצרים" value={supplier.products} onSave={(v) => handleInlineSave("products", v)} disabled={!hasEdit} />
          <InlineEditField label="הערות" value={supplier.notes} onSave={(v) => handleInlineSave("notes", v)} disabled={!hasEdit} />
        </div>
        <div className="mt-4 pt-4 border-t grid grid-cols-1 sm:grid-cols-3 gap-4">
          <InlineEditField
            label="רמת סיכון"
            value={supplier.risk_level}
            onSave={(v) => handleInlineSave("risk_level", v)}
            disabled={!hasEdit}
            displayValue={supplier.risk_level ? (
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                supplier.risk_level === "low" ? "bg-success/15 text-success" :
                supplier.risk_level === "medium" ? "bg-warning/15 text-warning" :
                "bg-destructive/15 text-destructive"
              }`}>
                {supplier.risk_level === "low" ? "נמוך" : supplier.risk_level === "medium" ? "בינוני" : "גבוה"}
              </span>
            ) : "—"}
          />
          <InlineEditField
            label="זמן הובלה (ימים)"
            value={supplier.lead_time_days?.toString()}
            onSave={(v) => handleInlineSave("lead_time_days", v)}
            disabled={!hasEdit}
            displayValue={supplier.lead_time_days ? `${supplier.lead_time_days} ימים` : "—"}
          />
          <InlineEditField
            label="ספק גיבוי"
            value={supplier.backup_supplier_id}
            onSave={(v) => handleInlineSave("backup_supplier_id", v)}
            disabled={!hasEdit}
            displayValue={supplier.backup_supplier_id ? (
              <button
                onClick={() => {
                  const backupSupplier = suppliers.find(s => s.id === supplier.backup_supplier_id);
                  if (backupSupplier) navigate(`/suppliers/${backupSupplier.id}`);
                }}
                data-navigate-to={`/suppliers/${supplier.backup_supplier_id}`}
                className="text-sm text-primary hover:underline"
              >
                {suppliers.find(s => s.id === supplier.backup_supplier_id)?.company || "—"}
              </button>
            ) : "—"}
          />
        </div>
      </div>

      {/* Additional Contacts */}
      {(contacts.length > 0 || hasEdit) && (
        <div className="bg-card rounded-xl border shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">אנשי קשר ({contacts.length})</h2>
            </div>
            {hasEdit && (
              <Button variant="outline" size="sm" onClick={() => { setNewContact({ name: "", role: "", email: "", phone: "" }); setAddContactOpen(true); }}>
                <UserPlus className="h-4 w-4 ml-1" />הוסף איש קשר
              </Button>
            )}
          </div>
          {contacts.length > 0 ? (
            <div className="space-y-3">
              {contacts.map(contact => (
                <div key={contact.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 border">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">שם</p>
                      <p className="text-sm font-medium text-foreground">{contact.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">תפקיד</p>
                      <p className="text-sm text-foreground">{contact.role || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">אימייל</p>
                      {contact.email ? (
                        <a href={`mailto:${contact.email}`} className="text-sm text-accent hover:underline" dir="ltr">{contact.email}</a>
                      ) : <p className="text-sm text-muted-foreground">—</p>}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">טלפון</p>
                      {contact.phone ? (
                        <a href={`tel:${contact.phone}`} className="text-sm text-accent hover:underline" dir="ltr">{contact.phone}</a>
                      ) : <p className="text-sm text-muted-foreground">—</p>}
                    </div>
                  </div>
                  {hasEdit && (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEditContact(contact)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteContactConfirm(contact.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-3">אין אנשי קשר נוספים</p>
          )}
        </div>
      )}

      {/* Related Products */}
      <div className="bg-card rounded-xl border shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">מוצרים משויכים ({relatedProducts.length + componentProducts.length})</h2>
          {hasEdit && (
            <Button size="sm" variant="outline" onClick={() => setLinkProductOpen(true)}>
              <Link2 className="h-3.5 w-3.5 ml-1" />שייך מוצר
            </Button>
          )}
        </div>
        {(relatedProducts.length > 0 || componentProducts.length > 0) ? (
          <>
            {/* Mobile card list */}
            <div className="md:hidden space-y-2">
              {relatedProducts.map(p => (
                <div key={p.id} className="rounded-lg border bg-muted/20 p-3 cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/products/${p.id}`)} data-navigate-to={`/products/${p.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground truncate flex-1 min-w-0">{p.name}</p>
                    <span className="text-xs font-bold text-foreground shrink-0">×{p.stock_qty}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="font-mono" dir="ltr">{p.sku}</span>
                    {p.category && <span className="truncate">{p.category}</span>}
                  </div>
                </div>
              ))}
              {componentProducts.map(({ product: p, components: comps }) => (
                <div key={p.id} className="rounded-lg border bg-muted/20 p-3 cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/products/${p.id}`)} data-navigate-to={`/products/${p.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground truncate flex-1 min-w-0">{p.name}</p>
                    <span className="text-xs font-bold text-foreground shrink-0">×{p.stock_qty}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">({comps.map(c => c.name).join(", ")})</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="font-mono" dir="ltr">{p.sku}</span>
                    {p.category && <span className="truncate">{p.category}</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50">
                  <th className="text-right p-3 font-semibold text-foreground">מוצר</th>
                  <th className="text-right p-3 font-semibold text-foreground">מק״ט</th>
                  <th className="text-right p-3 font-semibold text-foreground">קטגוריה</th>
                  <th className="text-right p-3 font-semibold text-foreground">מלאי</th>
                </tr></thead>
                <tbody className="divide-y">
                  {relatedProducts.map(p => (
                    <tr key={p.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/products/${p.id}`)} data-navigate-to={`/products/${p.id}`}>
                      <td className="p-3 font-medium text-foreground">{p.name}</td>
                      <td className="p-3 text-muted-foreground font-mono text-xs" dir="ltr">{p.sku}</td>
                      <td className="p-3 text-muted-foreground">{p.category}</td>
                      <td className="p-3 text-muted-foreground">{p.stock_qty}</td>
                    </tr>
                  ))}
                  {componentProducts.map(({ product: p, components: comps }) => (
                    <tr key={p.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/products/${p.id}`)} data-navigate-to={`/products/${p.id}`}>
                      <td className="p-3 font-medium text-foreground">
                        {p.name} <span className="text-xs text-muted-foreground">({comps.map(c => c.name).join(", ")})</span>
                      </td>
                      <td className="p-3 text-muted-foreground font-mono text-xs" dir="ltr">{p.sku}</td>
                      <td className="p-3 text-muted-foreground">{p.category}</td>
                      <td className="p-3 text-muted-foreground">{p.stock_qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">אין מוצרים משויכים לספק זה</p>
        )}
      </div>

      {/* Related Orders */}
      <div className="bg-card rounded-xl border shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><TruckIcon className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold text-foreground">היסטוריית הזמנות ({relatedOrders.length})</h2></div>
          {hasEdit && (
            <Button size="sm" variant="outline" onClick={() => navigate(`/orders?newOrder=true&supplierId=${supplier.id}`)} data-navigate-to={`/orders?newOrder=true&supplierId=${supplier.id}`}>
              <Plus className="h-3.5 w-3.5 ml-1" />הוסף הזמנה
            </Button>
          )}
        </div>
        {relatedOrders.length > 0 ? (
          <>
            {/* Mobile card list */}
            <div className="md:hidden space-y-2">
              {relatedOrders.map(order => (
                <div key={order.id} className="rounded-lg border bg-muted/20 p-3 cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/orders/${order.id}`)} data-navigate-to={`/orders/${order.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground line-clamp-2">{order.items.map(i => i.name).join(", ")}</p>
                    </div>
                    <OrderStatusBadge status={order.status as OrderStatus} />
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <PriorityBadge priority={order.priority as Priority} />
                    {showPrices && order.total_price && <span className="text-xs font-semibold text-foreground">${order.total_price}</span>}
                    <span className="text-xs text-muted-foreground ms-auto">{order.order_date ? new Date(order.order_date).toLocaleDateString("he-IL") : "—"}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50">
                  <th className="text-right p-3 font-semibold text-foreground">עדיפות</th>
                  <th className="text-right p-3 font-semibold text-foreground">פריטים</th>
                  {showPrices && <th className="text-right p-3 font-semibold text-foreground">סה״כ</th>}
                  <th className="text-right p-3 font-semibold text-foreground">סטטוס</th>
                  <th className="text-right p-3 font-semibold text-foreground">תאריך</th>
                </tr></thead>
                <tbody className="divide-y">
                  {relatedOrders.map(order => (
                    <tr key={order.id} className="cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/orders/${order.id}`)} data-navigate-to={`/orders/${order.id}`}>
                      <td className="p-3"><PriorityBadge priority={order.priority as Priority} /></td>
                      <td className="p-3 text-muted-foreground text-xs">{order.items.map(i => i.name).join(", ")}</td>
                      {showPrices && <td className="p-3 text-muted-foreground">{order.total_price ? `$${order.total_price}` : "—"}</td>}
                      <td className="p-3"><OrderStatusBadge status={order.status as OrderStatus} /></td>
                      <td className="p-3 text-muted-foreground text-xs">{order.order_date ? new Date(order.order_date).toLocaleDateString("he-IL") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">אין הזמנות קשורות לספק זה</p>
        )}
      </div>

      {/* Documents */}
      <DocumentsSection supplierId={supplier.id} />

      {/* Link Product Dialog */}
      <Dialog open={linkProductOpen} onOpenChange={open => { setLinkProductOpen(open); if (!open) { setLinkProductSearch(""); setLinkProductId(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>שיוך מוצר לספק</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="relative">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="חפש מוצר..."
                className="pr-9"
                value={linkProductSearch}
                onChange={e => { setLinkProductSearch(e.target.value); setLinkProductId(""); }}
              />
            </div>
            <div className="max-h-60 overflow-y-auto divide-y rounded-lg border">
              {products
                .filter(p =>
                  (p.supplier !== supplier.company && p.supplier_id !== supplier.id) &&
                  p.name.toLowerCase().includes(linkProductSearch.toLowerCase())
                )
                .slice(0, 30)
                .map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setLinkProductId(p.id); setLinkProductSearch(p.name); }}
                    className={`w-full text-right px-3 py-2 text-sm hover:bg-muted/50 transition-colors ${linkProductId === p.id ? "bg-primary/10 text-primary font-medium" : ""}`}
                  >
                    <span>{p.name}</span>
                    <span className="text-xs text-muted-foreground mr-2 font-mono">{p.sku}</span>
                  </button>
                ))}
              {products.filter(p =>
                (p.supplier !== supplier.company && p.supplier_id !== supplier.id) &&
                p.name.toLowerCase().includes(linkProductSearch.toLowerCase())
              ).length === 0 && (
                <div className="text-center py-4 space-y-2">
                  <p className="text-sm text-muted-foreground">מוצר לא נמצא</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setLinkProductOpen(false); setCreateProductOpen(true); }}
                  >
                    <Plus className="h-4 w-4 ml-1" />הגדר מוצר חדש
                  </Button>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleLinkProduct} className="flex-1" disabled={!linkProductId || linkingSaving}>
                {linkingSaving ? "משייך..." : "שייך מוצר"}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setLinkProductOpen(false); setCreateProductOpen(true); }}
              >
                <Plus className="h-4 w-4 ml-1" />מוצר חדש
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Product Dialog (pre-linked to this supplier) */}
      <ProductFormDialog
        open={createProductOpen}
        onOpenChange={setCreateProductOpen}
        presetSupplierId={supplier.id}
        presetSupplierName={supplier.company}
        presetProductName={linkProductSearch}
      />

      {/* Edit Dialog */}
      <SupplierEditDialog open={editOpen} onOpenChange={setEditOpen} supplier={supplier} onSave={updateSupplier} />

      {/* Add Contact Dialog */}
      <Dialog open={addContactOpen} onOpenChange={setAddContactOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>הוספת איש קשר</DialogTitle></DialogHeader>
          <ContactForm contact={newContact} setContact={setNewContact} saving={savingContact} onSubmit={handleAddContact} submitLabel="הוסף" />
        </DialogContent>
      </Dialog>

      {/* Edit Contact Dialog */}
      <Dialog open={editContactOpen} onOpenChange={(open) => { setEditContactOpen(open); if (!open) setEditingContact(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>עריכת איש קשר</DialogTitle></DialogHeader>
          <ContactForm contact={newContact} setContact={setNewContact} saving={savingContact} onSubmit={handleEditContact} submitLabel="שמור שינויים" />
        </DialogContent>
      </Dialog>

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

      {/* Delete Contact Confirm */}
      <Dialog open={!!deleteContactConfirm} onOpenChange={(open) => { if (!open) setDeleteContactConfirm(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>מחיקת איש קשר</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">האם למחוק את איש הקשר? פעולה זו אינה ניתנת לביטול.</p>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeleteContactConfirm(null)}>ביטול</Button>
            <Button variant="destructive" onClick={() => { handleDeleteContact(deleteContactConfirm!); setDeleteContactConfirm(null); }}>מחק</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Reusable contact form
function ContactForm({ contact, setContact, saving, onSubmit, submitLabel }: {
  contact: { name: string; role: string; email: string; phone: string };
  setContact: (c: any) => void;
  saving: boolean;
  onSubmit: () => void;
  submitLabel: string;
}) {
  return (
    <div className="space-y-3 pt-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">שם *</Label>
          <Input value={contact.name} onChange={e => setContact((p: any) => ({ ...p, name: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">תפקיד</Label>
          <Input value={contact.role} onChange={e => setContact((p: any) => ({ ...p, role: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">אימייל</Label>
          <Input type="email" value={contact.email} onChange={e => setContact((p: any) => ({ ...p, email: e.target.value }))} dir="ltr" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">טלפון</Label>
          <Input value={contact.phone} onChange={e => setContact((p: any) => ({ ...p, phone: e.target.value }))} dir="ltr" />
        </div>
      </div>
      <Button onClick={onSubmit} className="w-full" disabled={saving || !contact.name.trim()}>
        {saving ? "שומר..." : submitLabel}
      </Button>
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
  const { currentUser } = useAuth();
  const showPrices = canSeePrices(currentUser);
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
      supplier_number: supplier.supplier_number || "",
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
    } catch {
      // error toast already shown by context
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setFields({}); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>עריכת ספק</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div className="space-y-1">
              <Label className="text-xs">מספר ספק</Label>
              <Input value={fields.supplier_number ?? ""} onChange={e => set("supplier_number", e.target.value)} dir="ltr" placeholder="לדוג' 042" />
            </div>
          </div>
          {showPrices && (
            <div className="space-y-1">
              <Label className="text-xs">תנאי תשלום</Label>
              <Input value={fields.payment_terms ?? ""} onChange={e => set("payment_terms", e.target.value)} />
            </div>
          )}
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
