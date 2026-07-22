import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AppContext";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string | null;
  productName?: string;
  onRejected: () => void;
}

export function RejectRequestDialog({ open, onOpenChange, requestId, productName, onRejected }: Props) {
  const { currentUser } = useAuth();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  const submit = async () => {
    if (!requestId) return;
    if (!reason.trim()) {
      toast.error("יש להזין סיבת דחייה");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("order_requests")
      .update({
        status: "rejected",
        reject_reason: reason.trim(),
        reviewed_at: new Date().toISOString(),
        reviewed_by: currentUser?.id ?? null,
        reviewed_by_name: currentUser?.name ?? null,
      })
      .eq("id", requestId);
    setSaving(false);
    if (error) {
      toast.error("שגיאה בדחיית הבקשה");
      return;
    }
    toast.success("הבקשה נדחתה");
    onOpenChange(false);
    onRejected();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>דחיית בקשה{productName ? ` — ${productName}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>סיבת הדחייה</Label>
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="הסבר מדוע הבקשה לא תמומש..."
              rows={4}
              autoFocus
            />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>ביטול</Button>
            <Button variant="destructive" onClick={submit} disabled={saving}>
              {saving ? "דוחה..." : "דחה בקשה"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
