import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AppContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { DocumentFolder } from "./types";

const FOLDER_COLORS: { value: string; label: string; bg: string; ring: string }[] = [
  { value: "blue",   label: "כחול",   bg: "bg-blue-500",   ring: "ring-blue-500" },
  { value: "green",  label: "ירוק",   bg: "bg-green-500",  ring: "ring-green-500" },
  { value: "orange", label: "כתום",   bg: "bg-orange-500", ring: "ring-orange-500" },
  { value: "purple", label: "סגול",   bg: "bg-purple-500", ring: "ring-purple-500" },
  { value: "red",    label: "אדום",   bg: "bg-red-500",    ring: "ring-red-500" },
  { value: "gray",   label: "אפור",   bg: "bg-gray-400",   ring: "ring-gray-400" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  editFolder?: DocumentFolder | null;
}

export default function CreateFolderDialog({ open, onOpenChange, onSaved, editFolder }: Props) {
  const { currentUser } = useAuth();
  const [name, setName] = useState("");
  const [color, setColor] = useState("blue");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(editFolder?.name ?? "");
      setColor(editFolder?.color ?? "blue");
    }
  }, [open, editFolder]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      if (editFolder) {
        const { error } = await supabase
          .from("document_folders")
          .update({ name: trimmed, color })
          .eq("id", editFolder.id);
        if (error) throw error;
        toast.success("התיקייה עודכנה");
      } else {
        const { error } = await supabase
          .from("document_folders")
          .insert({ name: trimmed, color, created_by: currentUser?.id ?? null });
        if (error) throw error;
        toast.success("תיקייה נוצרה");
      }
      onSaved();
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message
        : typeof err === "object" && err !== null && "message" in err ? String((err as { message: unknown }).message)
        : "שגיאה לא ידועה";
      console.error("Folder save error:", err);
      toast.error(`שגיאה בשמירת התיקייה: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editFolder ? "שינוי שם תיקייה" : "תיקייה חדשה"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>שם תיקייה</Label>
            <Input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="לדוגמה: חוזים, ספק X..."
              onKeyDown={e => e.key === "Enter" && handleSave()}
            />
          </div>
          <div className="space-y-1.5">
            <Label>צבע</Label>
            <div className="flex gap-2">
              {FOLDER_COLORS.map(c => (
                <button
                  key={c.value}
                  title={c.label}
                  onClick={() => setColor(c.value)}
                  className={cn(
                    "w-7 h-7 rounded-full transition-all",
                    c.bg,
                    color === c.value && `ring-2 ring-offset-2 ${c.ring} scale-110`
                  )}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
            <Button onClick={handleSave} disabled={!name.trim() || saving}>
              {editFolder ? "שמור" : "צור תיקייה"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
