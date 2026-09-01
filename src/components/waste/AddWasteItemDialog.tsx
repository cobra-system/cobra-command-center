import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { supabase } from "@/lib/supabase";
import { useData, useAuth } from "@/contexts/AppContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}

export function AddWasteItemDialog({ open, onOpenChange, onCreated }: Props) {
  const { products } = useData();
  const { currentUser } = useAuth();
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [conditionNotes, setConditionNotes] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setProductId("");
    setQuantity(1);
    setConditionNotes("");
  }

  async function handleSave() {
    if (!productId) { toast.error("יש לבחור מוצר"); return; }
    if (quantity < 1) { toast.error("כמות חייבת להיות לפחות 1"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("waste_items").insert({
        product_id: productId,
        quantity,
        condition_notes: conditionNotes || null,
        status: "pending",
        source: "manual",
        created_by: currentUser?.id ?? null,
        created_by_name: currentUser?.name ?? null,
      });
      if (error) throw error;
      toast.success("פריט בלאי נוסף");
      reset();
      onOpenChange(false);
      onCreated();
    } catch (e) {
      toast.error("שגיאה בשמירה");
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  const productOptions = products.map(p => ({
    value: p.id,
    label: `${p.name}${p.sku ? ` · ${p.sku}` : ""}`,
  }));

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>הוספת פריט בלאי</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>מוצר <span className="text-destructive">*</span></Label>
            <Combobox
              options={productOptions}
              value={productId}
              onValueChange={setProductId}
              placeholder="חפש מוצר..."
              searchPlaceholder="חיפוש..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>כמות <span className="text-destructive">*</span></Label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>תיאור המצב</Label>
            <Textarea
              placeholder="תאר את הבעיה / מצב הפריט..."
              value={conditionNotes}
              onChange={e => setConditionNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => { reset(); onOpenChange(false); }}>
              ביטול
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving || !productId}>
              {saving ? "שומר..." : "הוספה"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
