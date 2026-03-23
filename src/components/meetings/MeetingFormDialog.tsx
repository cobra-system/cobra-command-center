import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateInput } from "@/components/ui/date-input";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { Meeting } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
  editingMeeting?: Meeting | null;
}

export default function MeetingFormDialog({ open, onOpenChange, onSaved, editingMeeting }: Props) {
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState<Date>(new Date());
  const [participants, setParticipants] = useState("");
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && editingMeeting) {
      setTitle(editingMeeting.title);
      setMeetingDate(new Date(editingMeeting.meeting_date));
      setParticipants(editingMeeting.participants || "");
      setSummary(editingMeeting.summary || "");
      setNotes(editingMeeting.notes || "");
    } else if (!open) {
      setTitle("");
      setMeetingDate(new Date());
      setParticipants("");
      setSummary("");
      setNotes("");
    }
  }, [open, editingMeeting]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "נא להזין נושא פגישה", variant: "destructive" });
      return;
    }
    setSaving(true);

    const payload = {
      title: title.trim(),
      meeting_date: meetingDate.toISOString(),
      participants: participants.trim() || null,
      summary: summary.trim() || null,
      notes: notes.trim() || null,
    };

    if (editingMeeting) {
      const { error } = await supabase.from("meetings").update(payload).eq("id", editingMeeting.id);
      if (error) {
        toast({ title: "שגיאה בעדכון פגישה", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "הפגישה עודכנה" });
        onSaved?.();
        onOpenChange(false);
      }
    } else {
      const { error } = await supabase.from("meetings").insert(payload);
      if (error) {
        toast({ title: "שגיאה ביצירת פגישה", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "פגישה חדשה נוצרה" });
        onSaved?.();
        onOpenChange(false);
      }
    }

    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingMeeting ? "עריכת פגישה" : "פגישה חדשה"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="space-y-1">
            <Label className="text-xs">נושא הפגישה *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="נושא הפגישה" autoFocus />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">תאריך</Label>
            <DateInput value={meetingDate} onChange={d => { if (d) setMeetingDate(d); }} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">משתתפים</Label>
            <Textarea value={participants} onChange={e => setParticipants(e.target.value)} rows={2} placeholder="שמות המשתתפים..." />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">סיכום</Label>
            <Textarea value={summary} onChange={e => setSummary(e.target.value)} rows={3} placeholder="סיכום הפגישה..." />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">הערות</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="הערות נוספות..." />
          </div>

          <div className="flex gap-2 pt-1">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
              {saving ? "שומר..." : editingMeeting ? "עדכן" : "צור פגישה"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              ביטול
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
