import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Loader2 } from "lucide-react";

interface InstallerData {
  id: string;
  name: string;
  warehouse_number: number | null;
  division: string;
  phone: string | null;
  coordinator: string | null;
  notes?: string | null;
  status?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  installer?: InstallerData;
  onUpdated?: () => void;
}

export function NewInstallerDialog({ open, onOpenChange, onCreated, installer, onUpdated }: Props) {
  const isEdit = !!installer;
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [warehouseNumber, setWarehouseNumber] = useState("");
  const [division, setDivision] = useState("AWACS");
  const [phone, setPhone] = useState("");
  const [coordinator, setCoordinator] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("פעיל");

  const reset = () => {
    setName("");
    setWarehouseNumber("");
    setDivision("AWACS");
    setPhone("");
    setCoordinator("");
    setNotes("");
    setStatus("פעיל");
  };

  useEffect(() => {
    if (open) {
      if (installer) {
        setName(installer.name);
        setWarehouseNumber(installer.warehouse_number ? String(installer.warehouse_number) : "");
        setDivision(installer.division);
        setPhone(installer.phone ?? "");
        setCoordinator(installer.coordinator ?? "");
        setNotes(installer.notes ?? "");
        setStatus(installer.status ?? "פעיל");
      } else {
        reset();
      }
    }
  }, [open, installer]);

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("שם המתקין הוא שדה חובה");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        warehouse_number: warehouseNumber ? parseInt(warehouseNumber) : null,
        division,
        phone: phone.trim() || null,
        coordinator: coordinator.trim() || null,
        notes: notes.trim() || null,
        status,
      };

      if (isEdit && installer) {
        const { error } = await supabase
          .from("installers")
          .update(payload)
          .eq("id", installer.id);
        if (error) throw error;
        toast.success("הטכנאי עודכן בהצלחה");
        handleClose(false);
        onUpdated?.();
      } else {
        const { error } = await supabase.from("installers").insert(payload);
        if (error) throw error;
        toast.success("המתקין נוסף בהצלחה");
        reset();
        onOpenChange(false);
        onCreated();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("schema cache") || msg.includes("PGRST")) {
        toast.error("שגיאת מסד נתונים — אנא רענן את הדף ונסה שוב");
      } else {
        toast.error(msg || (isEdit ? "שגיאה בעדכון המתקין" : "שגיאה בשמירת המתקין"));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "עריכת טכנאי" : "מתקין חדש"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>שם המתקין *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="שם מלא"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>מספר מחסן</Label>
              <Input
                type="number"
                value={warehouseNumber}
                onChange={(e) => setWarehouseNumber(e.target.value)}
                placeholder="למשל 106"
              />
            </div>
            <div className="space-y-1.5">
              <Label>חטיבה</Label>
              <Select value={division} onValueChange={setDivision}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AWACS">AWACS</SelectItem>
                  <SelectItem value="כפתור">כפתור</SelectItem>
                  <SelectItem value="DOORE">DOORE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>טלפון</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05X-XXXXXXX"
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label>מתאם</Label>
              <Input
                value={coordinator}
                onChange={(e) => setCoordinator(e.target.value)}
                placeholder="שם המתאם"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>סטטוס</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="פעיל">פעיל</SelectItem>
                <SelectItem value="לא פעיל">לא פעיל</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>הערות</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="הערות נוספות..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={saving}>
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
