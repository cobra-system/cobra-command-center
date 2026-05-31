import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AppContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, PackageX } from "lucide-react";

interface Supplier {
  id: string;
  name: string;
}

interface WasteItem {
  id: string;
  product_name: string;
  sku: string;
  quantity: number;
  disposition_type: string | null;
  supplier_return_id: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (returnId: string) => void;
  preselectedItemId?: string;
}

export function SupplierReturnDialog({ open, onClose, onSaved, preselectedItemId }: Props) {
  const { currentUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [undisposedItems, setUndisposedItems] = useState<WasteItem[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [trackingNumber, setTrackingNumber] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;

    // Reset
    setSupplierId("");
    setSelectedItemIds(preselectedItemId ? new Set([preselectedItemId]) : new Set());
    setTrackingNumber("");
    setReturnReason("");
    setNotes("");

    // Fetch suppliers
    supabase
      .from("suppliers")
      .select("id, name")
      .order("name")
      .then(({ data }) => setSuppliers(data ?? []));

    // Fetch undisposed waste items
    supabase
      .from("waste_items")
      .select("id, product_name, sku, quantity, disposition_type, supplier_return_id")
      .is("disposition_type", null)
      .order("product_name")
      .then(({ data }) => setUndisposedItems(data ?? []));
  }, [open, preselectedItemId]);

  const supplierOptions = useMemo(
    () => suppliers.map((s) => ({ value: s.id, label: s.name })),
    [suppliers]
  );

  const toggleItem = (id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!supplierId) { toast.error("יש לבחור ספק"); return; }
    if (selectedItemIds.size === 0) { toast.error("יש לבחור לפחות פריט אחד"); return; }

    setSaving(true);
    try {
      const { data: ret, error: retErr } = await supabase
        .from("supplier_returns")
        .insert({
          supplier_id: supplierId,
          return_reason: returnReason || null,
          tracking_number: trackingNumber || null,
          notes: notes || null,
          created_by: currentUser?.id,
          created_by_name: currentUser?.name,
        })
        .select()
        .single();

      if (retErr) throw retErr;

      const { error: itemErr } = await supabase
        .from("waste_items")
        .update({
          supplier_return_id: ret.id,
          disposition_type: "החזרה לספק",
          disposition_date: new Date().toISOString(),
        })
        .in("id", [...selectedItemIds]);

      if (itemErr) throw itemErr;

      toast.success("החזרה לספק נוצרה בהצלחה");
      onSaved(ret.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "שגיאה ביצירת ההחזרה";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageX className="h-5 w-5 text-blue-600" />
            יצירת החזרה לספק
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Supplier */}
          <div className="space-y-2">
            <Label>ספק *</Label>
            <Combobox
              value={supplierId}
              onValueChange={setSupplierId}
              options={supplierOptions}
              placeholder="בחר ספק..."
              searchPlaceholder="חיפוש ספק..."
              emptyText="לא נמצא ספק"
            />
          </div>

          {/* Waste items selection */}
          <div className="space-y-2">
            <Label>פריטי בלאי לכלול *</Label>
            {undisposedItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">אין פריטי בלאי ממתינים לפינוי</p>
            ) : (
              <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                {undisposedItems.map((item) => (
                  <label key={item.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40">
                    <Checkbox
                      checked={selectedItemIds.has(item.id)}
                      onCheckedChange={() => toggleItem(item.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.product_name}</p>
                      {item.sku && (
                        <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">{item.quantity} יח׳</span>
                  </label>
                ))}
              </div>
            )}
            {selectedItemIds.size > 0 && (
              <p className="text-xs text-muted-foreground">{selectedItemIds.size} פריטים נבחרו</p>
            )}
          </div>

          {/* Tracking number */}
          <div className="space-y-2">
            <Label htmlFor="tracking">מספר מעקב (אופציונלי)</Label>
            <Input
              id="tracking"
              placeholder="למשל: JD1234567890"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
            />
          </div>

          {/* Return reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">סיבת החזרה</Label>
            <Input
              id="reason"
              placeholder="מוצר פגום, אי-התאמה..."
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">הערות</Label>
            <Textarea
              id="notes"
              placeholder="הערות נוספות..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            ביטול
          </Button>
          <Button onClick={handleSave} disabled={saving || !supplierId || selectedItemIds.size === 0}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : null}
            צור החזרה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
