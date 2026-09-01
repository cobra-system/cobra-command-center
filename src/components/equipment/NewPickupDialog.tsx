import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useData, useAuth } from "@/contexts/AppContext";
import { toast } from "sonner";
import { deductInventoryForPickup } from "@/lib/inventoryUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { DateInput } from "@/components/ui/date-input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Plus, Trash2 } from "lucide-react";

interface Installer {
  id: string;
  name: string;
  warehouse_number: number | null;
  division: string;
}

interface PickupItemRow {
  id?: string;
  product_id: string;
  quantity: number;
  serial_numbers: string;
}

interface EditingPickup {
  id: string;
  installer_id: string;
  pickup_date: string;
  notes: string | null;
  items: Array<{ id: string; product_id: string; quantity: number; serial_numbers: string[] | null }>;
}

const emptyItem = (): PickupItemRow => ({
  product_id: "",
  quantity: 1,
  serial_numbers: "",
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  preselectedInstallerId?: string;
  editingPickup?: EditingPickup | null;
  divisionProductIds?: string[];
}

export function NewPickupDialog({ open, onOpenChange, onCreated, preselectedInstallerId, editingPickup, divisionProductIds }: Props) {
  const { products } = useData();
  const { currentUser } = useAuth();
  const isEdit = !!editingPickup;
  const [saving, setSaving] = useState(false);
  const [installers, setInstallers] = useState<Installer[]>([]);
  const [installerId, setInstallerId] = useState(preselectedInstallerId ?? "");
  const [pickupDate, setPickupDate] = useState<Date | undefined>(new Date());
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<PickupItemRow[]>([emptyItem()]);

  useEffect(() => {
    if (open) {
      supabase
        .from("installers")
        .select("id, name, warehouse_number, division")
        .eq("status", "פעיל")
        .order("name")
        .then(({ data }) => setInstallers(data ?? []));

      if (editingPickup) {
        setInstallerId(editingPickup.installer_id);
        setPickupDate(new Date(editingPickup.pickup_date));
        setNotes(editingPickup.notes ?? "");
        setItems(
          editingPickup.items.length > 0
            ? editingPickup.items.map((i) => ({
                id: i.id,
                product_id: i.product_id,
                quantity: i.quantity,
                serial_numbers: i.serial_numbers ? i.serial_numbers.join(", ") : "",
              }))
            : [emptyItem()]
        );
      } else {
        setInstallerId(preselectedInstallerId ?? "");
        setPickupDate(new Date());
        setNotes("");
        setItems([emptyItem()]);
      }
    }
  }, [open, preselectedInstallerId, editingPickup]);

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

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const updateItem = (idx: number, field: keyof PickupItemRow, value: string | number) => {
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
    if (!pickupDate) {
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
      if (isEdit && editingPickup) {
        // Update header
        const { error: updateError } = await supabase
          .from("equipment_pickups")
          .update({
            installer_id: installerId,
            pickup_date: pickupDate.toISOString().split("T")[0],
            notes: notes.trim() || null,
          })
          .eq("id", editingPickup.id);
        if (updateError) throw updateError;

        // Replace all items: delete old, insert new
        const { error: deleteError } = await supabase
          .from("equipment_pickup_items")
          .delete()
          .eq("pickup_id", editingPickup.id);
        if (deleteError) throw deleteError;

        const itemRows = validItems.map((item) => ({
          pickup_id: editingPickup.id,
          product_id: item.product_id,
          quantity: item.quantity,
          serial_numbers: item.serial_numbers.trim()
            ? item.serial_numbers.split(",").map((s) => s.trim()).filter(Boolean)
            : null,
        }));

        const { error: insertError } = await supabase
          .from("equipment_pickup_items")
          .insert(itemRows);
        if (insertError) throw insertError;

        toast.success("ההצטיידות עודכנה בהצלחה");
        onOpenChange(false);
        onCreated();
      } else {
        // Create new pickup
        const { data: pickup, error: pickupError } = await supabase
          .from("equipment_pickups")
          .insert({
            installer_id: installerId,
            pickup_date: pickupDate.toISOString().split("T")[0],
            notes: notes.trim() || null,
          })
          .select("id")
          .single();

        if (pickupError || !pickup) throw pickupError ?? new Error("שגיאה ביצירת ההצטיידות");

        const itemRows = validItems.map((item) => ({
          pickup_id: pickup.id,
          product_id: item.product_id,
          quantity: item.quantity,
          serial_numbers: item.serial_numbers.trim()
            ? item.serial_numbers.split(",").map((s) => s.trim()).filter(Boolean)
            : null,
        }));

        const { error: itemsError } = await supabase
          .from("equipment_pickup_items")
          .insert(itemRows);

        if (itemsError) throw itemsError;

        const installerName =
          installers.find((i) => i.id === installerId)?.name ?? "לא ידוע";
        deductInventoryForPickup(
          validItems.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
          installerName,
          currentUser?.name ?? null
        ).catch(() => {/* inventory sync errors are non-critical */});

        toast.success("ההצטיידות נשמרה בהצלחה");
        onOpenChange(false);
        onCreated();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בשמירת ההצטיידות");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg md:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "עריכת הצטיידות" : "הצטיידות חדשה"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <DateInput value={pickupDate} onChange={setPickupDate} />
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
              <Label>פריטים</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-3.5 w-3.5 ms-1" />
                הוסף פריט
              </Button>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => {
                const prod = productById.get(item.product_id);
                return (
                  <div key={idx} className="flex gap-2 items-start p-2 border rounded-md bg-muted/30">
                    <div className="flex-1 space-y-2">
                      <div className="space-y-1">
                        <Combobox
                          value={item.product_id}
                          onValueChange={(v) => updateItem(idx, "product_id", v)}
                          options={productOptions}
                          placeholder="בחר מוצר..."
                          searchPlaceholder={'חיפוש לפי שם או מק"ט...'}
                        />
                        {prod && (
                          <div className="flex gap-2 items-center text-xs text-muted-foreground px-1">
                            {prod.sku && <span className="font-mono">{prod.sku}</span>}
                            {prod.category && <span>· {prod.category}</span>}
                            {typeof prod.stock_qty === "number" && (
                              <Badge
                                variant="outline"
                                className={`text-[10px] py-0 h-4 ${prod.stock_qty <= 0 ? "border-red-300 text-red-600" : "border-green-300 text-green-700"}`}
                              >
                                מלאי: {prod.stock_qty}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            ביטול
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
            שמור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
