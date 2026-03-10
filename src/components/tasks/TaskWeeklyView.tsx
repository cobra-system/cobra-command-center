import { useMemo, useState } from "react";
import { useData, useAuth, type Task, type Priority } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { format, startOfWeek, addDays, isSameDay, isToday, isPast, addWeeks, subWeeks } from "date-fns";
import { he } from "date-fns/locale";
import { ChevronRight, ChevronLeft, CalendarDays, AlertTriangle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 18;
  const circumference = 2 * Math.PI * r;
  const pct = total > 0 ? done / total : 0;
  const offset = circumference * (1 - pct);

  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0">
      <circle
        cx="22" cy="22" r={r}
        fill="none" strokeWidth="3"
        className="stroke-muted-foreground/20"
      />
      {total > 0 && (
        <circle
          cx="22" cy="22" r={r}
          fill="none" strokeWidth="3"
          className={cn(pct === 1 ? "stroke-emerald-500" : "stroke-primary")}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 22 22)"
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      )}
      <text
        x="22" y="26"
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        className="fill-foreground"
      >
        {total > 0 ? `${Math.round(pct * 100)}%` : "—"}
      </text>
    </svg>
  );
}

export default function TaskWeeklyView() {
  const { tasks, updateTaskStatus, updateTask, profiles } = useData();
  const { currentUser } = useAuth();
  const [weekOffset, setWeekOffset] = useState(0);
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  const assignableUsers = profiles.filter(u => u.role !== "MANAGER" || u.id === currentUser?.id);

  const weekStart = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn: 0 });
    return addWeeks(base, weekOffset);
  }, [weekOffset]);

  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // Filtered tasks based on employee selection
  const filteredTasks = useMemo(() =>
    tasks.filter(t => assigneeFilter === "all" || t.assignee_id === assigneeFilter),
    [tasks, assigneeFilter]
  );

  // Tasks with due dates mapped to days
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

  // Unscheduled tasks (no due date, not done)
  const unscheduled = useMemo(() =>
    filteredTasks.filter(t => !t.due_date && t.status !== "DONE"),
    [filteredTasks]
  );

  // Overdue tasks (past due, not done)
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
    <div className="space-y-4">
      {/* Top bar: week navigation + employee filter */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
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
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            <span>{format(days[0], "d MMM", { locale: he })} – {format(days[6], "d MMM yyyy", { locale: he })}</span>
          </div>
        </div>

        {/* Employee filter */}
        <div className="flex items-center gap-2">
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
      </div>

      {/* Overdue alert */}
      {overdue.length > 0 && weekOffset === 0 && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-destructive">{overdue.length} משימות באיחור</p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {overdue.slice(0, 5).map(t => (
                <span key={t.id} className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">{t.title}</span>
              ))}
              {overdue.length > 5 && <span className="text-xs text-destructive">+{overdue.length - 5} נוספות</span>}
            </div>
          </div>
        </div>
      )}

      {/* Weekly grid */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, i) => {
          const key = format(day, "yyyy-MM-dd");
          const dayTasks = tasksByDay.get(key) || [];
          const doneTasks = dayTasks.filter(t => t.status === "DONE").length;
          const today = isToday(day);
          const isDropTarget = dragOverDay === key;

          return (
            <div
              key={key}
              className={cn(
                "rounded-xl border min-h-[240px] flex flex-col transition-all",
                today ? "border-primary bg-primary/5" : "border-border/50 bg-card/50",
                isDropTarget && "ring-2 ring-primary/60 bg-primary/10 border-primary/40"
              )}
              onDragOver={e => { e.preventDefault(); setDragOverDay(key); }}
              onDragLeave={e => {
                // Only clear if leaving the column entirely
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverDay(null);
                }
              }}
              onDrop={() => handleDrop(day)}
            >
              {/* Day header */}
              <div className={cn(
                "px-2 py-2 border-b flex flex-col items-center gap-1",
                today ? "border-primary/20" : "border-border/30"
              )}>
                <p className={cn("text-[11px] font-medium", today ? "text-primary" : "text-muted-foreground")}>
                  {dayNames[i]}
                </p>
                <p className={cn("text-lg font-bold leading-none", today ? "text-primary" : "text-foreground")}>
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
              <div className="flex-1 p-1.5 space-y-1 overflow-y-auto max-h-[280px]">
                {dayTasks.length === 0 && !isDropTarget && (
                  <p className="text-[10px] text-muted-foreground/40 text-center pt-4">—</p>
                )}
                {isDropTarget && dayTasks.length === 0 && (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-[11px] text-primary/60">שחרר כאן</p>
                  </div>
                )}
                {dayTasks.map(task => (
                  <WeeklyTaskCard
                    key={task.id}
                    task={task}
                    showAssignee={assigneeFilter === "all"}
                    isDragging={dragTaskId === task.id}
                    onToggle={() => updateTaskStatus(task.id, task.status === "DONE" ? "TODO" : "DONE")}
                    onDragStart={() => setDragTaskId(task.id)}
                    onDragEnd={() => { setDragTaskId(null); setDragOverDay(null); }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unscheduled tasks – also a drop zone to remove due date */}
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
    </div>
  );
}

interface WeeklyTaskCardProps {
  task: Task;
  showAssignee: boolean;
  isDragging: boolean;
  onToggle: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

function WeeklyTaskCard({ task, showAssignee, isDragging, onToggle, onDragStart, onDragEnd }: WeeklyTaskCardProps) {
  const isDone = task.status === "DONE";
  const isUrgent = task.priority === "דחוף";
  const initials = task.assignee_name ? task.assignee_name.trim().charAt(0).toUpperCase() : null;

  return (
    <div
      className={cn(
        "rounded-lg px-2 py-1.5 text-[11px] cursor-grab active:cursor-grabbing transition-all border select-none",
        isDone ? "bg-success/10 border-success/20 opacity-60" :
        isUrgent ? "bg-destructive/10 border-destructive/20" :
        "bg-card border-border/40 hover:shadow-sm",
        isDragging && "opacity-40 scale-95"
      )}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onToggle}
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
