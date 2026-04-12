import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { type WarehouseZone, type ZoneType, ZONE_TYPE_LABELS } from "@/data/warehouseZones";

// ── Utility ──────────────────────────────────────────────────────────────────

function computeTextColor(hex: string): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? "#1a1a1a" : "#ffffff";
  } catch {
    return "#ffffff";
  }
}

function parseGridString(s: string): [number, number] {
  const parts = s.split(" / ").map(Number);
  return [parts[0] ?? 1, parts[1] ?? 3];
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ZoneConfigDialogProps {
  zone: WarehouseZone | null; // null = create mode
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function ZoneConfigDialog({
  zone,
  open,
  onClose,
  onSaved,
}: ZoneConfigDialogProps) {
  const isCreate = !zone;

  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [color, setColor] = useState("#9E9E9E");
  const [gridRowStart, setGridRowStart] = useState(1);
  const [gridRowEnd, setGridRowEnd] = useState(3);
  const [gridColStart, setGridColStart] = useState(1);
  const [gridColEnd, setGridColEnd] = useState(5);
  const [zoneType, setZoneType] = useState<ZoneType>("storage");
  const [isNonProduct, setIsNonProduct] = useState(false);
  const [icon, setIcon] = useState("");
  const [capacity, setCapacity] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Pre-populate / reset when dialog opens
  useEffect(() => {
    if (!open) return;
    if (zone) {
      setId(zone.id);
      setName(zone.name);
      setColor(zone.color);
      const [rs, re] = parseGridString(zone.gridRow);
      const [cs, ce] = parseGridString(zone.gridColumn);
      setGridRowStart(rs);
      setGridRowEnd(re);
      setGridColStart(cs);
      setGridColEnd(ce);
      setZoneType(zone.zoneType);
      setIsNonProduct(zone.isNonProduct ?? false);
      setIcon(zone.icon ?? "");
      setCapacity(zone.capacity != null ? String(zone.capacity) : "");
    } else {
      setId("");
      setName("");
      setColor("#9E9E9E");
      setGridRowStart(1);
      setGridRowEnd(3);
      setGridColStart(1);
      setGridColEnd(5);
      setZoneType("storage");
      setIsNonProduct(false);
      setIcon("");
      setCapacity("");
    }
    setShowDeleteConfirm(false);
  }, [open, zone]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("יש להזין שם לאזור");
      return;
    }
    const zoneId = isCreate ? id.trim() : zone!.id;
    if (isCreate && !zoneId) {
      toast.error("יש להזין מזהה לאזור");
      return;
    }
    if (gridRowEnd <= gridRowStart) {
      toast.error("שורת סיום חייבת להיות גדולה משורת התחלה");
      return;
    }
    if (gridColEnd <= gridColStart) {
      toast.error("עמודת סיום חייבת להיות גדולה מעמודת התחלה");
      return;
    }

    setSaving(true);
    const payload = {
      name: name.trim(),
      color,
      text_color: computeTextColor(color),
      grid_row: `${gridRowStart} / ${gridRowEnd}`,
      grid_col: `${gridColStart} / ${gridColEnd}`,
      zone_type: zoneType,
      icon: icon.trim() || null,
      is_non_product: isNonProduct,
      capacity: capacity.trim() ? parseInt(capacity, 10) : null,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (isCreate) {
      ({ error } = await supabase
        .from("warehouse_zones")
        .insert({ id: zoneId, ...payload }));
    } else {
      ({ error } = await supabase
        .from("warehouse_zones")
        .update(payload)
        .eq("id", zone!.id));
    }

    if (error) {
      console.error("[ZoneConfigDialog] save error:", error);
      toast.error(`שגיאה בשמירת האזור: ${error.message}`);
    } else {
      toast.success(isCreate ? "אזור נוצר בהצלחה" : "האזור עודכן בהצלחה");
      onSaved();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!zone) return;
    setSaving(true);
    const { error } = await supabase
      .from("warehouse_zones")
      .delete()
      .eq("id", zone.id);

    if (error) {
      console.error("[ZoneConfigDialog] delete error:", error);
      toast.error(`שגיאה במחיקת האזור: ${error.message}`);
      setSaving(false);
    } else {
      toast.success("האזור נמחק");
      onSaved();
    }
    setShowDeleteConfirm(false);
  };

  const autoTextColor = computeTextColor(color);
  const previewLabel = name.replace(/\n/g, " ") || "תצוגה מקדימה";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isCreate
              ? "צור אזור חדש"
              : `ערוך אזור — ${zone!.name.replace(/\n/g, " ")}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* ID — create mode only */}
          {isCreate && (
            <div className="space-y-1">
              <label className="text-sm font-medium">
                מזהה אזור{" "}
                <span className="text-muted-foreground font-normal">(ייחודי, ללא רווחים)</span>
              </label>
              <Input
                value={id}
                onChange={(e) =>
                  setId(e.target.value.replace(/\s+/g, "-").toLowerCase())
                }
                placeholder="zone-id-example"
                dir="ltr"
              />
            </div>
          )}

          {/* Name */}
          <div className="space-y-1">
            <label className="text-sm font-medium">
              שם אזור{" "}
              <span className="text-muted-foreground font-normal">
                (שורה חדשה = \n בתצוגה)
              </span>
            </label>
            <Textarea
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="שם האזור"
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Color + live preview */}
          <div className="space-y-1">
            <label className="text-sm font-medium">צבע רקע</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-14 rounded border cursor-pointer p-0.5"
              />
              <div
                className="flex-1 h-10 rounded-md border flex items-center justify-center text-sm font-medium truncate px-2"
                style={{ backgroundColor: color, color: autoTextColor }}
              >
                {previewLabel}
              </div>
              <span className="text-xs text-muted-foreground font-mono">{color}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              צבע טקסט אוטומטי:{" "}
              <strong>{autoTextColor === "#ffffff" ? "לבן" : "כהה"}</strong>
            </p>
          </div>

          {/* Grid position */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              מיקום ברשת{" "}
              <span className="text-muted-foreground font-normal">
                (שורות 1–20, עמודות 1–24)
              </span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">שורה — התחלה</span>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={gridRowStart}
                  onChange={(e) => setGridRowStart(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">שורה — סיום</span>
                <Input
                  type="number"
                  min={2}
                  max={21}
                  value={gridRowEnd}
                  onChange={(e) => setGridRowEnd(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">עמודה — התחלה</span>
                <Input
                  type="number"
                  min={1}
                  max={24}
                  value={gridColStart}
                  onChange={(e) => setGridColStart(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">עמודה — סיום</span>
                <Input
                  type="number"
                  min={2}
                  max={25}
                  value={gridColEnd}
                  onChange={(e) => setGridColEnd(Number(e.target.value))}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              CSS Grid: שורה {gridRowStart}&thinsp;/&thinsp;{gridRowEnd}, עמודה{" "}
              {gridColStart}&thinsp;/&thinsp;{gridColEnd}
            </p>
          </div>

          {/* Zone type */}
          <div className="space-y-1">
            <label className="text-sm font-medium">סוג אזור</label>
            <Select
              value={zoneType}
              onValueChange={(v) => setZoneType(v as ZoneType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(ZONE_TYPE_LABELS) as [ZoneType, string][]).map(
                  ([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Icon */}
          <div className="space-y-1">
            <label className="text-sm font-medium">
              אייקון{" "}
              <span className="text-muted-foreground font-normal">
                (שם Lucide, אופציונלי — למשל DoorOpen, Lock)
              </span>
            </label>
            <Input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="DoorOpen"
              dir="ltr"
            />
          </div>

          {/* Capacity */}
          {!isNonProduct && (
            <div className="space-y-1">
              <label className="text-sm font-medium">
                קיבולת מקסימלית{" "}
                <span className="text-muted-foreground font-normal">(יחידות, אופציונלי)</span>
              </label>
              <Input
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="ללא הגבלה"
              />
            </div>
          )}

          {/* Is non-product */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="is-non-product"
              checked={isNonProduct}
              onCheckedChange={(v) => setIsNonProduct(!!v)}
            />
            <label htmlFor="is-non-product" className="text-sm cursor-pointer">
              אזור שאינו מכיל מוצרים (כספת, כניסה, שולחן…)
            </label>
          </div>
        </div>

        <DialogFooter className="flex-row-reverse gap-2 sm:justify-between mt-6">
          {/* Delete — edit mode only */}
          {!isCreate && (
            <AlertDialog
              open={showDeleteConfirm}
              onOpenChange={setShowDeleteConfirm}
            >
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={saving}>
                  <Trash2 className="w-4 h-4 ml-1" />
                  מחק אזור
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>מחיקת אזור</AlertDialogTitle>
                  <AlertDialogDescription>
                    האם למחוק את האזור &ldquo;{zone!.name.replace(/\n/g, " ")}&rdquo;?
                    פעולה זו תמחק גם את כל המוצרים המשויכים לאזור ואינה ניתנת לביטול.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>ביטול</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "מחק"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              ביטול
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin ml-1" />}
              {isCreate ? "צור אזור" : "שמור שינויים"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
