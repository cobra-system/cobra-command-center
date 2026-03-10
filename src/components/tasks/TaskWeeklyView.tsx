import { useMemo, useState } from "react";
import { useData, useAuth, type Task, type Priority } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { format, startOfWeek, addDays, isSameDay, isToday, isPast, addWeeks, subWeeks } from "date-fns";
import { he } from "date-fns/locale";
import { ChevronRight, ChevronLeft, CalendarDays, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export default function TaskWeeklyView() {
  const { tasks, updateTaskStatus } = useData();
  const { currentUser } = useAuth();
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn: 0 });
    return addWeeks(base, weekOffset);
  }, [weekOffset]);

  const days = useMemo(() => 
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // Tasks with due dates mapped to days
  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    days.forEach(day => {
      const key = format(day, "yyyy-MM-dd");
      const dayTasks = tasks.filter(t => {
        if (!t.due_date) return false;
        return isSameDay(new Date(t.due_date), day);
      });
      // Sort: urgent first, then by status
      dayTasks.sort((a, b) => {
        const pOrder: Record<string, number> = { "דחוף": 0, "גבוה": 1, "בינוני": 2, "נמוך": 3 };
        return (pOrder[a.priority] ?? 2) - (pOrder[b.priority] ?? 2);
      });
      map.set(key, dayTasks);
    });
    return map;
  }, [tasks, days]);

  // Unscheduled tasks (no due date, not done)
  const unscheduled = useMemo(() => 
    tasks.filter(t => !t.due_date && t.status !== "DONE"),
    [tasks]
  );

  // Overdue tasks (past due, not done)
  const overdue = useMemo(() =>
    tasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)) && t.status !== "DONE"),
    [tasks]
  );

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
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
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          <span>{format(days[0], "d MMM", { locale: he })} – {format(days[6], "d MMM yyyy", { locale: he })}</span>
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
          const today = isToday(day);

          return (
            <div key={key} className={cn(
              "rounded-xl border min-h-[200px] flex flex-col",
              today ? "border-primary bg-primary/5" : "border-border/50 bg-card/50"
            )}>
              {/* Day header */}
              <div className={cn(
                "px-3 py-2 border-b text-center",
                today ? "border-primary/20" : "border-border/30"
              )}>
                <p className={cn("text-[11px] font-medium", today ? "text-primary" : "text-muted-foreground")}>
                  {dayNames[i]}
                </p>
                <p className={cn(
                  "text-lg font-bold",
                  today ? "text-primary" : "text-foreground"
                )}>
                  {format(day, "d")}
                </p>
              </div>

              {/* Tasks */}
              <div className="flex-1 p-1.5 space-y-1 overflow-y-auto max-h-[300px]">
                {dayTasks.length === 0 && (
                  <p className="text-[10px] text-muted-foreground/40 text-center pt-4">—</p>
                )}
                {dayTasks.map(task => (
                  <WeeklyTaskCard key={task.id} task={task} onToggle={() => {
                    updateTaskStatus(task.id, task.status === "DONE" ? "TODO" : "DONE");
                  }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unscheduled tasks */}
      {unscheduled.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-muted-foreground/30" />
            ללא תאריך יעד ({unscheduled.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {unscheduled.map(task => (
              <div key={task.id} className="bg-card rounded-lg border border-border/50 p-2.5 space-y-1">
                <p className="text-xs font-medium text-foreground leading-tight line-clamp-2">{task.title}</p>
                <div className="flex items-center justify-between">
                  <PriorityBadge priority={task.priority as Priority} />
                  {task.assignee_name && <span className="text-[10px] text-muted-foreground truncate max-w-[60px]">{task.assignee_name}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WeeklyTaskCard({ task, onToggle }: { task: Task; onToggle: () => void }) {
  const isDone = task.status === "DONE";
  const isUrgent = task.priority === "דחוף";

  return (
    <div className={cn(
      "rounded-lg px-2 py-1.5 text-[11px] cursor-pointer transition-all hover:shadow-sm border",
      isDone ? "bg-success/10 border-success/20 opacity-60" :
      isUrgent ? "bg-destructive/10 border-destructive/20" :
      "bg-card border-border/40"
    )} onClick={onToggle}>
      <p className={cn(
        "font-medium leading-tight line-clamp-2",
        isDone ? "line-through text-muted-foreground" : "text-foreground"
      )}>
        {task.title}
      </p>
      {task.assignee_name && !isDone && (
        <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">
          {task.assignee_name}
        </p>
      )}
    </div>
  );
}
