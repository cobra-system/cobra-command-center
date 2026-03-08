import { useState } from "react";
import { useData, type TaskStatus, type Priority, type Task } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const columns: { status: TaskStatus; label: string; bgClass: string }[] = [
  { status: "TODO", label: "לביצוע", bgClass: "bg-[hsl(var(--todo))]" },
  { status: "IN_PROGRESS", label: "בביצוע", bgClass: "bg-[hsl(var(--in-progress))]" },
  { status: "DONE", label: "הושלם", bgClass: "bg-[hsl(var(--done))]" },
  { status: "BLOCKED", label: "חסום", bgClass: "bg-[hsl(var(--blocked))]" },
];

const priorityOptions: { value: Priority; label: string }[] = [
  { value: "P0", label: "P0 — דחוף" },
  { value: "P1", label: "P1 — גבוה" },
  { value: "P2", label: "P2 — רגיל" },
  { value: "P3", label: "P3 — נמוך" },
];

export default function TasksPage() {
  const { tasks, updateTaskStatus, addTask, profiles } = useData();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("P2");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState<Date>();
  const [isDaily, setIsDaily] = useState(false);

  const employees = profiles.filter(u => u.role !== "MANAGER");

  const resetForm = () => { setTitle(""); setDescription(""); setPriority("P2"); setAssigneeId(""); setDueDate(undefined); setIsDaily(false); };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    const assignee = profiles.find(u => u.id === assigneeId);
    await addTask({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      status: "TODO",
      assignee_id: assigneeId || undefined,
      assignee_name: assignee?.name,
      due_date: dueDate?.toISOString(),
      is_daily: isDaily,
    });
    resetForm();
    setOpen(false);
  };

  const getColumnTasks = (status: TaskStatus): Task[] => tasks.filter(t => t.status === status);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">משימות</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 ml-2" />משימה חדשה</Button></DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>יצירת משימה חדשה</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2"><Label>כותרת *</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="תאר את המשימה..." /></div>
              <div className="space-y-2"><Label>תיאור</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="פרטים נוספים..." rows={3} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>עדיפות</Label>
                  <Select value={priority} onValueChange={v => setPriority(v as Priority)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{priorityOptions.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>שיוך לעובד</Label>
                  <Select value={assigneeId} onValueChange={setAssigneeId}>
                    <SelectTrigger><SelectValue placeholder="בחר עובד" /></SelectTrigger>
                    <SelectContent>{employees.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>תאריך יעד</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-right font-normal", !dueDate && "text-muted-foreground")}>
                      <CalendarIcon className="h-4 w-4 ml-2" />{dueDate ? format(dueDate, "dd/MM/yyyy") : "בחר תאריך"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
                </Popover>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isDaily" checked={isDaily} onChange={e => setIsDaily(e.target.checked)} className="rounded" />
                <Label htmlFor="isDaily">משימה יומית (חוזרת)</Label>
              </div>
              <Button onClick={handleSubmit} disabled={!title.trim()} className="w-full">צור משימה</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {columns.map(col => {
          const colTasks = getColumnTasks(col.status);
          return (
            <div key={col.status} className="space-y-3">
              <div className={`${col.bgClass} rounded-lg px-4 py-2.5 flex items-center justify-between`}>
                <h3 className="font-semibold text-sm text-foreground">{col.label}</h3>
                <span className="text-xs bg-card px-2 py-0.5 rounded-full text-muted-foreground font-medium">{colTasks.length}</span>
              </div>
              <div className="space-y-2 min-h-[200px]">
                {colTasks.map(task => (
                  <div key={task.id} className="bg-card rounded-lg border p-3 shadow-sm space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground leading-tight">{task.title}</p>
                      <PriorityBadge priority={task.priority as Priority} className="shrink-0" />
                    </div>
                    {task.assignee_name && <p className="text-xs text-muted-foreground">👤 {task.assignee_name}</p>}
                    {task.due_date && <p className="text-xs text-muted-foreground">📅 {format(new Date(task.due_date), "dd/MM/yyyy")}</p>}
                    {task.notes && <p className="text-xs text-muted-foreground truncate">💬 {task.notes}</p>}
                    {task.is_daily && <span className="inline-block text-xs bg-warning/15 text-warning px-2 py-0.5 rounded-full">יומית</span>}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {columns.filter(c => c.status !== task.status).map(c => (
                        <button key={c.status} onClick={() => updateTaskStatus(task.id, c.status)} className="text-[10px] px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">{c.label}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
