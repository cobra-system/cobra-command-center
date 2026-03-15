import { useState, useEffect } from "react";
import { useData } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { PurchaseDocument } from "@/components/documents/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  editDocument?: PurchaseDocument | null;
  defaultSupplierId?: string;
  defaultProductId?: string;
  defaultOrderId?: string;
}

export default function DocumentFormDialog({ open, onOpenChange, onSaved, editDocument, defaultSupplierId, defaultProductId, defaultOrderId }: Props) {
  const { suppliers, products, orders } = useData();

  const [formType, setFormType] = useState("PI");
  const [formSupplier, setFormSupplier] = useState("");
  const [formProduct, setFormProduct] = useState("");
  const [formOrder, setFormOrder] = useState("");
  const [formQty, setFormQty] = useState("");
  const [formUnitPrice, setFormUnitPrice] = useState("");
  const [formCurrency, setFormCurrency] = useState("USD");
  const [formNotes, setFormNotes] = useState("");

  useEffect(() => {
    if (editDocument) {
      setFormType(editDocument.type || "PI");
      setFormSupplier(editDocument.supplier_id || "");
      setFormProduct(editDocument.product_id || "");
      setFormOrder((editDocument as any).order_id || "");
      setFormQty(editDocument.quantity?.toString() || "");
      setFormUnitPrice(editDocument.unit_price?.toString() || "");
      setFormCurrency(editDocument.currency || "USD");
      setFormNotes(editDocument.notes || "");
    } else {
      resetForm();
      // Apply defaults after reset
      if (open) {
        if (defaultSupplierId) setFormSupplier(defaultSupplierId);
        if (defaultProductId) {
          setFormProduct(defaultProductId);
          // Auto-set supplier from product
          const prod = products.find(p => p.id === defaultProductId);
          if (prod?.supplier && !defaultSupplierId) {
            const s = suppliers.find(s => s.company === prod.supplier);
            if (s) setFormSupplier(s.id);
          }
        }
      }
    }
  }, [editDocument, open, defaultSupplierId, defaultProductId]);

  const filteredOrders = formSupplier
    ? orders.filter(o => o.supplier_id === formSupplier || o.supplier_name === suppliers.find(s => s.id === formSupplier)?.company)
    : orders;

  const resetForm = () => {
    setFormType("PI"); setFormSupplier(""); setFormProduct(""); setFormOrder("");
    setFormQty(""); setFormUnitPrice(""); setFormCurrency("USD"); setFormNotes("");
  };

  const handleSubmit = async () => {
    const qty = Number(formQty) || 0;
    const unitPrice = Number(formUnitPrice) || 0;
    const payload = {
      type: formType,
      supplier_id: formSupplier || null,
      product_id: formProduct || null,
      quantity: qty,
      unit_price: unitPrice,
      total_price: qty * unitPrice,
      currency: formCurrency,
      notes: formNotes || null,
    };

    if (editDocument) {
      const { error } = await supabase.from("purchase_documents").update(payload).eq("id", editDocument.id);
      if (error) { toast.error("שגיאה בעדכון מסמך: " + error.message); return; }
      toast.success("מסמך עודכן");
    } else {
      const { error } = await supabase.from("purchase_documents").insert(payload);
      if (error) { toast.error("שגיאה בהוספת מסמך: " + error.message); return; }
      toast.success("מסמך נוסף");
    }

    resetForm();
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editDocument ? "עריכת מסמך" : "הוסף מסמך חדש"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>סוג</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PI">PI — הצעת מחיר</SelectItem>
                  <SelectItem value="PO">PO — הזמנת רכש</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>מטבע</Label>
              <Select value={formCurrency} onValueChange={setFormCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD $</SelectItem>
                  <SelectItem value="EUR">EUR €</SelectItem>
                  <SelectItem value="ILS">ILS ₪</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>ספק</Label>
            <Select value={formSupplier} onValueChange={setFormSupplier}>
              <SelectTrigger><SelectValue placeholder="בחר ספק" /></SelectTrigger>
              <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.company}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>מוצר</Label>
            <Select value={formProduct} onValueChange={setFormProduct}>
              <SelectTrigger><SelectValue placeholder="בחר מוצר" /></SelectTrigger>
              <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>הזמנה מקושרת (אופציונלי)</Label>
            <Select value={formOrder} onValueChange={setFormOrder}>
              <SelectTrigger><SelectValue placeholder="בחר הזמנה" /></SelectTrigger>
              <SelectContent>
                {filteredOrders.map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.supplier_name || o.id.slice(0, 8)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>כמות</Label><Input type="number" value={formQty} onChange={e => setFormQty(e.target.value)} /></div>
            <div className="space-y-1"><Label>מחיר יחידה</Label><Input type="number" value={formUnitPrice} onChange={e => setFormUnitPrice(e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label>הערות</Label><Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} /></div>
          <Button onClick={handleSubmit} className="w-full">
            {editDocument ? "שמור שינויים" : "הוסף מסמך"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
