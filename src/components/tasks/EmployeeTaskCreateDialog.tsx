import { useState, useEffect } from "react";
import { useData, useAuth, type Priority } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateInput } from "@/components/ui/date-input";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const priorityOptions: { value: Priority; label: string }[] = [
  { value: "דחוף", label: "דחוף" },
  { value: "גבוה", label: "גבוה" },
  { value: "בינוני", label: "בינוני" },
  { value: "נמוך", label: "נמוך" },
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export default function EmployeeTaskCreateDialog({ open, onOpenChange }: Props) {
  const { refreshTasks } = useData();
  const { currentUser } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("בינוני");
  const [dueDate, setDueDate] = useState<Date>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setDescription("");
      setPriority("בינוני");
      setDueDate(undefined);
    }
  }, [open]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "נא להזין כותרת", variant: "destructive" });
      return;
    }
    if (!currentUser) return;

    setSaving(true);

    const taskData = {
      title: title.trim(),
      description: description.trim() || null,
      priority,
      status: "TODO",
      assignee_id: currentUser.id,
      assignee_name: currentUser.name,
      due_date: dueDate?.toISOString() || null,
      is_daily: false,
      created_by: currentUser.id,
    };

    const { error } = await supabase.from("tasks").insert(taskData);
    if (error) {
      toast({ title: "שגיאה ביצירת משימה", description: error.message, variant: "destructive" });
    } else {
      await refreshTasks();
      toast({ title: "משימה נוצרה בהצלחה" });
      onOpenChange(false);
    }

    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>משימה חדשה</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="space-y-1">
            <Label className="text-xs">כותרת *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="מה צריך לעשות?" autoFocus />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">תיאור</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="פרטים נוספים..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">עדיפות</Label>
              <Select value={priority} onValueChange={v => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {priorityOptions.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">תאריך יעד</Label>
              <DateInput value={dueDate} onChange={setDueDate} clearable />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
              {saving ? "יוצר..." : "צור משימה"}
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
