import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useData, useAuth, type Task, type Priority } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabase";
import { PriorityBadge } from "@/components/PriorityBadge";
import { type RecurringTask, recurringMatchesDay, findOrCreateRecurringInstance } from "@/lib/recurringUtils";
import { format, startOfWeek, addDays, isSameDay, isToday, isPast, addWeeks, subWeeks, getDay, startOfDay, isWithinInterval } from "date-fns";
import { ChevronRight, ChevronLeft, CalendarDays, AlertTriangle, Users, Repeat, Settings, X, Plus, ClipboardList, Pencil, CheckCircle2, Trash2, Zap } from "lucide-react";
import { EntityContextMenu, type ContextMenuGroupItem } from "@/components/EntityContextMenu";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import RecurringTasksPanel from "@/components/tasks/RecurringTasksPanel";
import TaskCreateDialog from "@/components/tasks/TaskCreateDialog";
import TaskEditDialog from "@/components/tasks/TaskEditDialog";

const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];


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

export default function TaskWeeklyView() {
  const { tasks, updateTaskStatus, updateTask, deleteTask, profiles, refreshTasks } = useData();
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

  // Recurring tasks
  const [recurringTasks, setRecurringTasks] = useState<RecurringTask[]>([]);

  const loadRecurring = useCallback(async () => {
    const { data } = await supabase.from("tasks").select("*").eq("status", "TEMPLATE").eq("is_active", true);
    if (data) setRecurringTasks(data as RecurringTask[]);
  }, []);

  useEffect(() => {
    loadRecurring();
  }, [loadRecurring]);

  const handleRecurringClick = useCallback(async (rt: RecurringTask, day: Date) => {
    const task = await findOrCreateRecurringInstance(rt, day);
    if (task) {
      await refreshTasks();
      setSelectedTask(task);
    }
  }, [refreshTasks]);

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

  const assignableUsers = profiles;

  const weekStart = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn: 0 });
    return addWeeks(base, weekOffset);
  }, [weekOffset]);

  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).filter(d => getDay(d) !== 6),
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
      const dayStart = startOfDay(day);
      const dayTasks = filteredTasks.filter(t => {
        if (!t.due_date) return false;
        if (t.start_date) {
          const start = startOfDay(new Date(t.start_date));
          const end = startOfDay(new Date(t.due_date));
          if (start > end) return isSameDay(new Date(t.due_date), day);
          return isWithinInterval(dayStart, { start, end });
        }
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
      const dayTasks = tasksByDay.get(key) || [];
      const existingRecurringIds = new Set(
        dayTasks.filter(t => t.recurring_task_id).map(t => t.recurring_task_id)
      );
      map.set(key, recurringTasks.filter(rt =>
        recurringMatchesDay(rt, day) && !existingRecurringIds.has(rt.id)
      ));
    });
    return map;
  }, [recurringTasks, days, tasksByDay]);

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
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">ניהול משימות</h1>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground border rounded-lg px-3 py-1.5 bg-muted/30">
            <CalendarDays className="h-4 w-4" />
            <span>{format(days[0], "dd/MM/yyyy")} – {format(days[days.length - 1], "dd/MM/yyyy")}</span>
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
      </div>

      {/* Weekly grid */}
      <div className="grid grid-cols-6 gap-2">
        {days.map((day, i) => {
          const key = format(day, "yyyy-MM-dd");
          const dayTasks = tasksByDay.get(key) || [];
          const dayRecurring = recurringByDay.get(key) || [];
          const doneTasks = dayTasks.filter(t => t.status === "DONE").length;
          const totalItems = dayTasks.length + dayRecurring.length;
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
                  {dayNames[day.getDay()]}
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
                {showTasks && dayTasks.map(task => {
                  const taskMenuGroups: ContextMenuGroupItem[][] = [
                    [
                      { label: "פרטי משימה", icon: Pencil, onClick: () => setSelectedTask(task) },
                      { label: task.status === "DONE" ? "סמן כלא בוצע" : "סמן כבוצע", icon: CheckCircle2, onClick: () => updateTaskStatus(task.id, task.status === "DONE" ? "TODO" : "DONE") },
                    ],
                    [
                      { label: "שנה עדיפות", icon: Zap, items: (["דחוף", "גבוה", "בינוני", "נמוך"] as const).map(p => ({ label: p, onClick: () => updateTask(task.id, { priority: p }), disabled: task.priority === p })) },
                    ],
                    [
                      { label: "מחק משימה", icon: Trash2, onClick: () => deleteTask(task.id), variant: "destructive" as const, confirmTitle: "מחיקת משימה", confirmDescription: `האם אתה בטוח שברצונך למחוק את "${task.title}"?` },
                    ],
                  ];
                  return (
                  <EntityContextMenu key={task.id} groups={taskMenuGroups}>
                  <WeeklyTaskCard
                    task={task}
                    showAssignee={assigneeFilter === "all"}
                    isDragging={dragTaskId === task.id}
                    isHighlighted={highlightTaskId === task.id}
                    onToggle={() => updateTaskStatus(task.id, task.status === "DONE" ? "TODO" : "DONE")}
                    onClick={() => setSelectedTask(task)}
                    onDragStart={() => setDragTaskId(task.id)}
                    onDragEnd={() => { setDragTaskId(null); setDragOverDay(null); }}
                  />
                  </EntityContextMenu>
                  );
                })}

                {/* Recurring task cards */}
                {showRecurring && dayRecurring.map(rt => (
                  <RecurringTaskCard key={`r-${rt.id}`} rt={rt} showAssignee={assigneeFilter === "all"} onClick={() => handleRecurringClick(rt, day)} />
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
                <span className="text-xs text-primary font-normal">← שחרר כאן להסרת תאריך</span>
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

      {/* Create type picker dialog - Direct task creation without process option */}
      <Dialog open={createPickerOpen} onOpenChange={setCreatePickerOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>משימה חדשה</DialogTitle>
          </DialogHeader>
          <div className="pt-2">
            <button
              className="w-full flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-center"
              onClick={() => { setCreatePickerOpen(false); setTaskCreateOpen(true); }}
            >
              <ClipboardList className="h-8 w-8 text-primary" />
              <div>
                <p className="font-semibold text-foreground text-sm">משימה</p>
                <p className="text-xs text-muted-foreground mt-0.5">חד פעמית או חוזרת</p>
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

      {/* Settings popup */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-[92vw] w-full max-h-[85vh] overflow-y-auto">
          <DialogHeader className="mb-4">
            <DialogTitle>ניהול חוזרות</DialogTitle>
          </DialogHeader>
          <RecurringTasksPanel />
        </DialogContent>
      </Dialog>

      {/* Task Edit Dialog */}
      <TaskEditDialog
        open={!!selectedTask}
        onOpenChange={(open) => !open && setSelectedTask(null)}
        task={selectedTask}
        onSaved={() => setSelectedTask(null)}
      />
    </div>
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

const WeeklyTaskCard = React.forwardRef<HTMLDivElement, WeeklyTaskCardProps & React.HTMLAttributes<HTMLDivElement>>(({ task, showAssignee, isDragging, isHighlighted, onToggle, onClick, onDragStart, onDragEnd, ...props }, ref) => {
  const isDone = task.status === "DONE";
  const isUrgent = task.priority === "דחוף";
  const initials = task.assignee_name ? task.assignee_name.trim().charAt(0).toUpperCase() : null;

  return (
    <div
      ref={ref}
      {...props}
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
});
WeeklyTaskCard.displayName = "WeeklyTaskCard";

// ─── Recurring task card ──────────────────────────────────────────────────────

function RecurringTaskCard({ rt, showAssignee, onClick }: { rt: RecurringTask; showAssignee: boolean; onClick?: () => void }) {
  const initials = rt.assignee_name ? rt.assignee_name.trim().charAt(0).toUpperCase() : null;

  return (
    <div className="rounded-lg px-2 py-2 text-[11px] border border-violet-500/30 bg-violet-500/10 select-none cursor-pointer hover:bg-violet-500/20 transition-colors" onClick={onClick}>
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

