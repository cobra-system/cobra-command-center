import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth, useData } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { format } from "date-fns";
import type { OrderRequest } from "@/contexts/types";
import { Search, Package } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: OrderRequest | null;
  onAttached: () => void;
}

// Orders considered "open" for attaching new line items
const ATTACHABLE_STATUSES = new Set(["PENDING", "ORDERED"]);

export function AttachToOrderDialog({ open, onOpenChange, request, onAttached }: Props) {
  const { orders } = useData();
  const { currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [supplierOnly, setSupplierOnly] = useState(true);
  const [pickedOrderIds, setPickedOrderIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const requestQty = request?.required_to_order ?? request?.quantity ?? 0;
  const requestSupplier = request?.supplier ?? null;

  const candidates = useMemo(() => {
    const list = orders.filter(o => ATTACHABLE_STATUSES.has(o.status));
    const matchesSupplier = (o: typeof orders[number]) =>
      !supplierOnly || !requestSupplier || o.supplier_name === requestSupplier;
    const term = search.trim().toLowerCase();
    return list
      .filter(matchesSupplier)
      .filter(o => {
        if (!term) return true;
        return [o.supplier_name, o.pi_number, o.notes, o.id]
          .filter((v): v is string => !!v)
          .some(v => v.toLowerCase().includes(term));
      })
      .sort((a, b) => {
        const da = a.order_date ? new Date(a.order_date).getTime() : 0;
        const db = b.order_date ? new Date(b.order_date).getTime() : 0;
        return db - da;
      });
  }, [orders, supplierOnly, requestSupplier, search]);

  const togglePick = (id: string) => {
    setPickedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (!request || pickedOrderIds.size === 0) return;
    if (requestQty <= 0) {
      toast.error("לבקשה אין כמות חוקית");
      return;
    }
    setSubmitting(true);

    const ids = Array.from(pickedOrderIds);
    const items = ids.map(orderId => ({
      order_id: orderId,
      product_id: request.product_id ?? null,
      name: request.product_name,
      qty: requestQty,
      price: null,
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(items);
    if (itemsError) {
      setSubmitting(false);
      toast.error("שגיאה בהוספת הפריט להזמנה");
      return;
    }

    const now = new Date().toISOString();
    const { error: reqError } = await supabase
      .from("order_requests")
      .update({
        status: "ordered",
        order_id: ids[0],
        ordered_at: now,
        ordered_by: currentUser?.id ?? null,
        ordered_by_name: currentUser?.name ?? null,
        reviewed_at: now,
        reviewed_by: currentUser?.id ?? null,
        reviewed_by_name: currentUser?.name ?? null,
      })
      .eq("id", request.id);

    setSubmitting(false);

    if (reqError) {
      toast.error("הפריט נוסף, אך עדכון סטטוס הבקשה נכשל");
      return;
    }

    toast.success(ids.length === 1 ? "הבקשה שויכה להזמנה" : `הבקשה שויכה ל-${ids.length} הזמנות`);
    setPickedOrderIds(new Set());
    setSearch("");
    onOpenChange(false);
    onAttached();
  };

  const handleClose = (o: boolean) => {
    if (!o) {
      setPickedOrderIds(new Set());
      setSearch("");
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>שיוך הבקשה להזמנות קיימות</DialogTitle>
        </DialogHeader>

        {request && (
          <div className="space-y-4 pt-2">
            <div className="rounded-lg border bg-muted/20 p-3 text-sm">
              <div className="font-semibold">{request.product_name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {request.product_sku && <span dir="ltr">{request.product_sku} · </span>}
                {request.supplier ?? "ללא ספק"} · כמות {requestQty}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs">חיפוש (מספר PI, ספק, הערות)</Label>
                <div className="relative">
                  <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="חיפוש..."
                    className="h-9 text-sm pr-8"
                  />
                </div>
              </div>
              {requestSupplier && (
                <label className="flex items-center gap-2 text-xs cursor-pointer pb-2 sm:pb-1.5">
                  <Checkbox
                    checked={supplierOnly}
                    onCheckedChange={(c) => setSupplierOnly(!!c)}
                  />
                  רק עבור {requestSupplier}
                </label>
              )}
            </div>

            <div className="rounded-lg border max-h-80 overflow-y-auto">
              {candidates.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <Package className="h-6 w-6 mx-auto mb-2 opacity-40" />
                  אין הזמנות פעילות מתאימות
                </div>
              ) : (
                <ul className="divide-y">
                  {candidates.map(o => {
                    const checked = pickedOrderIds.has(o.id);
                    return (
                      <li key={o.id}>
                        <label className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/30">
                          <Checkbox checked={checked} onCheckedChange={() => togglePick(o.id)} className="mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="font-medium text-sm">{o.supplier_name ?? "ללא ספק"}</span>
                              <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{o.status}</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                              {o.pi_number && <span dir="ltr">PI {o.pi_number}</span>}
                              {o.order_date && <span>{format(new Date(o.order_date), "dd/MM/yyyy")}</span>}
                              <span>{o.items?.length ?? 0} פריטים</span>
                            </div>
                            {o.notes && <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{o.notes}</div>}
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t">
              <span className="text-xs text-muted-foreground">
                {pickedOrderIds.size > 0 ? `נבחרו ${pickedOrderIds.size} הזמנות` : "בחר הזמנה אחת או יותר"}
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => handleClose(false)} disabled={submitting}>ביטול</Button>
                <Button onClick={handleConfirm} disabled={submitting || pickedOrderIds.size === 0}>
                  {submitting ? "משייך..." : "שייך"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
