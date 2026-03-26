import { useMemo, useState } from "react";
import { type Task, type Priority, useData } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { InlineEditField } from "@/components/InlineEditField";
import { DateInput } from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

const priorityOptions: { value: Priority; label: string }[] = [
  { value: "דחוף", label: "דחוף" },
  { value: "גבוה", label: "גבוה" },
  { value: "בינוני", label: "בינוני" },
  { value: "נמוך", label: "נמוך" },
];

const statusOptions = [
  { value: "TODO", label: "לביצוע" },
  { value: "IN_PROGRESS", label: "בביצוע" },
  { value: "DONE", label: "הושלם" },
  { value: "BLOCKED", label: "חסום" },
];

export function TaskDetailDialog({ task, onClose, profiles, currentUser, onUpdate, onStatusChange, onDelete }: {
  task: Task | null;
  onClose: () => void;
  profiles: { id: string; name: string; role: string }[];
  currentUser: { id: string; role: string; name: string } | null;
  onUpdate: (id: string, updates: Partial<Task>) => Promise<void>;
  onStatusChange: (id: string, status: any) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const { tasks: allTasks, goals } = useData();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const existingMilestones = useMemo(() => {
    const fromGoals = goals.map(g => g.name);
    const fromTasks = new Set<string>();
    allTasks.forEach(t => { if (t.milestone) fromTasks.add(t.milestone); });
    const all = [...fromGoals];
    for (const m of fromTasks) {
      if (!all.includes(m)) all.push(m);
    }
    return all;
  }, [allTasks, goals]);

  if (!task) return null;

  // Derive live task from AppContext so inline-edit updates are reflected immediately
  const liveTask = allTasks.find(t => t.id === task.id) ?? task;

  const assignableUsers = profiles.filter(u => u.role !== "MANAGER" || u.id === currentUser?.id);

  const handleInlineSave = async (field: string, value: string) => {
    const updates: Partial<Task> & Record<string, any> = {};
    if (field === "assignee_id") {
      const id = value === "__none__" ? null : value;
      updates.assignee_id = id;
      const profile = profiles.find(p => p.id === id);
      updates.assignee_name = profile?.name || null;
    } else {
      const cleaned = value === "__none__" ? "" : value.trim();
      updates[field] = cleaned || null;
    }
    await onUpdate(task.id, updates);
    toast.success("עודכן");
  };

  const handleDateSave = async (field: string, date?: Date) => {
    await onUpdate(task.id, { [field]: date ? date.toISOString() : null });
    toast.success("עודכן");
  };

  const handleDeleteConfirm = async () => {
    if (!task || !onDelete) return;
    await onDelete(task.id);
    setConfirmDelete(false);
    onClose();
  };

  return (
    <>
    <Dialog open={!!task} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between gap-2">
          <DialogTitle>פירוט משימה</DialogTitle>
          {onDelete && (
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

        <div className="space-y-4 pt-2">
          <InlineEditField
            value={liveTask.title}
            onSave={v => handleInlineSave("title", v)}
            label="כותרת"
            className="bg-muted/30 rounded-lg p-3"
          />

          <InlineEditField
            value={liveTask.description}
            onSave={v => handleInlineSave("description", v)}
            label="תיאור"
            type="textarea"
            className="bg-muted/30 rounded-lg p-3"
          />

          <div className="grid grid-cols-2 gap-3">
            <InlineEditField
              value={liveTask.priority}
              onSave={v => handleInlineSave("priority", v)}
              label="עדיפות"
              displayValue={<PriorityBadge priority={liveTask.priority as Priority} />}
              options={priorityOptions}
              className="bg-muted/30 rounded-lg p-3"
            />

            <div className="bg-muted/30 rounded-lg p-3 space-y-1">
              <p className="text-xs text-muted-foreground">סטטוס</p>
              <Select value={liveTask.status} onValueChange={v => onStatusChange(task.id, v)}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <InlineEditField
              value={liveTask.assignee_id || "__none__"}
              onSave={v => handleInlineSave("assignee_id", v)}
              label="משויך ל"
              displayValue={liveTask.assignee_name || "לא משויך"}
              options={[
                { value: "__none__", label: "ללא" },
                ...assignableUsers.map(u => ({ value: u.id, label: u.name })),
              ]}
              className="bg-muted/30 rounded-lg p-3"
            />

            <div className="bg-muted/30 rounded-lg p-3 space-y-1">
              <p className="text-xs text-muted-foreground">תאריך יעד</p>
              <DateInput
                value={liveTask.due_date ? new Date(liveTask.due_date) : undefined}
                onChange={dt => handleDateSave("due_date", dt)}
                clearable
              />
            </div>
          </div>

          <InlineEditField
            value={liveTask.milestone || ""}
            onSave={v => handleInlineSave("milestone", v)}
            label="מטרת-על"
            options={[
              { value: "__none__", label: "ללא" },
              ...existingMilestones.map(m => ({ value: m, label: m })),
            ]}
            displayValue={liveTask.milestone || "—"}
            className="bg-muted/30 rounded-lg p-3"
          />

          <InlineEditField
            value={liveTask.notes}
            onSave={v => handleInlineSave("notes", v)}
            label="הערות"
            type="textarea"
            className="bg-muted/30 rounded-lg p-3"
          />

          <InlineEditField
            value={liveTask.deliverable}
            onSave={v => handleInlineSave("deliverable", v)}
            label="תוצר"
            className="bg-muted/30 rounded-lg p-3"
          />

          {liveTask.is_daily && (
            <span className="inline-block text-xs bg-warning/15 text-warning px-2 py-0.5 rounded-full">משימה יומית</span>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>מחיקת משימה</AlertDialogTitle>
          <AlertDialogDescription>
            האם אתה בטוח שברצונך למחוק את המשימה "{liveTask?.title}"? לא ניתן לשחזר.
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
