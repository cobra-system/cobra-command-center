import { useMemo } from "react";
import { type Task, type Priority, useData } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InlineEditField } from "@/components/InlineEditField";
import { DateInput } from "@/components/ui/date-input";
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

export function TaskDetailDialog({ task, onClose, profiles, currentUser, onUpdate, onStatusChange }: {
  task: Task | null;
  onClose: () => void;
  profiles: { id: string; name: string; role: string }[];
  currentUser: { id: string; role: string; name: string } | null;
  onUpdate: (id: string, updates: Partial<Task>) => Promise<void>;
  onStatusChange: (id: string, status: any) => Promise<void>;
}) {
  const { tasks: allTasks, goals } = useData();

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

  return (
    <Dialog open={!!task} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>פירוט משימה</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <InlineEditField
            value={task.title}
            onSave={v => handleInlineSave("title", v)}
            label="כותרת"
            className="bg-muted/30 rounded-lg p-3"
          />

          <InlineEditField
            value={task.description}
            onSave={v => handleInlineSave("description", v)}
            label="תיאור"
            type="textarea"
            className="bg-muted/30 rounded-lg p-3"
          />

          <div className="grid grid-cols-2 gap-3">
            <InlineEditField
              value={task.priority}
              onSave={v => handleInlineSave("priority", v)}
              label="עדיפות"
              displayValue={<PriorityBadge priority={task.priority as Priority} />}
              options={priorityOptions}
              className="bg-muted/30 rounded-lg p-3"
            />

            <div className="bg-muted/30 rounded-lg p-3 space-y-1">
              <p className="text-xs text-muted-foreground">סטטוס</p>
              <Select value={task.status} onValueChange={v => onStatusChange(task.id, v)}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <InlineEditField
              value={task.assignee_id || "__none__"}
              onSave={v => handleInlineSave("assignee_id", v)}
              label="משויך ל"
              displayValue={task.assignee_name || "לא משויך"}
              options={[
                { value: "__none__", label: "ללא" },
                ...assignableUsers.map(u => ({ value: u.id, label: u.name })),
              ]}
              className="bg-muted/30 rounded-lg p-3"
            />

            <div className="bg-muted/30 rounded-lg p-3 space-y-1">
              <p className="text-xs text-muted-foreground">תאריך יעד</p>
              <DateInput
                value={task.due_date ? new Date(task.due_date) : undefined}
                onChange={dt => handleDateSave("due_date", dt)}
                clearable
              />
            </div>
          </div>

          <InlineEditField
            value={task.milestone || ""}
            onSave={v => handleInlineSave("milestone", v)}
            label="מטרת-על"
            options={[
              { value: "__none__", label: "ללא" },
              ...existingMilestones.map(m => ({ value: m, label: m })),
            ]}
            displayValue={task.milestone || "—"}
            className="bg-muted/30 rounded-lg p-3"
          />

          <InlineEditField
            value={task.notes}
            onSave={v => handleInlineSave("notes", v)}
            label="הערות"
            type="textarea"
            className="bg-muted/30 rounded-lg p-3"
          />

          <InlineEditField
            value={task.deliverable}
            onSave={v => handleInlineSave("deliverable", v)}
            label="תוצר"
            className="bg-muted/30 rounded-lg p-3"
          />

          {task.is_daily && (
            <span className="inline-block text-xs bg-warning/15 text-warning px-2 py-0.5 rounded-full">משימה יומית</span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
