import { useMemo, useState, useCallback, useEffect } from "react";
import { useData, useAuth, type Task, type Priority } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { type RecurringTask, recurringMatchesDay, findOrCreateRecurringInstance } from "@/lib/recurringUtils";
import { supabase } from "@/lib/supabase";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths, startOfDay, isSameDay, getDay } from "date-fns";
import { he } from "date-fns/locale";
import { ChevronRight, ChevronLeft, Calendar, Users, Settings, Plus, Repeat, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import RecurringTasksPanel from "@/components/tasks/RecurringTasksPanel";
import WorkflowsPanel from "@/components/tasks/WorkflowsPanel";
import TaskCreateDialog from "@/components/tasks/TaskCreateDialog";

const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי"];
const monthNames = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

export default function TaskMonthlyView() {
  const { tasks, updateTaskStatus, updateTask, profiles, refreshTasks } = useData();
  const { currentUser } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("recurring");
  const [taskCreateOpen, setTaskCreateOpen] = useState(false);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [recurringTasks, setRecurringTasks] = useState<RecurringTask[]>([]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Fill in previous month's days to complete the 6-column (Sun–Fri) grid
  const firstDayOfWeek = monthStart.getDay();
  // If month starts on Saturday (6), no leading blanks since Saturday is hidden
  const leadingBlanks = firstDayOfWeek === 6 ? 0 : firstDayOfWeek;
  const previousMonthEnd = new Date(monthStart);
  previousMonthEnd.setDate(0);
  const previousMonthDays = Array.from({ length: leadingBlanks }, (_, i) =>
    new Date(previousMonthEnd.getFullYear(), previousMonthEnd.getMonth(), previousMonthEnd.getDate() - (leadingBlanks - i - 1))
  );

  // Filter out Saturdays from the calendar days
  const calendarDays = [...previousMonthDays, ...daysInMonth].filter(d => getDay(d) !== 6);

  const assignableUsers = profiles.filter(u => u.role !== "MANAGER" || u.id === currentUser?.id);

  const loadRecurring = useCallback(async () => {
    const { data } = await supabase.from("recurring_tasks").select("*").eq("is_active", true);
    if (data) setRecurringTasks(data as RecurringTask[]);
  }, []);

  useEffect(() => {
    loadRecurring();
  }, [loadRecurring]);

  const filteredTasks = useMemo(() =>
    tasks.filter(t => assigneeFilter === "all" || t.assignee_id === assigneeFilter),
    [tasks, assigneeFilter]
  );

  const filteredRecurring = useMemo(() =>
    recurringTasks.filter(rt => assigneeFilter === "all" || rt.assignee_id === assigneeFilter),
    [recurringTasks, assigneeFilter]
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

  const recurringByDay = useMemo(() => {
    const map = new Map<string, RecurringTask[]>();
    calendarDays.forEach(day => {
      const key = format(startOfDay(day), "yyyy-MM-dd");
      map.set(key, filteredRecurring.filter(rt => recurringMatchesDay(rt, day)));
    });
    return map;
  }, [filteredRecurring, calendarDays]);

  const selectedDayKey = selectedDay ? format(selectedDay, "yyyy-MM-dd") : null;
  const selectedDayTasks = selectedDayKey ? tasksByDay.get(selectedDayKey) || [] : [];
  const selectedDayRecurring = selectedDayKey ? recurringByDay.get(selectedDayKey) || [] : [];

  const handleRecurringClick = useCallback(async (rt: RecurringTask, day: Date) => {
    const task = await findOrCreateRecurringInstance(rt, day);
    if (task) {
      await refreshTasks();
      setSelectedTask(task);
    }
  }, [refreshTasks]);

  const handleToggle = useCallback(async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === "DONE" ? "TODO" : "DONE";
    await updateTaskStatus(taskId, newStatus);
  }, [updateTaskStatus]);

  const handleDrop = useCallback(async (day: Date) => {
    if (!dragTaskId) return;
    await updateTask(dragTaskId, { due_date: day.toISOString() });
    setDragTaskId(null);
    setDragOverDay(null);
  }, [dragTaskId, updateTask]);

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

          <div className="flex items-center gap-1.5 ms-4">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setSettingsOpen(true)}>
              <Settings className="h-4 w-4" />
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => setTaskCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              צור
            </Button>
          </div>

          <div className="flex items-center gap-1.5 ms-4">
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
        <div className="grid grid-cols-6 bg-muted/30 border-b border-border/30" style={{ direction: 'rtl' }}>
          {dayNames.map(day => (
            <div key={day} className="p-3 text-center text-xs font-semibold text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-6" style={{ direction: 'rtl' }}>
          {calendarDays.map((day, idx) => {
            const key = format(startOfDay(day), "yyyy-MM-dd");
            const dayTasks = tasksByDay.get(key) || [];
            const dayRecurring = recurringByDay.get(key) || [];
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isTodayDate = isToday(day);
            const doneTasks = dayTasks.filter(t => t.status === "DONE").length;
            const isDropTarget = dragOverDay === key;
            const totalVisible = dayTasks.length + dayRecurring.length;
            const regularSlots = Math.min(dayTasks.length, 2);
            const recurringSlots = Math.min(dayRecurring.length, Math.max(0, 2 - regularSlots));
            const overflow = totalVisible - regularSlots - recurringSlots;

            return (
              <div
                key={idx}
                className={cn(
                  "min-h-[140px] border-b border-r border-border/30 p-2 cursor-pointer transition-all",
                  !isCurrentMonth && "bg-muted/20",
                  isTodayDate && "bg-primary/5",
                  selectedDay && isSameDay(day, selectedDay) && "bg-primary/10 border-primary/40",
                  isDropTarget && "ring-2 ring-primary/60 bg-primary/10 border-primary/40"
                )}
                onClick={() => setSelectedDay(day)}
                onDragOver={(e) => { e.preventDefault(); setDragOverDay(key); }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverDay(null);
                }}
                onDrop={() => handleDrop(day)}
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
                  {dayTasks.slice(0, regularSlots).map(task => (
                    <div
                      key={task.id}
                      draggable
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded border truncate cursor-grab active:cursor-grabbing transition-opacity",
                        task.status === "DONE"
                          ? "bg-success/10 border-success/20 text-muted-foreground/60 line-through"
                          : task.priority === "דחוף"
                          ? "bg-destructive/10 border-destructive/20 text-destructive/80"
                          : "bg-primary/10 border-primary/20 text-primary/80",
                        dragTaskId === task.id && "opacity-40"
                      )}
                      onDragStart={(e) => {
                        e.stopPropagation();
                        setDragTaskId(task.id);
                      }}
                      onDragEnd={(e) => {
                        e.stopPropagation();
                        setDragTaskId(null);
                        setDragOverDay(null);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDay(day);
                      }}
                    >
                      {task.title}
                    </div>
                  ))}
                  {dayRecurring.slice(0, recurringSlots).map(rt => (
                    <div
                      key={`r-${rt.id}`}
                      className="text-[10px] px-1.5 py-0.5 rounded border truncate cursor-pointer transition-colors bg-violet-500/10 border-violet-500/30 text-violet-700 dark:text-violet-300 hover:bg-violet-500/20 flex items-center gap-0.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRecurringClick(rt, day);
                      }}
                    >
                      <span className="shrink-0">↻</span>
                      <span className="truncate">{rt.title}</span>
                    </div>
                  ))}
                  {overflow > 0 && (
                    <div className="text-[9px] text-muted-foreground/50 px-1.5 py-0.5">
                      +{overflow} עוד
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
            {selectedDayTasks.length === 0 && selectedDayRecurring.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">אין משימות ביום זה</p>
              </div>
            ) : (
              <>
              {selectedDayRecurring.map(rt => (
                <div
                  key={`r-${rt.id}`}
                  className="p-3 rounded-lg border border-violet-500/30 bg-violet-500/10 transition-all cursor-pointer hover:bg-violet-500/20"
                  onClick={() => selectedDay && handleRecurringClick(rt, selectedDay)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <Repeat className="h-4 w-4 text-violet-400 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-violet-900 dark:text-violet-200">{rt.title}</p>
                        {rt.description && (
                          <p className="text-xs text-muted-foreground/60 mt-0.5 line-clamp-2">{rt.description}</p>
                        )}
                        {rt.assignee_name && (
                          <p className="text-xs text-muted-foreground/50 mt-0.5">{rt.assignee_name}</p>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">
                      <PriorityBadge priority={rt.priority as Priority} />
                    </div>
                  </div>
                </div>
              ))}
              {selectedDayTasks.map(task => (
                <div
                  key={task.id}
                  draggable
                  className={cn(
                    "p-3 rounded-lg border transition-all cursor-grab active:cursor-grabbing hover:shadow-sm",
                    task.status === "DONE"
                      ? "bg-success/10 border-success/20"
                      : task.priority === "דחוף"
                      ? "bg-destructive/10 border-destructive/20"
                      : "bg-card border-border/50",
                    dragTaskId === task.id && "opacity-40"
                  )}
                  onDragStart={() => setDragTaskId(task.id)}
                  onDragEnd={() => { setDragTaskId(null); setDragOverDay(null); }}
                  onClick={() => setSelectedTask(task)}
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
              ))}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        profiles={profiles}
        currentUser={currentUser}
        onUpdate={updateTask}
        onStatusChange={updateTaskStatus}
      />

      {/* Settings popup */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-[92vw] w-full max-h-[85vh] overflow-y-auto">
          <DialogHeader className="mb-4">
            <DialogTitle>ניהול חוזרות ותהליכים</DialogTitle>
          </DialogHeader>
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
        </DialogContent>
      </Dialog>

      {/* Task create dialog */}
      <TaskCreateDialog
        open={taskCreateOpen}
        onOpenChange={setTaskCreateOpen}
      />
    </div>
  );
}
