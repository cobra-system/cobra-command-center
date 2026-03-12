import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useData } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { DateInput } from "@/components/ui/date-input";
import { Plus, Upload, Loader2, Pencil, Trash2, Package } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface ComplianceItem {
  id: string;
  name: string;
  product_id: string | null;
  category: string;
  expiry_date: string | null;
  renewal_contact: string | null;
  document_url: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

const DEFAULT_CATEGORIES = ["תקשורת", "יבוא", "דיגום", "אישורים"];

function getDaysRemaining(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const now = new Date();
  const exp = new Date(expiryDate);
  return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function StatusBadge({ status, daysLeft }: { status: string; daysLeft: number | null }) {
  if (status === "missing" || daysLeft === null) {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">⬜ חסר</span>;
  }
  if (daysLeft < 0) {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/15 text-destructive">🔴 פג תוקף</span>;
  }
  if (daysLeft <= 30) {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/15 text-destructive">🔴 {daysLeft} ימים</span>;
  }
  if (daysLeft <= 90) {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-warning/15 text-warning">🟡 {daysLeft} ימים</span>;
  }
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-success/15 text-success">🟢 {daysLeft} ימים</span>;
}

export default function ComplianceTab({ productId }: { productId?: string } = {}) {
  const { currentUser } = useAuth();
  const { products } = useData();
  const navigate = useNavigate();
  const isManager = currentUser?.role === "MANAGER";
  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [productLinks, setProductLinks] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ComplianceItem | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("compliance_items")
      .select("*")
      .order("expiry_date", { ascending: true });
    if (data) setItems(data as ComplianceItem[]);

    const { data: links } = await supabase.from("compliance_product_links").select("compliance_item_id, product_id");
    if (links) {
      const map: Record<string, string[]> = {};
      links.forEach((l: any) => {
        if (!map[l.compliance_item_id]) map[l.compliance_item_id] = [];
        map[l.compliance_item_id].push(l.product_id);
      });
      setProductLinks(map);
    }
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const productMap = useMemo(() => {
    const map: Record<string, string> = {};
    products.forEach(p => { map[p.id] = p.name; });
    return map;
  }, [products]);

  const allCategories = useMemo(() => {
    const cats = new Set(DEFAULT_CATEGORIES);
    items.forEach(i => cats.add(i.category));
    return Array.from(cats);
  }, [items]);

  const filteredItems = useMemo(() => {
    if (!productId) return items;
    return items.filter(item =>
      item.product_id === productId || (productLinks[item.id] || []).includes(productId)
    );
  }, [items, productId, productLinks]);

  const grouped = useMemo(() => {
    const groups: Record<string, ComplianceItem[]> = {};
    allCategories.forEach(c => { groups[c] = []; });
    filteredItems.forEach(item => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  }, [filteredItems, allCategories]);

  const handleUpload = async (itemId: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.jpg,.jpeg,.png,.doc,.docx";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const filePath = `compliance/${itemId}/${file.name}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, file, { upsert: true });
      if (uploadError) { toast({ title: "שגיאה בהעלאה", description: uploadError.message, variant: "destructive" }); return; }
      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(filePath);
      await supabase.from("compliance_items").update({ document_url: urlData.publicUrl }).eq("id", itemId);
      toast({ title: "✅ מסמך הועלה בהצלחה" });
      fetchItems();
    };
    input.click();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("compliance_items").delete().eq("id", id);
    if (error) toast({ title: "שגיאה במחיקה", variant: "destructive" });
    else { toast({ title: "🗑️ רישיון נמחק" }); fetchItems(); }
  };

  const openEdit = (item: ComplianceItem) => { setEditingItem(item); setDialogOpen(true); };
  const openAdd = () => { setEditingItem(null); setDialogOpen(true); };

  if (loading) {
    return (
      <div className="space-y-4 pt-4">
        <Skeleton className="h-6 w-32" />
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pt-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">מעקב רישיונות, אישורים ואחריות תקנות</p>
        {isManager && (
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4 ml-1" />
            הוסף רישיון
          </Button>
        )}
      </div>

      {allCategories.map(cat => {
        const catItems = grouped[cat] || [];
        if (catItems.length === 0) return null;
        return (
          <div key={cat} className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">{cat}</h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {catItems.map(item => {
                const daysLeft = getDaysRemaining(item.expiry_date);
                const linkedProductIds = productLinks[item.id] || [];
                const linkedProductNames = linkedProductIds.map(pid => productMap[pid]).filter(Boolean);
                return (
                  <div key={item.id} className="bg-card rounded-xl border p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground text-sm">{item.name}</h3>
                        {linkedProductNames.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {linkedProductNames.map((pn, i) => (
                              <button key={i} onClick={() => navigate(`/products/${linkedProductIds[i]}`)} className="flex items-center gap-1 text-xs text-primary hover:underline">
                                <Package className="h-3 w-3" />{pn}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <StatusBadge status={item.status} daysLeft={daysLeft} />
                    </div>

                    <div className="space-y-1 text-xs text-muted-foreground">
                      {item.expiry_date && <p>תוקף: {new Date(item.expiry_date).toLocaleDateString("he-IL")}</p>}
                      {item.renewal_contact && <p>איש קשר: {item.renewal_contact}</p>}
                      {item.notes && <p className="text-foreground/70">{item.notes}</p>}
                    </div>

                    <div className="flex items-center gap-1 flex-wrap">
                      {item.document_url ? (
                        <a href={item.document_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">📄 צפה במסמך</a>
                      ) : (
                        <span className="text-xs text-muted-foreground">אין מסמך</span>
                      )}
                      {isManager && (
                        <>
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleUpload(item.id)}>
                            <Upload className="h-3 w-3 ml-1" />העלה
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEdit(item)}>
                            <Pencil className="h-3 w-3 ml-1" />ערוך
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive">
                                <Trash2 className="h-3 w-3 ml-1" />מחק
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>מחיקת רישיון</AlertDialogTitle>
                                <AlertDialogDescription>האם למחוק את "{item.name}"? פעולה זו אינה הפיכה.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="flex-row-reverse gap-2">
                                <AlertDialogCancel>ביטול</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(item.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">מחק</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {items.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">אין רישיונות ואישורים עדיין</p>
          {isManager && <p className="text-xs mt-1">לחץ על "הוסף רישיון" כדי להתחיל</p>}
        </div>
      )}

      <ComplianceFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editingItem}
        products={products}
        onSaved={() => { setDialogOpen(false); fetchItems(); }}
      />
    </div>
  );
}

function ComplianceFormDialog({ open, onOpenChange, item, products, onSaved }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  item: ComplianceItem | null;
  products: { id: string; name: string }[];
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("אישורים");
  const [expiryDate, setExpiryDate] = useState<Date>();
  const [renewalContact, setRenewalContact] = useState("");
  const [notes, setNotes] = useState("");
  const [productId, setProductId] = useState<string>("none");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setCategory(item.category);
      setExpiryDate(item.expiry_date ? new Date(item.expiry_date) : undefined);
      setRenewalContact(item.renewal_contact || "");
      setNotes(item.notes || "");
      setProductId(item.product_id || "none");
    } else {
      setName("");
      setCategory("אישורים");
      setExpiryDate(undefined);
      setRenewalContact("");
      setNotes("");
      setProductId("none");
    }
  }, [item, open]);

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: "נא להזין שם", variant: "destructive" }); return; }
    setSaving(true);

    const daysLeft = expiryDate ? Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
    let status = "active";
    if (!expiryDate) status = "missing";
    else if (daysLeft! < 0) status = "expired";
    else if (daysLeft! <= 60) status = "expiring_soon";

    const payload = {
      name,
      category,
      expiry_date: expiryDate?.toISOString().split("T")[0] || null,
      renewal_contact: renewalContact || null,
      notes: notes || null,
      product_id: productId === "none" ? null : productId,
      status,
    };

    if (item) {
      const { error } = await supabase.from("compliance_items").update(payload).eq("id", item.id);
      if (error) toast({ title: "שגיאה בעדכון", variant: "destructive" });
      else toast({ title: "✅ רישיון עודכן" });
    } else {
      const { error } = await supabase.from("compliance_items").insert(payload);
      if (error) toast({ title: "שגיאה ביצירה", variant: "destructive" });
      else toast({ title: "✅ רישיון נוסף" });
    }
    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{item ? "עריכת רישיון" : "הוסף רישיון / אישור"}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label className="text-xs">שם</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="שם הרישיון או האישור" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">קטגוריה</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEFAULT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="או הקלד קטגוריה חדשה..." className="mt-1 text-xs h-8" onBlur={e => { if (e.target.value.trim()) setCategory(e.target.value.trim()); }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">מוצר מקושר</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger><SelectValue placeholder="ללא" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ללא מוצר</SelectItem>
                  {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">תאריך תפוגה</Label>
            <DateInput value={expiryDate} onChange={setExpiryDate} clearable />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">איש קשר לחידוש</Label>
            <Input value={renewalContact} onChange={e => setRenewalContact(e.target.value)} placeholder="שם ופרטי קשר" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">הערות</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
            {item ? "שמור שינויים" : "הוסף רישיון"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
