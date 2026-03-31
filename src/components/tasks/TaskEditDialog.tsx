import { useState, useEffect, useMemo } from "react";
import { useData, useAuth, type Task, type Priority, type TaskStatus } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { DateInput } from "@/components/ui/date-input";
import { Loader2, Paperclip, X, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const priorityOptions: { value: Priority; label: string }[] = [
  { value: "דחוף", label: "דחוף" },
  { value: "גבוה", label: "גבוה" },
  { value: "בינוני", label: "בינוני" },
  { value: "נמוך", label: "נמוך" },
];

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: "TODO", label: "לביצוע" },
  { value: "IN_PROGRESS", label: "בביצוע" },
  { value: "DONE", label: "הושלם" },
  { value: "BLOCKED", label: "חסום" },
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task: Task | null;
  onSaved?: () => void;
}

export default function TaskEditDialog({ open, onOpenChange, task, onSaved }: Props) {
  const { updateTask, updateTaskStatus, deleteTask, refreshTasks, profiles, tasks, goals } = useData();
  const { currentUser } = useAuth();
  const isManager = currentUser?.role === "MANAGER";

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

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("בינוני");
  const [status, setStatus] = useState<TaskStatus>("TODO");
  const [assigneeId, setAssigneeId] = useState("");
  const [milestone, setMilestone] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [dueDate, setDueDate] = useState<Date>();
  const [notes, setNotes] = useState("");
  const [deliverable, setDeliverable] = useState("");

  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Populate form from task when dialog opens
  useEffect(() => {
    if (open && task) {
      setTitle(task.title || "");
      setDescription(task.description || "");
      setPriority((task.priority as Priority) || "בינוני");
      setStatus((task.status as TaskStatus) || "TODO");
      setAssigneeId(task.assignee_id || "");
      setMilestone(task.milestone || "");
      setStartDate(task.start_date ? new Date(task.start_date) : undefined);
      setDueDate(task.due_date ? new Date(task.due_date) : undefined);
      setNotes(task.notes || "");
      setDeliverable(task.deliverable || "");
      setAttachedFile(null);
    }
  }, [open, task]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAttachedFile(file);
  };

  const uploadAttachment = async (): Promise<string | null> => {
    if (!attachedFile || !task) return null;
    const safeName = attachedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `tasks/${task.id}/${safeName}`;
    const { error } = await supabase.storage.from("documents").upload(filePath, attachedFile, { upsert: true });
    if (error) {
      toast({ title: "שגיאה בהעלאת קובץ", description: error.message, variant: "destructive" });
      return null;
    }
    const { data: urlData } = supabase.storage.from("documents").getPublicUrl(filePath);
    return urlData.publicUrl;
  };

  const handleSave = async () => {
    if (!task) return;
    if (!title.trim()) {
      toast({ title: "נא להזין כותרת", variant: "destructive" });
      return;
    }
    setSaving(true);

    const assignee = profiles.find(p => p.id === assigneeId);

    // Handle status change with completed_at logic
    if (status !== task.status) {
      await updateTaskStatus(task.id, status);
    }

    const updates: Partial<Task> & Record<string, any> = {
      title: title.trim(),
      description: description.trim() || null,
      priority,
      assignee_id: assigneeId || null,
      assignee_name: assignee?.name || null,
      milestone: milestone.trim() || null,
      start_date: startDate?.toISOString() || null,
      due_date: dueDate?.toISOString() || null,
      deliverable: deliverable.trim() || null,
    };

    // Handle file upload
    if (attachedFile) {
      setUploading(true);
      const fileUrl = await uploadAttachment();
      if (fileUrl) {
        const existingNotes = notes.trim();
        const attachment = `📎 ${attachedFile.name}: ${fileUrl}`;
        updates.notes = existingNotes ? `${existingNotes}\n${attachment}` : attachment;
      }
      setUploading(false);
    } else {
      updates.notes = notes.trim() || null;
    }

    await updateTask(task.id, updates);
    await refreshTasks();

    toast({ title: "✅ המשימה עודכנה" });
    onSaved?.();
    onOpenChange(false);
    setSaving(false);
  };

  const handleDeleteConfirm = async () => {
    if (!task) return;
    await deleteTask(task.id);
    setConfirmDelete(false);
    onOpenChange(false);
    toast({ title: "המשימה נמחקה" });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between gap-2">
            <DialogTitle>עריכת משימה</DialogTitle>
            {isManager && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
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

            {/* Priority + Status */}
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
                <Label className="text-xs">סטטוס</Label>
                <Select value={status} onValueChange={v => setStatus(v as TaskStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Assignee */}
            <div className="space-y-1">
              <Label className="text-xs">שיוך לעובד</Label>
              <Combobox
                value={assigneeId}
                onValueChange={setAssigneeId}
                options={[{ value: "", label: "ללא" }, ...profiles.map(u => ({ value: u.id, label: u.name }))]}
                placeholder="ללא"
                searchPlaceholder="חיפוש עובד..."
              />
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

            {/* Dates */}
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

            {/* Notes */}
            <div className="space-y-1">
              <Label className="text-xs">הערות</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="הערות..." />
            </div>

            {/* Deliverable */}
            <div className="space-y-1">
              <Label className="text-xs">תוצר</Label>
              <Input value={deliverable} onChange={e => setDeliverable(e.target.value)} placeholder="תוצר המשימה..." />
            </div>

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
                {uploading ? "מעלה..." : saving ? "שומר..." : "שמור שינויים"}
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                ביטול
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת משימה</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק את המשימה &quot;{task?.title}&quot;? לא ניתן לשחזר.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
