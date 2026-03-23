import { useState, useEffect, useMemo } from "react";
import { type Task, type Priority, useData } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const priorityOptions: { value: Priority; label: string }[] = [
  { value: "דחוף", label: "דחוף" },
  { value: "גבוה", label: "גבוה" },
  { value: "בינוני", label: "בינוני" },
  { value: "נמוך", label: "נמוך" },
];

export function TaskDetailDialog({ task, onClose, profiles, currentUser, onUpdate, onStatusChange }: {
  task: Task | null;
  onClose: () => void;
  profiles: { id: string; name: string; role: string }[];
  currentUser: { id: string; role: string; name: string } | null;
  onUpdate: (id: string, updates: Partial<Task>) => Promise<void>;
  onStatusChange: (id: string, status: any) => Promise<void>;
}) {
  const { tasks: allTasks } = useData();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("בינוני");
  const [assigneeId, setAssigneeId] = useState("");
  const [milestone, setMilestone] = useState("");
  const [notes, setNotes] = useState("");

  const existingMilestones = useMemo(() => {
    const set = new Set<string>();
    allTasks.forEach(t => { if (t.milestone) set.add(t.milestone); });
    return Array.from(set).sort();
  }, [allTasks]);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setPriority(task.priority as Priority);
      setAssigneeId(task.assignee_id || "");
      setMilestone(task.milestone || "");
      setNotes(task.notes || "");
      setEditing(false);
    }
  }, [task]);

  if (!task) return null;

  const assignableUsers = profiles.filter(u => u.role !== "MANAGER" || u.id === currentUser?.id);

  const handleSave = async () => {
    const assignee = profiles.find(p => p.id === assigneeId);
    await onUpdate(task.id, {
      title: title.trim(),
      description: description.trim() || null,
      priority,
      assignee_id: assigneeId || null,
      assignee_name: assignee?.name || null,
      milestone: milestone.trim() || null,
      notes: notes.trim() || null,
    });
    setEditing(false);
  };

  const statusOptions = [
    { value: "TODO", label: "לביצוע" },
    { value: "IN_PROGRESS", label: "בביצוע" },
    { value: "DONE", label: "הושלם" },
    { value: "BLOCKED", label: "חסום" },
  ];

  return (
    <Dialog open={!!task} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{editing ? "עריכת משימה" : "פירוט משימה"}</span>
            {!editing && (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="text-xs">
                ✏️ עריכה
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {editing ? (
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">כותרת</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">תיאור</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">עדיפות</Label>
                <Select value={priority} onValueChange={v => setPriority(v as Priority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{priorityOptions.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">שיוך</Label>
                <Select value={assigneeId || "none"} onValueChange={v => setAssigneeId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">ללא</SelectItem>
                    {assignableUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
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
            <div className="space-y-1">
              <Label className="text-xs">הערות</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} className="flex-1">שמור</Button>
              <Button variant="outline" onClick={() => setEditing(false)} className="flex-1">ביטול</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div>
              <h3 className="text-lg font-semibold text-foreground">{task.title}</h3>
              {task.description && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{task.description}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">עדיפות</p>
                <PriorityBadge priority={task.priority as Priority} />
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">סטטוס</p>
                <Select value={task.status} onValueChange={v => onStatusChange(task.id, v)}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">משויך ל</p>
                <p className="text-sm font-medium text-foreground">{task.assignee_name || "לא משויך"}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">תאריך יעד</p>
                <p className="text-sm font-medium text-foreground">{task.due_date ? format(new Date(task.due_date), "dd/MM/yyyy") : "לא נקבע"}</p>
              </div>
            </div>

            {task.milestone && (
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">מטרת-על</p>
                <p className="text-sm text-foreground font-medium">{task.milestone}</p>
              </div>
            )}

            {task.notes && (
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">הערות</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{task.notes}</p>
              </div>
            )}

            {task.deliverable && (
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">תוצר</p>
                <p className="text-sm text-foreground">{task.deliverable}</p>
              </div>
            )}

            {task.is_daily && (
              <span className="inline-block text-xs bg-warning/15 text-warning px-2 py-0.5 rounded-full">משימה יומית</span>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
