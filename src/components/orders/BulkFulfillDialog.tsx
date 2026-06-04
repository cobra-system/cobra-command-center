import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAuth, useSuppliers } from "@/contexts/AppContext";
import type { OrderRequest, Order, OrderItem } from "@/contexts/types";
import { fmtNum } from "./orderRequestUtils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requests: OrderRequest[];
  addOrder: (order: Omit<Order, "id" | "items"> & { items: Omit<OrderItem, "id" | "order_id">[] }) => Promise<string | undefined>;
  onDone: () => void;
}

export function BulkFulfillDialog({ open, onOpenChange, requests, addOrder, onDone }: Props) {
  const { currentUser } = useAuth();
  const { suppliers } = useSuppliers();
  const [priority, setPriority] = useState<string>("רגיל");
  const [orderDate, setOrderDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Group selected requests by supplier; bulk-fulfill creates one order per supplier
  const groups = useMemo(() => {
    const map = new Map<string, OrderRequest[]>();
    for (const r of requests) {
      const key = r.supplier ?? "ללא ספק";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries());
  }, [requests]);

  const totals = useMemo(() => {
    let qty = 0;
    for (const r of requests) {
      qty += r.required_to_order ?? r.quantity ?? 0;
    }
    return { qty };
  }, [requests]);

  const submit = async () => {
    setSubmitting(true);
    let createdOrders = 0;
    for (const [supplierName, reqs] of groups) {
      const supplier = suppliers.find(s => s.company === supplierName);
      const items = reqs.map(r => ({
        product_id: r.product_id ?? null,
        name: r.product_name,
        qty: r.required_to_order ?? r.quantity ?? 0,
        price: null,
      }));
      const orderId = await addOrder({
        priority,
        supplier_id: supplier?.id ?? null,
        supplier_name: supplierName,
        status: "ממתין",
        order_date: orderDate,
        notes: notes || `מימוש קבוצתי של ${reqs.length} בקשות`,
        items,
      });
      if (orderId) {
        createdOrders++;
        const now = new Date().toISOString();
        await supabase
          .from("order_requests")
          .update({
            status: "ordered",
            order_id: orderId,
            linked_order_ids: [orderId],
            ordered_at: now,
            ordered_by: currentUser?.id ?? null,
            ordered_by_name: currentUser?.name ?? null,
            reviewed_at: now,
            reviewed_by: currentUser?.id ?? null,
            reviewed_by_name: currentUser?.name ?? null,
          })
          .in("id", reqs.map(r => r.id));
      }
    }
    setSubmitting(false);
    if (createdOrders > 0) {
      toast.success(`נוצרו ${createdOrders} הזמנות`);
      onDone();
      onOpenChange(false);
    } else {
      toast.error("שגיאה ביצירת ההזמנות");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>מימוש קבוצתי — {requests.length} בקשות</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="rounded-lg border bg-muted/20 p-3 text-sm">
            תיווצרנה <span className="font-semibold">{groups.length}</span> הזמנות (אחת לכל ספק).
            סה״כ <span className="font-semibold">{fmtNum(totals.qty)}</span> יחידות.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">תאריך הזמנה</Label>
              <Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">עדיפות</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="דחוף">דחוף</SelectItem>
                  <SelectItem value="רגיל">רגיל</SelectItem>
                  <SelectItem value="נמוך">נמוך</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">הערות (יחולו על כל ההזמנות)</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="אופציונלי" />
          </div>

          {/* Per-supplier preview */}
          <div className="space-y-2">
            {groups.map(([supplier, reqs]) => {
              const groupQty = reqs.reduce((s, r) => s + (r.required_to_order ?? r.quantity ?? 0), 0);
              return (
                <div key={supplier} className="rounded-lg border bg-card">
                  <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between">
                    <div className="font-semibold text-sm">{supplier}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {reqs.length} פריטים · {fmtNum(groupQty)} יח׳
                    </div>
                  </div>
                  <ul className="divide-y">
                    {reqs.map(r => (
                      <li key={r.id} className="px-3 py-1.5 text-xs flex items-center justify-between gap-2">
                        <span className="truncate">{r.product_name}</span>
                        <span className="text-muted-foreground tabular-nums shrink-0">
                          {fmtNum(r.required_to_order ?? r.quantity)} יח׳
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>ביטול</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "יוצר הזמנות..." : `צור ${groups.length} הזמנה(ות)`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
