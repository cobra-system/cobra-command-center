import { useMemo, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useData, useAuth, type Task, type Priority } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabase";
import { PriorityBadge } from "@/components/PriorityBadge";
import { format, startOfWeek, addDays, isSameDay, isToday, isPast, addWeeks, subWeeks, getDay, getDate } from "date-fns";
import { he } from "date-fns/locale";
import { ChevronRight, ChevronLeft, CalendarDays, AlertTriangle, Users, Repeat, Zap, Settings, X, Plus, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import RecurringTasksPanel from "@/components/tasks/RecurringTasksPanel";
import WorkflowsPanel from "@/components/tasks/WorkflowsPanel";
import TaskCreateDialog from "@/components/tasks/TaskCreateDialog";

const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

interface RecurringTask {
  id: string;
  title: string;
  description: string | null;
  frequency: string;
  day_of_week: number | null;
  day_of_month: number | null;
  days_before: number;
  priority: string;
  assignee_id: string | null;
  assignee_name: string | null;
  is_active: boolean;
  next_due: string | null;
}

interface WorkflowStep {
  index: number; name: string; description: string; action: string;
}
interface WorkflowTemplate {
  id: string; name: string; steps: WorkflowStep[];
}
interface WorkflowInstance {
  id: string; template_id: string; current_step: number; status: string;
  template?: WorkflowTemplate;
}

const priorityOptions: { value: Priority; label: string }[] = [
  { value: "דחוף", label: "דחוף" },
  { value: "גבוה", label: "גבוה" },
  { value: "בינוני", label: "בינוני" },
  { value: "נמוך", label: "נמוך" },
];

function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 20;
  const circumference = 2 * Math.PI * r;
  const pct = total > 0 ? done / total : 0;
  const offset = circumference * (1 - pct);

  return (
    <svg width="50" height="50" viewBox="0 0 50 50" className="shrink-0">
      <circle cx="25" cy="25" r={r} fill="none" strokeWidth="3" className="stroke-muted-foreground/20" />
      {total > 0 && (
        <circle
          cx="25" cy="25" r={r} fill="none" strokeWidth="3"
          className={cn(pct === 1 ? "stroke-emerald-500" : "stroke-primary")}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 25 25)"
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      )}
      <text x="25" y="29" textAnchor="middle" fontSize="10" fontWeight="700" className="fill-foreground">
        {total > 0 ? `${Math.round(pct * 100)}%` : "—"}
      </text>
    </svg>
  );
}

function recurringMatchesDay(rt: RecurringTask, day: Date): boolean {
  const dayOfWeek = getDay(day);
  const dayOfMonth = getDate(day);
  switch (rt.frequency) {
    case "daily": return true;
    case "weekly": return rt.day_of_week === dayOfWeek;
    case "biweekly": return rt.day_of_week === dayOfWeek;
    case "monthly": return rt.day_of_month === dayOfMonth;
    case "quarterly":
    case "biannual":
    case "annual": return rt.day_of_month === dayOfMonth;
    default: return false;
  }
}

export default function TaskWeeklyView() {
  const { tasks, updateTaskStatus, updateTask, profiles } = useData();
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [weekOffset, setWeekOffset] = useState(0);
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("recurring");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [createPickerOpen, setCreatePickerOpen] = useState(false);
  const [taskCreateOpen, setTaskCreateOpen] = useState(false);
  const [highlightTaskId, setHighlightTaskId] = useState<string | null>(null);
  const [showTasks, setShowTasks] = useState(true);
  const [showRecurring, setShowRecurring] = useState(true);
  const [showWorkflows, setShowWorkflows] = useState(true);

  // Recurring tasks
  const [recurringTasks, setRecurringTasks] = useState<RecurringTask[]>([]);
  const [workflowInstances, setWorkflowInstances] = useState<WorkflowInstance[]>([]);

  const loadRecurring = useCallback(async () => {
    const { data } = await supabase.from("recurring_tasks").select("*").eq("is_active", true);
    if (data) setRecurringTasks(data as RecurringTask[]);
  }, []);

  const loadWorkflows = useCallback(async () => {
    const { data: instances } = await supabase
      .from("workflow_instances")
      .select("id, template_id, current_step, status")
      .eq("status", "active");
    if (!instances) return;
    const { data: templates } = await supabase.from("workflow_templates").select("id, name, steps");
    if (templates) {
      const enriched = instances.map(inst => ({
        ...inst,
        template: templates.find(t => t.id === inst.template_id) as unknown as WorkflowTemplate | undefined,
      }));
      setWorkflowInstances(enriched as WorkflowInstance[]);
    } else {
      setWorkflowInstances(instances as WorkflowInstance[]);
    }
  }, []);

  useEffect(() => {
    loadRecurring();
    loadWorkflows();
  }, [loadRecurring, loadWorkflows]);

  // Handle highlight from search params
  useEffect(() => {
    const highlightId = searchParams.get("highlight");
    if (highlightId) {
      setHighlightTaskId(highlightId);
      // Auto-clear highlight after 3 seconds
      const timeout = setTimeout(() => setHighlightTaskId(null), 3000);
      return () => clearTimeout(timeout);
    }
  }, [searchParams]);

  const assignableUsers = profiles.filter(u => u.role !== "MANAGER" || u.id === currentUser?.id);

  const weekStart = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn: 0 });
    return addWeeks(base, weekOffset);
  }, [weekOffset]);

  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).reverse(),
    [weekStart]
  );

  const filteredTasks = useMemo(() =>
    tasks.filter(t => assigneeFilter === "all" || t.assignee_id === assigneeFilter),
    [tasks, assigneeFilter]
  );

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    days.forEach(day => {
      const key = format(day, "yyyy-MM-dd");
      const dayTasks = filteredTasks.filter(t => {
        if (!t.due_date) return false;
        return isSameDay(new Date(t.due_date), day);
      });
      dayTasks.sort((a, b) => {
        const pOrder: Record<string, number> = { "דחוף": 0, "גבוה": 1, "בינוני": 2, "נמוך": 3 };
        return (pOrder[a.priority] ?? 2) - (pOrder[b.priority] ?? 2);
      });
      map.set(key, dayTasks);
    });
    return map;
  }, [filteredTasks, days]);

  const recurringByDay = useMemo(() => {
    const map = new Map<string, RecurringTask[]>();
    days.forEach(day => {
      const key = format(day, "yyyy-MM-dd");
      map.set(key, recurringTasks.filter(rt => recurringMatchesDay(rt, day)));
    });
    return map;
  }, [recurringTasks, days]);

  const todayKey = format(isToday(days[0]) ? days[0] : days.find(d => isToday(d)) ?? days[0], "yyyy-MM-dd");
  const workflowsForToday = workflowInstances;

  const unscheduled = useMemo(() =>
    filteredTasks.filter(t => !t.due_date && t.status !== "DONE"),
    [filteredTasks]
  );

  const overdue = useMemo(() =>
    filteredTasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)) && t.status !== "DONE"),
    [filteredTasks]
  );

  const handleDrop = async (day: Date) => {
    if (!dragTaskId) return;
    await updateTask(dragTaskId, { due_date: day.toISOString() });
    setDragTaskId(null);
    setDragOverDay(null);
  };

  const handleDropUnscheduled = async () => {
    if (!dragTaskId) return;
    await updateTask(dragTaskId, { due_date: null });
    setDragTaskId(null);
    setDragOverDay(null);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">ניהול משימות</h1>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground border rounded-lg px-3 py-1.5 bg-muted/30">
            <CalendarDays className="h-4 w-4" />
            <span>{format(days[0], "d MMM", { locale: he })} – {format(days[6], "d MMM yyyy", { locale: he })}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w - 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)} className="text-xs">
            השבוע
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w + 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-1.5 me-4">
            <Users className="h-4 w-4 text-muted-foreground" />
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="h-8 text-xs w-40">
                <SelectValue placeholder="כל העובדים" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל העובדים</SelectItem>
                {assignableUsers.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-4 w-4" />
          </Button>

          <Button size="sm" className="gap-1.5" onClick={() => setCreatePickerOpen(true)}>
            <Plus className="h-4 w-4" />
            צור
          </Button>
        </div>
      </div>

      {/* Overdue alert */}
      {overdue.length > 0 && weekOffset === 0 && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-destructive">{overdue.length} משימות באיחור</p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {overdue.slice(0, 5).map(t => (
                <span key={t.id} className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full cursor-pointer hover:bg-destructive/20" onClick={() => setSelectedTask(t)}>{t.title}</span>
              ))}
              {overdue.length > 5 && <span className="text-xs text-destructive">+{overdue.length - 5} נוספות</span>}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={() => setShowTasks(v => !v)}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all",
            showTasks
              ? "bg-primary/10 border-primary/30 text-primary font-medium"
              : "bg-muted/30 border-border/50 text-muted-foreground/50 line-through"
          )}
        >
          <span className={cn("h-2 w-2 rounded-full transition-colors", showTasks ? "bg-primary" : "bg-muted-foreground/30")} />
          משימות
        </button>
        <button
          onClick={() => setShowRecurring(v => !v)}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all",
            showRecurring
              ? "bg-accent/50 border-accent/30 text-accent-foreground font-medium"
              : "bg-muted/30 border-border/50 text-muted-foreground/50 line-through"
          )}
        >
          <span className={cn("h-2 w-2 rounded-full transition-colors", showRecurring ? "bg-violet-500" : "bg-muted-foreground/30")} />
          חוזרות
        </button>
        <button
          onClick={() => setShowWorkflows(v => !v)}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all",
            showWorkflows
              ? "bg-warning/10 border-warning/30 text-warning font-medium"
              : "bg-muted/30 border-border/50 text-muted-foreground/50 line-through"
          )}
        >
          <span className={cn("h-2 w-2 rounded-full transition-colors", showWorkflows ? "bg-warning" : "bg-muted-foreground/30")} />
          תהליכים
        </button>
      </div>

      {/* Weekly grid */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, i) => {
          const key = format(day, "yyyy-MM-dd");
          const dayTasks = tasksByDay.get(key) || [];
          const dayRecurring = recurringByDay.get(key) || [];
          const dayWorkflows = key === todayKey ? workflowsForToday : [];
          const doneTasks = dayTasks.filter(t => t.status === "DONE").length;
          const totalItems = dayTasks.length + dayRecurring.length + dayWorkflows.length;
          const today = isToday(day);
          const isDropTarget = dragOverDay === key;

          return (
            <div
              key={key}
              className={cn(
                "rounded-xl border min-h-[320px] flex flex-col transition-all",
                today ? "border-primary bg-primary/5" : "border-border/50 bg-card/50",
                isDropTarget && "ring-2 ring-primary/60 bg-primary/10 border-primary/40"
              )}
              onDragOver={e => { e.preventDefault(); setDragOverDay(key); }}
              onDragLeave={e => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverDay(null);
              }}
              onDrop={() => handleDrop(day)}
            >
              {/* Day header */}
              <div className={cn(
                "px-2 py-2.5 border-b flex flex-col items-center gap-1",
                today ? "border-primary/20" : "border-border/30"
              )}>
                <p className={cn("text-xs font-semibold tracking-wide", today ? "text-primary" : "text-muted-foreground")}>
                  {dayNames[i]}
                </p>
                <p className={cn("text-xl font-bold leading-none", today ? "text-primary" : "text-foreground")}>
                  {format(day, "d")}
                </p>
                <ProgressRing done={doneTasks} total={dayTasks.length} />
                {dayTasks.length > 0 && (
                  <p className="text-[9px] text-muted-foreground/60">
                    {doneTasks}/{dayTasks.length}
                  </p>
                )}
              </div>

              {/* Tasks */}
              <div className="flex-1 p-1.5 space-y-1 overflow-y-auto max-h-[380px]">
                {totalItems === 0 && !isDropTarget && (
                  <p className="text-[10px] text-muted-foreground/40 text-center pt-4">—</p>
                )}
                {isDropTarget && totalItems === 0 && (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-[11px] text-primary/60">שחרר כאן</p>
                  </div>
                )}

                {/* Regular tasks */}
                {showTasks && dayTasks.map(task => (
                  <WeeklyTaskCard
                    key={task.id}
                    task={task}
                    showAssignee={assigneeFilter === "all"}
                    isDragging={dragTaskId === task.id}
                    isHighlighted={highlightTaskId === task.id}
                    onToggle={() => updateTaskStatus(task.id, task.status === "DONE" ? "TODO" : "DONE")}
                    onClick={() => setSelectedTask(task)}
                    onDragStart={() => setDragTaskId(task.id)}
                    onDragEnd={() => { setDragTaskId(null); setDragOverDay(null); }}
                  />
                ))}

                {/* Recurring task cards */}
                {showRecurring && dayRecurring.map(rt => (
                  <RecurringTaskCard key={`r-${rt.id}`} rt={rt} showAssignee={assigneeFilter === "all"} />
                ))}

                {/* Workflow step cards */}
                {showWorkflows && dayWorkflows.map(wf => (
                  <WorkflowCard key={`wf-${wf.id}`} instance={wf} onRefresh={loadWorkflows} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unscheduled tasks */}
      <div
        className={cn(
          "mt-4 rounded-xl border-2 border-dashed transition-all p-3",
          dragOverDay === "__unscheduled__"
            ? "border-primary/60 bg-primary/5"
            : "border-transparent"
        )}
        onDragOver={e => { e.preventDefault(); setDragOverDay("__unscheduled__"); }}
        onDragLeave={e => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverDay(null);
        }}
        onDrop={handleDropUnscheduled}
      >
        {(unscheduled.length > 0 || dragOverDay === "__unscheduled__") && (
          <>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
              <span className="h-4 w-1 rounded-full bg-muted-foreground/30" />
              ללא תאריך יעד ({unscheduled.length})
              {dragOverDay === "__unscheduled__" && (
                <span className="text-xs text-primary font-normal">שחרר כאן להסרת תאריך →</span>
              )}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {unscheduled.map(task => (
                <div
                  key={task.id}
                  className="bg-card rounded-lg border border-border/50 p-2.5 space-y-1 cursor-grab active:cursor-grabbing"
                  draggable
                  onDragStart={() => setDragTaskId(task.id)}
                  onDragEnd={() => { setDragTaskId(null); setDragOverDay(null); }}
                  onClick={(e) => { if (e.detail !== 1) return; setSelectedTask(task); }}
                >
                  <p className="text-xs font-medium text-foreground leading-tight line-clamp-2">{task.title}</p>
                  <div className="flex items-center justify-between">
                    <PriorityBadge priority={task.priority as Priority} />
                    {task.assignee_name && assigneeFilter === "all" && (
                      <span className="text-[10px] text-muted-foreground truncate max-w-[60px]">{task.assignee_name}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Create type picker dialog */}
      <Dialog open={createPickerOpen} onOpenChange={setCreatePickerOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>מה ברצונך ליצור?</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-center"
              onClick={() => { setCreatePickerOpen(false); setTaskCreateOpen(true); }}
            >
              <ClipboardList className="h-8 w-8 text-primary" />
              <div>
                <p className="font-semibold text-foreground text-sm">משימה</p>
                <p className="text-xs text-muted-foreground mt-0.5">חד פעמית או חוזרת</p>
              </div>
            </button>
            <button
              className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-border hover:border-amber-500 hover:bg-amber-500/5 transition-all text-center"
              onClick={() => { setCreatePickerOpen(false); setSettingsTab("workflows"); setSettingsOpen(true); }}
            >
              <Zap className="h-8 w-8 text-amber-500" />
              <div>
                <p className="font-semibold text-foreground text-sm">תהליך</p>
                <p className="text-xs text-muted-foreground mt-0.5">התחל workflow</p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task create dialog */}
      <TaskCreateDialog
        open={taskCreateOpen}
        onOpenChange={setTaskCreateOpen}
        onSaved={loadRecurring}
      />

      {/* Settings drawer */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="left" className="w-[600px] max-w-[95vw] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>ניהול חוזרות ותהליכים</SheetTitle>
          </SheetHeader>
          <Tabs value={settingsTab} onValueChange={setSettingsTab}>
            <TabsList className="w-full mb-4">
              <TabsTrigger value="recurring" className="flex-1 gap-1.5">
                <Repeat className="h-3.5 w-3.5" />חוזרות
              </TabsTrigger>
              <TabsTrigger value="workflows" className="flex-1 gap-1.5">
                <Zap className="h-3.5 w-3.5" />תהליכים
              </TabsTrigger>
            </TabsList>
            <TabsContent value="recurring">
              <RecurringTasksPanel />
            </TabsContent>
            <TabsContent value="workflows">
              <WorkflowsPanel />
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        profiles={profiles}
        currentUser={currentUser}
        onUpdate={updateTask}
        onStatusChange={updateTaskStatus}
      />
    </div>
  );
}

// ─── Task Detail Dialog ───────────────────────────────────────────────────────

function TaskDetailDialog({ task, onClose, profiles, currentUser, onUpdate, onStatusChange }: {
  task: Task | null;
  onClose: () => void;
  profiles: { id: string; name: string; role: string }[];
  currentUser: { id: string; role: string; name: string } | null;
  onUpdate: (id: string, updates: Partial<Task>) => Promise<void>;
  onStatusChange: (id: string, status: any) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("בינוני");
  const [assigneeId, setAssigneeId] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setPriority(task.priority as Priority);
      setAssigneeId(task.assignee_id || "");
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

// ─── Regular task card ────────────────────────────────────────────────────────

interface WeeklyTaskCardProps {
  task: Task;
  showAssignee: boolean;
  isDragging: boolean;
  isHighlighted?: boolean;
  onToggle: () => void;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

function WeeklyTaskCard({ task, showAssignee, isDragging, isHighlighted, onToggle, onClick, onDragStart, onDragEnd }: WeeklyTaskCardProps) {
  const isDone = task.status === "DONE";
  const isUrgent = task.priority === "דחוף";
  const initials = task.assignee_name ? task.assignee_name.trim().charAt(0).toUpperCase() : null;

  return (
    <div
      className={cn(
        "rounded-lg px-2 py-2 text-[11px] cursor-grab active:cursor-grabbing transition-all border select-none",
        isDone ? "bg-success/10 border-success/20 opacity-60" :
        isUrgent ? "bg-destructive/10 border-destructive/20" :
        "bg-card border-border/40 hover:shadow-sm",
        isDragging && "opacity-40 scale-95",
        isHighlighted && "ring-2 ring-yellow-400 ring-offset-2 bg-yellow-50/50"
      )}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={(e) => {
        e.stopPropagation();
        if (e.detail !== 1) return; // prevent second click of a double-click from reopening
        onClick();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <p className={cn(
        "font-medium leading-tight line-clamp-2",
        isDone ? "line-through text-muted-foreground" : "text-foreground"
      )}>
        {task.title}
      </p>
      {showAssignee && initials && !isDone && (
        <div className="flex items-center gap-1 mt-1">
          <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary/20 text-primary text-[8px] font-bold shrink-0">
            {initials}
          </span>
          <span className="text-[9px] text-muted-foreground/60 truncate">{task.assignee_name}</span>
        </div>
      )}
    </div>
  );
}

// ─── Recurring task card ──────────────────────────────────────────────────────

function RecurringTaskCard({ rt, showAssignee }: { rt: RecurringTask; showAssignee: boolean }) {
  const initials = rt.assignee_name ? rt.assignee_name.trim().charAt(0).toUpperCase() : null;

  return (
    <div className="rounded-lg px-2 py-2 text-[11px] border border-violet-500/30 bg-violet-500/10 select-none">
      <div className="flex items-start gap-1">
        <Repeat className="h-3 w-3 text-violet-400 shrink-0 mt-0.5" />
        <p className="font-medium leading-tight line-clamp-2 text-violet-900 dark:text-violet-200">{rt.title}</p>
      </div>
      {showAssignee && initials && (
        <div className="flex items-center gap-1 mt-1">
          <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-violet-500/20 text-violet-600 dark:text-violet-300 text-[8px] font-bold shrink-0">
            {initials}
          </span>
          <span className="text-[9px] text-muted-foreground/60 truncate">{rt.assignee_name}</span>
        </div>
      )}
    </div>
  );
}

// ─── Workflow step card ───────────────────────────────────────────────────────

function WorkflowCard({ instance, onRefresh }: { instance: WorkflowInstance; onRefresh: () => void }) {
  const currentStep = instance.template?.steps?.[instance.current_step];
  const [completing, setCompleting] = useState(false);

  const completeStep = async () => {
    setCompleting(true);
    const nextStep = instance.current_step + 1;
    const totalSteps = instance.template?.steps?.length ?? 0;
    if (nextStep >= totalSteps) {
      await supabase.from("workflow_instances").update({ status: "completed", current_step: nextStep }).eq("id", instance.id);
    } else {
      await supabase.from("workflow_instances").update({ current_step: nextStep }).eq("id", instance.id);
    }
    setCompleting(false);
    onRefresh();
  };

  if (!currentStep) return null;

  return (
    <div
      className="rounded-lg px-2 py-2 text-[11px] border border-amber-500/30 bg-amber-500/10 select-none cursor-pointer hover:bg-amber-500/20 transition-colors"
      onClick={completing ? undefined : completeStep}
    >
      <div className="flex items-start gap-1">
        <Zap className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="font-medium leading-tight line-clamp-1 text-amber-900 dark:text-amber-200">
            {instance.template?.name}
          </p>
          <p className="text-[10px] text-amber-700/70 dark:text-amber-300/60 line-clamp-1 mt-0.5">
            שלב {instance.current_step + 1}: {currentStep.name}
          </p>
        </div>
      </div>
    </div>
  );
}
