import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useData, useAuth, type Task, type TaskStatus } from "@/contexts/AppContext";
import { DIVISIONS, DIVISION_COLORS } from "@/components/equipment/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/ui/date-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Pencil, Plus, Trash2, Play, Undo2, ChevronDown, ChevronUp, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";

const NO_DIVISION = "none";

type ColumnKey = "TODO" | "IN_PROGRESS";

const columns: { key: ColumnKey; label: string; headerClass: string }[] = [
  { key: "TODO", label: "לביצוע", headerClass: "bg-[hsl(var(--todo))]" },
  { key: "IN_PROGRESS", label: "בטיפול", headerClass: "bg-warning/20" },
];

// Completed tasks drop off the board (they stay in the database as DONE).
function columnOf(task: Task): ColumnKey | null {
  if (task.status === "DONE") return null;
  if (task.status === "IN_PROGRESS" || task.status === "BLOCKED") return "IN_PROGRESS";
  return "TODO";
}

function DivisionTag({ division }: { division?: string | null }) {
  if (!division) return null;
  return (
    <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full border ${DIVISION_COLORS[division] ?? "bg-muted text-muted-foreground"}`}>
      {division}
    </span>
  );
}

export default function SimpleTaskBoard() {
  const { tasks, addTask, updateTask, updateTaskStatus, deleteTask } = useData();
  const { currentUser } = useAuth();

  const [newTitle, setNewTitle] = useState("");
  const [newDivision, setNewDivision] = useState(NO_DIVISION);
  const [divisionFilter, setDivisionFilter] = useState<string>("all");

  const [showDone, setShowDone] = useState(false);
  const [noteTaskId, setNoteTaskId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const [editing, setEditing] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editDivision, setEditDivision] = useState(NO_DIVISION);
  const [editDue, setEditDue] = useState<Date | undefined>();

  // Recurring instances live in the calendar views; the board is for one-off work.
  const boardTasks = useMemo(
    () => tasks.filter(t => !t.recurring_task_id && !t.is_daily && t.status !== "TEMPLATE"),
    [tasks],
  );

  const visible = useMemo(
    () => boardTasks.filter(t => divisionFilter === "all" || (divisionFilter === NO_DIVISION ? !t.division : t.division === divisionFilter)),
    [boardTasks, divisionFilter],
  );

  const divisionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of boardTasks) {
      if (t.status === "DONE") continue;
      const k = t.division || NO_DIVISION;
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return counts;
  }, [boardTasks]);

  const byColumn = (key: ColumnKey) => {
    const list = visible.filter(t => columnOf(t) === key);
    return list.sort((a, b) => {
      // Dated tasks first (soonest on top), then newest undated.
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    });
  };

  const doneTasks = useMemo(
    () => visible
      .filter(t => t.status === "DONE")
      .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? "")),
    [visible],
  );

  const startNote = (task: Task) => {
    setNoteTaskId(task.id);
    setNoteDraft(task.notes ?? "");
  };

  const saveNote = async (task: Task) => {
    const value = noteDraft.trim() || null;
    setNoteTaskId(null);
    if (value === (task.notes ?? null)) return;
    await updateTask(task.id, { notes: value });
  };

  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title) return;
    await addTask({
      title,
      priority: "בינוני",
      status: "TODO",
      is_daily: false,
      division: newDivision === NO_DIVISION ? null : newDivision,
      created_by: currentUser?.id ?? null,
    });
    setNewTitle("");
  };

  const openEdit = (task: Task) => {
    setEditing(task);
    setEditTitle(task.title);
    setEditNotes(task.notes ?? "");
    setEditDivision(task.division || NO_DIVISION);
    setEditDue(task.due_date ? new Date(task.due_date) : undefined);
  };

  const saveEdit = async () => {
    if (!editing || !editTitle.trim()) return;
    await updateTask(editing.id, {
      title: editTitle.trim(),
      notes: editNotes.trim() || null,
      division: editDivision === NO_DIVISION ? null : editDivision,
      due_date: editDue ? editDue.toISOString() : null,
    });
    toast.success("המשימה עודכנה");
    setEditing(null);
  };

  const handleDelete = async (task: Task) => {
    try {
      await deleteTask(task.id);
      toast.success("המשימה נמחקה");
      setEditing(null);
    } catch {
      // error toast already shown by deleteTask
    }
  };

  const move = (task: Task, status: TaskStatus) => updateTaskStatus(task.id, status);

  return (
    <div className="space-y-4">
      {/* Quick add */}
      <div className="flex flex-wrap items-center gap-2 bg-card border rounded-lg p-3">
        <Input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
          placeholder="משימה חדשה... (Enter להוספה)"
          className="flex-1 min-w-[200px]"
        />
        <Select value={newDivision} onValueChange={setNewDivision}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="חטיבה" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_DIVISION}>ללא חטיבה</SelectItem>
            {DIVISIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={handleAdd} disabled={!newTitle.trim()}>
          <Plus className="h-4 w-4 ml-1" />הוסף
        </Button>
      </div>

      {/* Division filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setDivisionFilter("all")}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${divisionFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"}`}
        >
          הכל
        </button>
        {[...DIVISIONS, NO_DIVISION].map(d => (
          <button
            key={d}
            onClick={() => setDivisionFilter(d)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${divisionFilter === d ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"}`}
          >
            {d === NO_DIVISION ? "ללא חטיבה" : d}
            {divisionCounts[d] ? <span className="mr-1.5 opacity-70">{divisionCounts[d]}</span> : null}
          </button>
        ))}
      </div>

      {/* Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {columns.map(col => {
          const list = byColumn(col.key);
          return (
            <div key={col.key} className="space-y-2">
              <div className={`${col.headerClass} rounded-lg px-4 py-2.5 flex items-center justify-between`}>
                <h3 className="font-semibold text-sm text-foreground">{col.label}</h3>
                <span className="text-xs bg-card px-2 py-0.5 rounded-full text-muted-foreground font-medium">{list.length}</span>
              </div>
              <div className="space-y-2 min-h-[120px]">
                {list.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">אין משימות</p>}
                {list.map(task => {
                  const overdue = task.due_date && new Date(task.due_date) < new Date(new Date().setHours(0, 0, 0, 0));
                  return (
                    <div key={task.id} className="bg-card border rounded-lg p-3 shadow-sm space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium leading-snug text-foreground`}>
                          {task.title}
                        </p>
                        <button onClick={() => openEdit(task)} className="p-1 rounded hover:bg-muted shrink-0" aria-label="עריכה">
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <DivisionTag division={task.division} />
                        {task.due_date && (
                          <span className={`text-[11px] ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                            📅 {format(new Date(task.due_date), "dd/MM/yyyy")}
                          </span>
                        )}
                      </div>
                      {noteTaskId === task.id ? (
                        <Textarea
                          autoFocus
                          rows={2}
                          value={noteDraft}
                          onChange={e => setNoteDraft(e.target.value)}
                          onBlur={() => saveNote(task)}
                          onKeyDown={e => {
                            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveNote(task); }
                            if (e.key === "Escape") setNoteTaskId(null);
                          }}
                          placeholder="מה המצב עכשיו? (Enter לשמירה)"
                          className="text-xs"
                        />
                      ) : task.notes ? (
                        <button
                          onClick={() => startNote(task)}
                          className="w-full text-right text-xs bg-muted/60 hover:bg-muted rounded-md px-2 py-1.5 text-foreground whitespace-pre-wrap"
                          title="לחיצה לעדכון"
                        >
                          <span className="text-muted-foreground">עדכון אחרון: </span>{task.notes}
                        </button>
                      ) : (
                        <button onClick={() => startNote(task)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                          <MessageSquarePlus className="h-3.5 w-3.5" />הוסף עדכון מצב
                        </button>
                      )}
                      <div className="flex gap-1.5 pt-0.5">
                        {col.key === "TODO" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => move(task, "IN_PROGRESS")}>
                            <Play className="h-3 w-3 ml-1" />התחל
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-7 text-xs text-success" onClick={() => move(task, "DONE")}>
                          <Check className="h-3 w-3 ml-1" />בוצע
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Completed tasks — hidden by default, restorable */}
      <div className="border rounded-lg">
        <button
          onClick={() => setShowDone(v => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-muted/50 rounded-lg"
        >
          <span>משימות שהושלמו ({doneTasks.length})</span>
          {showDone ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showDone && (
          <div className="border-t divide-y">
            {doneTasks.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">אין משימות שהושלמו</p>}
            {doneTasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="text-sm text-muted-foreground line-through truncate">{task.title}</p>
                  {task.notes && <p className="text-xs text-muted-foreground truncate">{task.notes}</p>}
                </div>
                <DivisionTag division={task.division} />
                {task.completed_at && (
                  <span className="text-[11px] text-muted-foreground shrink-0">{format(new Date(task.completed_at), "dd/MM/yyyy")}</span>
                )}
                <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => move(task, "TODO")}>
                  <Undo2 className="h-3 w-3 ml-1" />החזר ללוח
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={v => { if (!v) setEditing(null); }}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>עריכת משימה</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>כותרת</Label>
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>חטיבה</Label>
                <Select value={editDivision} onValueChange={setEditDivision}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_DIVISION}>ללא חטיבה</SelectItem>
                    {DIVISIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>תאריך יעד</Label>
                <DateInput value={editDue} onChange={setEditDue} clearable />
              </div>
            </div>
            <div className="space-y-2">
              <Label>הערות</Label>
              <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} placeholder="פרטים, עדכונים, מה נאמר..." />
            </div>
            <div className="flex gap-2">
              <Button onClick={saveEdit} disabled={!editTitle.trim()} className="flex-1">שמור</Button>
              {editing && (
                <Button variant="outline" className="text-destructive" onClick={() => handleDelete(editing)}>
                  <Trash2 className="h-4 w-4 ml-1" />מחק
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
