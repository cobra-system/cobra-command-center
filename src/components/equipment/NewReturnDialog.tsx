import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useData, useAuth } from "@/contexts/AppContext";
import { toast } from "sonner";
import { restockInventoryForReturn } from "@/lib/inventoryUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { DateInput } from "@/components/ui/date-input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2 } from "lucide-react";

interface Installer {
  id: string;
  name: string;
  warehouse_number: number | null;
}

interface ReturnItemRow {
  product_id: string;
  quantity: number;
  reason: string;
  reason_detail: string;
  sticker_label: string;
  serial_numbers: string;
}

const REASONS = ["תקלת התקנה", "מוצר פגום", "לא תואם רכב", "עודף", "אחר"];

const emptyItem = (): ReturnItemRow => ({
  product_id: "",
  quantity: 1,
  reason: "אחר",
  reason_detail: "",
  sticker_label: "",
  serial_numbers: "",
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  preselectedInstallerId?: string;
  divisionProductIds?: string[];
}

export function NewReturnDialog({ open, onOpenChange, onCreated, preselectedInstallerId, divisionProductIds }: Props) {
  const { products } = useData();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [installers, setInstallers] = useState<Installer[]>([]);
  const [installerId, setInstallerId] = useState(preselectedInstallerId ?? "");
  const [returnDate, setReturnDate] = useState<Date | undefined>(new Date());
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ReturnItemRow[]>([emptyItem()]);

  useEffect(() => {
    if (open) {
      supabase
        .from("installers")
        .select("id, name, warehouse_number")
        .eq("status", "פעיל")
        .order("name")
        .then(({ data }) => setInstallers(data ?? []));
      setInstallerId(preselectedInstallerId ?? "");
      setReturnDate(new Date());
      setNotes("");
      setItems([emptyItem()]);
    }
  }, [open, preselectedInstallerId]);

  const installerOptions = useMemo(
    () =>
      installers.map((i) => ({
        value: i.id,
        label: i.warehouse_number ? `${i.name} (${i.warehouse_number})` : i.name,
      })),
    [installers]
  );

  const productOptions = useMemo(() => {
    const filtered = divisionProductIds
      ? products.filter((p) => divisionProductIds.includes(p.id))
      : products;
    return filtered.map((p) => ({
      value: p.id,
      label: p.sku ? `${p.name} · ${p.sku}` : p.name,
    }));
  }, [products, divisionProductIds]);

  const updateItem = <K extends keyof ReturnItemRow>(
    idx: number,
    field: K,
    value: ReturnItemRow[K]
  ) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!installerId) {
      toast.error("יש לבחור מתקין");
      return;
    }
    if (!returnDate) {
      toast.error("יש לבחור תאריך");
      return;
    }
    const validItems = items.filter((item) => item.product_id && item.quantity > 0);
    if (validItems.length === 0) {
      toast.error("יש להוסיף לפחות פריט אחד");
      return;
    }

    setSaving(true);
    try {
      const { data: ret, error: retError } = await supabase
        .from("equipment_returns")
        .insert({
          installer_id: installerId,
          return_date: returnDate.toISOString().split("T")[0],
          notes: notes.trim() || null,
        })
        .select("id")
        .single();

      if (retError || !ret) throw retError ?? new Error("שגיאה ביצירת ההחזרה");

      const itemRows = validItems.map((item) => ({
        return_id: ret.id,
        product_id: item.product_id,
        quantity: item.quantity,
        reason: item.reason,
        reason_detail: item.reason_detail.trim() || null,
        sticker_label: item.sticker_label.trim() || null,
        serial_numbers: item.serial_numbers.trim()
          ? item.serial_numbers.split(",").map((s) => s.trim()).filter(Boolean)
          : null,
      }));

      const { error: itemsError } = await supabase
        .from("equipment_return_items")
        .insert(itemRows);

      if (itemsError) throw itemsError;

      // Restock main center inventory (fire-and-forget)
      const installerName =
        installers.find((i) => i.id === installerId)?.name ?? "לא ידוע";
      restockInventoryForReturn(
        validItems.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        installerName,
        (user as { name?: string } | null)?.name ?? null
      ).catch(() => {/* inventory sync errors are non-critical */});

      toast.success("ההחזרה נשמרה בהצלחה");
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בשמירת ההחזרה");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>החזרה חדשה</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>מתקין *</Label>
              <Combobox
                value={installerId}
                onValueChange={setInstallerId}
                options={installerOptions}
                placeholder="בחר מתקין..."
                searchPlaceholder="חיפוש מתקין..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>תאריך *</Label>
              <DateInput value={returnDate} onChange={setReturnDate} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>הערות</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="הערות..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>פריטים מוחזרים</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-3.5 w-3.5 ms-1" />
                הוסף פריט
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-start p-3 border rounded-md bg-muted/30">
                  <div className="flex-1 space-y-2">
                    <Combobox
                      value={item.product_id}
                      onValueChange={(v) => updateItem(idx, "product_id", v)}
                      options={productOptions}
                      placeholder="בחר מוצר..."
                      searchPlaceholder={'חיפוש לפי שם או מק"ט...'}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">כמות</Label>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 1)}
                          className="h-8"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">סיבה</Label>
                        <Select
                          value={item.reason}
                          onValueChange={(v) => updateItem(idx, "reason", v)}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {REASONS.map((r) => (
                              <SelectItem key={r} value={r}>
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">פירוט סיבה</Label>
                        <Input
                          value={item.reason_detail}
                          onChange={(e) => updateItem(idx, "reason_detail", e.target.value)}
                          placeholder="פירוט..."
                          className="h-8"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">תוכן מדבקה</Label>
                        <Input
                          value={item.sticker_label}
                          onChange={(e) => updateItem(idx, "sticker_label", e.target.value)}
                          placeholder="טקסט מהמדבקה..."
                          className="h-8"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">מספרים סידוריים (מופרדים בפסיק)</Label>
                      <Input
                        value={item.serial_numbers}
                        onChange={(e) => updateItem(idx, "serial_numbers", e.target.value)}
                        placeholder="SN1, SN2, ..."
                        className="h-8"
                        dir="ltr"
                      />
                    </div>
                  </div>
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive mt-1"
                      onClick={() => removeItem(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            ביטול
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
            שמור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
