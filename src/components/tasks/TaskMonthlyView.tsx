import { useMemo, useState, useCallback } from "react";
import { useData, useAuth, type Task, type Priority } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths, startOfDay, isSameDay } from "date-fns";
import { he } from "date-fns/locale";
import { ChevronRight, ChevronLeft, Calendar, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const monthNames = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

export default function TaskMonthlyView() {
  const { tasks, updateTaskStatus, profiles } = useData();
  const { currentUser } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState("all");

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Fill in previous month's days to complete the grid
  const firstDayOfWeek = monthStart.getDay();
  const previousMonthEnd = new Date(monthStart);
  previousMonthEnd.setDate(0);
  const previousMonthDays = Array.from({ length: firstDayOfWeek }, (_, i) =>
    new Date(previousMonthEnd.getFullYear(), previousMonthEnd.getMonth(), previousMonthEnd.getDate() - (firstDayOfWeek - i - 1))
  );

  const calendarDays = [...previousMonthDays, ...daysInMonth];

  const assignableUsers = profiles.filter(u => u.role !== "MANAGER" || u.id === currentUser?.id);

  const filteredTasks = useMemo(() =>
    tasks.filter(t => assigneeFilter === "all" || t.assignee_id === assigneeFilter),
    [tasks, assigneeFilter]
  );

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    calendarDays.forEach(day => {
      const key = format(startOfDay(day), "yyyy-MM-dd");
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
  }, [filteredTasks, calendarDays]);

  const selectedDayKey = selectedDay ? format(selectedDay, "yyyy-MM-dd") : null;
  const selectedDayTasks = selectedDayKey ? tasksByDay.get(selectedDayKey) || [] : [];

  const handleToggle = useCallback(async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === "DONE" ? "TODO" : "DONE";
    await updateTaskStatus(taskId, newStatus);
  }, [updateTaskStatus]);

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">תצוגה חודשית</h1>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground border rounded-lg px-3 py-1.5 bg-muted/30">
            <Calendar className="h-4 w-4" />
            <span>{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(d => subMonths(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())} className="text-xs">
            היום
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(d => addMonths(d, 1))}>
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
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        {/* Day names header */}
        <div className="grid grid-cols-7 bg-muted/30 border-b border-border/30" style={{ direction: 'rtl' }}>
          {dayNames.map(day => (
            <div key={day} className="p-3 text-center text-xs font-semibold text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7" style={{ direction: 'rtl' }}>
          {calendarDays.map((day, idx) => {
            const key = format(startOfDay(day), "yyyy-MM-dd");
            const dayTasks = tasksByDay.get(key) || [];
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isTodayDate = isToday(day);
            const doneTasks = dayTasks.filter(t => t.status === "DONE").length;

            return (
              <div
                key={idx}
                className={cn(
                  "min-h-[140px] border-b border-r border-border/30 p-2 cursor-pointer transition-colors",
                  !isCurrentMonth && "bg-muted/20",
                  isTodayDate && "bg-primary/5",
                  selectedDay && isSameDay(day, selectedDay) && "bg-primary/10 border-primary/40"
                )}
                onClick={() => setSelectedDay(day)}
              >
                <div className={cn(
                  "text-sm font-semibold mb-1.5",
                  isCurrentMonth ? "text-foreground" : "text-muted-foreground/50",
                  isTodayDate && "text-primary"
                )}>
                  {format(day, "d")}
                </div>

                <div className="space-y-0.5 overflow-hidden">
                  {dayTasks.length > 0 && (
                    <div className="text-[10px] text-muted-foreground/60 mb-1">
                      {doneTasks}/{dayTasks.length}
                    </div>
                  )}
                  {dayTasks.slice(0, 2).map(task => (
                    <div
                      key={task.id}
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded border truncate",
                        task.status === "DONE"
                          ? "bg-success/10 border-success/20 text-muted-foreground/60 line-through"
                          : task.priority === "דחוף"
                          ? "bg-destructive/10 border-destructive/20 text-destructive/80"
                          : "bg-primary/10 border-primary/20 text-primary/80"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDay(day);
                      }}
                    >
                      {task.title}
                    </div>
                  ))}
                  {dayTasks.length > 2 && (
                    <div className="text-[9px] text-muted-foreground/50 px-1.5 py-0.5">
                      +{dayTasks.length - 2} עוד
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day Detail Modal */}
      <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedDay ? format(selectedDay, "EEEE, d MMMM yyyy", { locale: he }) : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {selectedDayTasks.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">אין משימות ביום זה</p>
              </div>
            ) : (
              selectedDayTasks.map(task => (
                <div
                  key={task.id}
                  className={cn(
                    "p-3 rounded-lg border transition-all cursor-pointer hover:shadow-sm",
                    task.status === "DONE"
                      ? "bg-success/10 border-success/20"
                      : task.priority === "דחוף"
                      ? "bg-destructive/10 border-destructive/20"
                      : "bg-card border-border/50"
                  )}
                  onClick={() => handleToggle(task.id, task.status)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium",
                        task.status === "DONE" && "line-through text-muted-foreground"
                      )}>
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="text-xs text-muted-foreground/60 mt-0.5 line-clamp-2">
                          {task.description}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0">
                      <PriorityBadge priority={task.priority as Priority} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
