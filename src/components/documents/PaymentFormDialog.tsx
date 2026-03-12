import { useState, useEffect, useMemo } from "react";
import { useData } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { PurchaseDocument, Payment } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  docs: PurchaseDocument[];
  editPayment?: Payment | null;
}

export default function PaymentFormDialog({ open, onOpenChange, onSaved, docs, editPayment }: Props) {
  const { suppliers, orders } = useData();

  const [paySupplier, setPaySupplier] = useState("");
  const [payOrder, setPayOrder] = useState("");
  const [payDocument, setPayDocument] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payCurrency, setPayCurrency] = useState("USD");
  const [payType, setPayType] = useState("Full");
  const [payDueDate, setPayDueDate] = useState("");
  const [payNotes, setPayNotes] = useState("");

  useEffect(() => {
    if (editPayment) {
      setPaySupplier(editPayment.supplier_id || "");
      setPayOrder(editPayment.order_id || "");
      setPayDocument(editPayment.document_id || "");
      setPayAmount(editPayment.amount?.toString() || "");
      setPayCurrency(editPayment.currency || "USD");
      setPayType(editPayment.payment_type || "Full");
      setPayDueDate(editPayment.due_date || "");
      setPayNotes(editPayment.notes || "");
    } else {
      resetForm();
    }
  }, [editPayment, open]);

  const filteredDocs = useMemo(() => {
    if (!paySupplier) return docs;
    return docs.filter(d => d.supplier_id === paySupplier);
  }, [docs, paySupplier]);

  const resetForm = () => {
    setPaySupplier(""); setPayOrder(""); setPayDocument(""); setPayAmount("");
    setPayCurrency("USD"); setPayType("Full"); setPayDueDate(""); setPayNotes("");
  };

  const handleSubmit = async () => {
    const payload = {
      supplier_id: paySupplier || null,
      order_id: payOrder || null,
      document_id: payDocument || null,
      amount: Number(payAmount) || 0,
      currency: payCurrency,
      payment_type: payType,
      due_date: payDueDate || null,
      notes: payNotes || null,
    };

    if (editPayment) {
      const { error } = await supabase.from("supplier_payments").update(payload).eq("id", editPayment.id);
      if (error) {
        toast.error("שגיאה בעדכון תשלום: " + error.message);
        return;
      }
      toast.success("תשלום עודכן");
    } else {
      const { error } = await supabase.from("supplier_payments").insert(payload);
      if (error) {
        toast.error("שגיאה בהוספת תשלום: " + error.message);
        return;
      }
      toast.success("תשלום נוסף");
    }

    resetForm();
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editPayment ? "עריכת תשלום" : "הוסף תשלום חדש"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1">
            <Label>ספק</Label>
            <Select value={paySupplier} onValueChange={setPaySupplier}>
              <SelectTrigger><SelectValue placeholder="בחר ספק" /></SelectTrigger>
              <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.company}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>הזמנה מקושרת (אופציונלי)</Label>
            <Select value={payOrder} onValueChange={setPayOrder}>
              <SelectTrigger><SelectValue placeholder="בחר הזמנה" /></SelectTrigger>
              <SelectContent>{orders.map(o => <SelectItem key={o.id} value={o.id}>{o.supplier_name || o.id.slice(0, 8)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>מסמך מקושר (אופציונלי)</Label>
            <Select value={payDocument} onValueChange={setPayDocument}>
              <SelectTrigger><SelectValue placeholder="בחר מסמך PI/PO" /></SelectTrigger>
              <SelectContent>
                {filteredDocs.map(d => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.type} — {d.total_price ? `${d.total_price.toLocaleString()} ${d.currency}` : d.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label>סכום</Label><Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} /></div>
            <div className="space-y-1">
              <Label>מטבע</Label>
              <Select value={payCurrency} onValueChange={setPayCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD $</SelectItem>
                  <SelectItem value="EUR">EUR €</SelectItem>
                  <SelectItem value="ILS">ILS ₪</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>סוג</Label>
              <Select value={payType} onValueChange={setPayType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Full">מלא</SelectItem>
                  <SelectItem value="Deposit">מקדמה</SelectItem>
                  <SelectItem value="Balance">יתרה</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label>מועד פירעון</Label><Input type="date" value={payDueDate} onChange={e => setPayDueDate(e.target.value)} /></div>
          <div className="space-y-1"><Label>הערות</Label><Textarea value={payNotes} onChange={e => setPayNotes(e.target.value)} rows={2} /></div>
          <Button onClick={handleSubmit} className="w-full">
            {editPayment ? "שמור שינויים" : "הוסף תשלום"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
