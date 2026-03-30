import { useState, useEffect, useMemo } from "react";
import { useData, useAuth, type Priority } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Switch } from "@/components/ui/switch";
import { DateInput } from "@/components/ui/date-input";
import { Loader2, Paperclip, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const priorityOptions: { value: Priority; label: string }[] = [
  { value: "דחוף", label: "דחוף" },
  { value: "גבוה", label: "גבוה" },
  { value: "בינוני", label: "בינוני" },
  { value: "נמוך", label: "נמוך" },
];

const frequencyOptions = [
  { value: "daily", label: "כל יום" },
  { value: "weekly", label: "כל שבוע" },
  { value: "biweekly", label: "כל שבועיים" },
  { value: "monthly", label: "כל חודש" },
  { value: "yearly", label: "כל שנה" },
];

const dayOfWeekOptions = [
  { value: 0, label: "ראשון" },
  { value: 1, label: "שני" },
  { value: 2, label: "שלישי" },
  { value: 3, label: "רביעי" },
  { value: 4, label: "חמישי" },
  { value: 5, label: "שישי" },
  { value: 6, label: "שבת" },
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
}

export default function TaskCreateDialog({ open, onOpenChange, onSaved }: Props) {
  const { refreshTasks, profiles, tasks, goals } = useData();
  const { currentUser } = useAuth();
  const assignableUsers = profiles;

  // Derive milestone options from DB goals + existing task milestones
  const existingMilestones = useMemo(() => {
    const fromGoals = goals.map(g => g.name);
    const fromTasks = new Set<string>();
    tasks.forEach(t => { if (t.milestone) fromTasks.add(t.milestone); });
    const all = [...fromGoals];
    for (const m of fromTasks) {
      if (!all.includes(m)) all.push(m);
    }
    return all;
  }, [tasks, goals]);

  // Base fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("בינוני");
  const [assigneeId, setAssigneeId] = useState("");
  const [milestone, setMilestone] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [dueDate, setDueDate] = useState<Date>();

  // Recurrence
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState("weekly");
  const [dayOfWeek, setDayOfWeek] = useState<number>(0);
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [endDate, setEndDate] = useState<Date>();

  // Document attachment
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setDescription("");
      setPriority("בינוני");
      setAssigneeId("");
      setMilestone("");
      setStartDate(undefined);
      setDueDate(undefined);
      setIsRecurring(false);
      setFrequency("weekly");
      setDayOfWeek(0);
      setDayOfMonth(1);
      setEndDate(undefined);
      setAttachedFile(null);
    }
  }, [open]);

  const needsDayOfWeek = frequency === "weekly" || frequency === "biweekly";
  const needsDayOfMonth = frequency === "monthly" || frequency === "yearly";

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAttachedFile(file);
  };

  const uploadAttachment = async (taskId?: string): Promise<string | null> => {
    if (!attachedFile) return null;
    const safeName = attachedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `tasks/${taskId || Date.now()}/${safeName}`;
    const { error } = await supabase.storage.from("documents").upload(filePath, attachedFile, { upsert: true });
    if (error) {
      toast({ title: "שגיאה בהעלאת קובץ", description: error.message, variant: "destructive" });
      return null;
    }
    const { data: urlData } = supabase.storage.from("documents").getPublicUrl(filePath);
    return urlData.publicUrl;
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "נא להזין כותרת", variant: "destructive" });
      return;
    }
    setSaving(true);

    const assignee = profiles.find(p => p.id === assigneeId);

    if (isRecurring) {
      // Save as recurring task
      const payload: any = {
        title: title.trim(),
        description: description.trim() || null,
        frequency,
        day_of_week: needsDayOfWeek ? dayOfWeek : null,
        day_of_month: needsDayOfMonth ? dayOfMonth : null,
        days_before: 0,
        priority,
        assignee_id: assigneeId || null,
        assignee_name: assignee?.name || null,
        is_active: true,
        created_by: currentUser?.id || null,
      };

      // Attach end_date if the DB column exists (graceful fallback)
      if (endDate) {
        payload.end_date = endDate.toISOString().split("T")[0];
      }

      payload.status = "TEMPLATE";
      payload.is_daily = false;
      const { data, error } = await supabase.from("tasks").insert(payload).select("id").single();
      if (error) {
        toast({ title: "שגיאה ביצירת משימה חוזרת", description: error.message, variant: "destructive" });
      } else {
        if (attachedFile && data) {
          setUploading(true);
          await uploadAttachment(data.id);
          setUploading(false);
        }
        toast({ title: "✅ משימה חוזרת נוספה" });
        onSaved?.();
        onOpenChange(false);
      }
    } else {
      // Save as one-time task
      const taskData: any = {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        status: "TODO",
        assignee_id: assigneeId || null,
        assignee_name: assignee?.name || null,
        milestone: milestone.trim() || null,
        start_date: startDate?.toISOString() || null,
        due_date: dueDate?.toISOString() || null,
        is_daily: false,
        created_by: currentUser?.id || null,
      };

      const { data, error } = await supabase.from("tasks").insert(taskData).select("id").single();
      if (error) {
        toast({ title: "שגיאה ביצירת משימה", description: error.message, variant: "destructive" });
      } else {
        if (attachedFile && data) {
          setUploading(true);
          const fileUrl = await uploadAttachment(data.id);
          if (fileUrl) {
            // Store document reference linked to the task
            // File uploaded successfully, URL stored in task notes
            await supabase.from("tasks").update({ 
              notes: `📎 ${attachedFile.name}: ${fileUrl}` 
            }).eq("id", data.id);
          }
          setUploading(false);
        }
        await refreshTasks();
        toast({ title: "✅ משימה נוספה" });
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
          <DialogTitle>משימה חדשה</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Title */}
          <div className="space-y-1">
            <Label className="text-xs">כותרת *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="כותרת המשימה" autoFocus />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label className="text-xs">תיאור</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="פרטים נוספים..." />
          </div>

          {/* Priority + Assignee */}
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
              <Label className="text-xs">שיוך לעובד</Label>
              <Combobox
                value={assigneeId}
                onValueChange={setAssigneeId}
                options={[{ value: "", label: "ללא" }, ...assignableUsers.map(u => ({ value: u.id, label: u.name }))]}
                placeholder="ללא"
                searchPlaceholder="חיפוש עובד..."
              />
            </div>
          </div>

          {/* Milestone / Goal */}
          <div className="space-y-1">
            <Label className="text-xs">מטרת-על</Label>
            <Combobox
              value={milestone}
              onValueChange={setMilestone}
              options={[
                { value: "", label: "ללא" },
                ...existingMilestones.map(m => ({ value: m, label: m })),
              ]}
              placeholder="בחר או הקלד מטרת-על..."
              searchPlaceholder="חיפוש / הוספת מטרה..."
              allowCustomValue
            />
          </div>

          {/* Dates (shown if not recurring) */}
          {!isRecurring && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">תאריך התחלה</Label>
                <DateInput value={startDate} onChange={setStartDate} clearable />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">תאריך יעד</Label>
                <DateInput value={dueDate} onChange={setDueDate} clearable />
              </div>
            </div>
          )}

          {/* Recurring toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <div>
              <p className="text-sm font-medium text-foreground">משימה חוזרת</p>
              <p className="text-xs text-muted-foreground">הגדר חזרה תקופתית</p>
            </div>
            <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
          </div>

          {/* Recurrence settings */}
          {isRecurring && (
            <div className="space-y-3 p-3 rounded-lg border bg-violet-500/5 border-violet-500/20">
              {/* Frequency */}
              <div className="space-y-1">
                <Label className="text-xs">תדירות</Label>
                <Select value={frequency} onValueChange={v => { setFrequency(v); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {frequencyOptions.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Day of week */}
              {needsDayOfWeek && (
                <div className="space-y-1">
                  <Label className="text-xs">יום בשבוע</Label>
                  <Select value={String(dayOfWeek)} onValueChange={v => setDayOfWeek(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {dayOfWeekOptions.map(d => <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Day of month */}
              {needsDayOfMonth && (
                <div className="space-y-1">
                  <Label className="text-xs">יום בחודש</Label>
                  <Input
                    type="number"
                    min={1}
                    max={28}
                    value={dayOfMonth}
                    onChange={e => setDayOfMonth(Math.min(28, Math.max(1, Number(e.target.value))))}
                    className="w-24"
                  />
                </div>
              )}

              {/* End date */}
              <div className="space-y-1">
                <Label className="text-xs">סיום חזרה (אופציונלי)</Label>
                <DateInput value={endDate} onChange={setEndDate} placeholder="ללא סיום" clearable />
              </div>
            </div>
          )}

          {/* Document attachment */}
          <div className="space-y-1">
            <Label className="text-xs">צירוף מסמך (אופציונלי)</Label>
            {attachedFile ? (
              <div className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30">
                <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs text-foreground flex-1 truncate">{attachedFile.name}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAttachedFile(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <label className="flex items-center gap-2 p-2 rounded-lg border border-dashed cursor-pointer hover:bg-muted/20 transition-colors">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">בחר קובץ...</span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button onClick={handleSave} disabled={saving || uploading} className="flex-1">
              {(saving || uploading) ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
              {uploading ? "מעלה..." : saving ? "שומר..." : "צור משימה"}
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
