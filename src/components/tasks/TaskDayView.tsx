import { useMemo, useState, useCallback, useEffect } from "react";
import { useData, useAuth, type Task, type Priority } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { type RecurringTask, recurringMatchesDay, findOrCreateRecurringInstance } from "@/lib/recurringUtils";
import { supabase } from "@/lib/supabase";
import { format, addDays, subDays, isToday, isSameDay, startOfDay } from "date-fns";
import { he } from "date-fns/locale";
import { ChevronRight, ChevronLeft, Calendar, Users, CheckCircle2, Circle, Flame, Settings, Plus, Repeat, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import confetti from "canvas-confetti";
import RecurringTasksPanel from "@/components/tasks/RecurringTasksPanel";
import WorkflowsPanel from "@/components/tasks/WorkflowsPanel";
import TaskCreateDialog from "@/components/tasks/TaskCreateDialog";

const dayNames = ["יום ראשון", "יום שני", "יום שלישי", "יום רביעי", "יום חמישי", "יום שישי", "שבת"];

export default function TaskDayView() {
  const { tasks, updateTaskStatus, updateTask, profiles, refreshTasks } = useData();
  const { currentUser } = useAuth();
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("recurring");
  const [taskCreateOpen, setTaskCreateOpen] = useState(false);
  const [recurringTasks, setRecurringTasks] = useState<RecurringTask[]>([]);

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

  const recurringForDay = useMemo(() => {
    const filtered = recurringTasks.filter(rt =>
      (assigneeFilter === "all" || rt.assignee_id === assigneeFilter) &&
      recurringMatchesDay(rt, selectedDay)
    );
    return filtered;
  }, [recurringTasks, selectedDay, assigneeFilter]);

  const handleRecurringClick = useCallback(async (rt: RecurringTask) => {
    const task = await findOrCreateRecurringInstance(rt, selectedDay);
    if (task) {
      await refreshTasks();
      setSelectedTask(task);
      setEditTitle(task.title);
      setEditDescription(task.description || "");
      setEditing(false);
    }
  }, [selectedDay, refreshTasks]);

  const dayTasks = useMemo(() => {
    const dayStart = startOfDay(selectedDay);
    const dayFiltered = filteredTasks.filter(t => {
      if (!t.due_date) return false;
      return isSameDay(new Date(t.due_date), dayStart);
    });
    dayFiltered.sort((a, b) => {
      const pOrder: Record<string, number> = { "דחוף": 0, "גבוה": 1, "בינוני": 2, "נמוך": 3 };
      return (pOrder[a.priority] ?? 2) - (pOrder[b.priority] ?? 2);
    });
    return dayFiltered;
  }, [filteredTasks, selectedDay]);

  const done = dayTasks.filter(t => t.status === "DONE").length;
  const total = dayTasks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Confetti on 100%
  useEffect(() => {
    if (pct === 100 && total > 0 && done > 0) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6, x: 0.5 },
        colors: ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"],
      });
    }
  }, [pct, total, done]);

  const handleToggle = useCallback(async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === "DONE" ? "TODO" : "DONE";
    if (newStatus === "DONE") {
      confetti({
        particleCount: 25,
        spread: 45,
        startVelocity: 20,
        origin: { y: 0.7, x: 0.2 },
        colors: ["#22c55e", "#16a34a"],
        gravity: 1.2,
      });
    }
    await updateTaskStatus(taskId, newStatus);
  }, [updateTaskStatus]);

  const handleSaveTask = async () => {
    if (!selectedTask) return;
    await updateTask(selectedTask.id, {
      title: editTitle.trim(),
      description: editDescription.trim() || null,
    });
    setSelectedTask({ ...selectedTask, title: editTitle, description: editDescription });
    setEditing(false);
  };

  const handleSelectTask = (task: Task) => {
    setSelectedTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description || "");
    setEditing(false);
  };

  // SVG progress ring
  const circumference = 283;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">תצוגת יום</h1>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setSelectedDay(d => subDays(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSelectedDay(new Date())} className="text-xs">
            היום
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setSelectedDay(d => addDays(d, 1))}>
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
          <Button size="sm" className="gap-1.5" onClick={() => setTaskCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            צור
          </Button>
        </div>
      </div>

      {/* Main content - two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Progress and day info */}
        <div className="lg:col-span-1">
          <div className="bg-gradient-to-b from-primary/10 to-transparent rounded-xl border border-primary/20 p-6 flex flex-col items-center">
            <div className="text-center mb-4">
              <p className="text-lg font-bold text-foreground">{dayNames[selectedDay.getDay()]}</p>
              <p className="text-3xl font-black text-primary mt-1">{format(selectedDay, "d")}</p>
              <p className="text-sm text-muted-foreground mt-1">{format(selectedDay, "MMMM yyyy", { locale: he })}</p>
            </div>

            {total > 0 && (
              <>
                <div className="relative w-32 h-32 mb-4">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--border))" strokeWidth="6" strokeLinecap="round" />
                    <circle
                      cx="50" cy="50" r="45" fill="none"
                      stroke={pct === 100 ? "hsl(var(--success))" : "hsl(var(--primary))"}
                      strokeWidth="6" strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={offset}
                      className="transition-all duration-700 ease-out"
                      style={{ filter: pct === 100 ? "drop-shadow(0 0 6px hsl(var(--success) / 0.5))" : undefined }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-3xl font-black text-foreground">{pct}%</span>
                  </div>
                </div>

                {done > 0 && (
                  <div className="flex items-center gap-1.5 bg-gradient-to-r from-warning/12 to-warning/5 px-3 py-1.5 rounded-full mb-3 animate-streak-bounce">
                    <Flame className="h-4 w-4 text-warning" />
                    <span className="text-xs font-bold text-warning">{done} הושלמו</span>
                  </div>
                )}

                <p className="text-sm font-medium text-muted-foreground">{done} מתוך {total} משימות</p>
              </>
            )}

            {total === 0 && recurringForDay.length === 0 && (
              <div className="text-center py-6">
                <p className="text-2xl mb-2">🎉</p>
                <p className="text-sm font-medium text-muted-foreground">אין משימות ביום זה</p>
              </div>
            )}
            {total === 0 && recurringForDay.length > 0 && (
              <div className="text-center py-3">
                <p className="text-sm font-medium text-violet-600 dark:text-violet-400">{recurringForDay.length} משימות חוזרות</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Task list */}
        <div className="lg:col-span-2">
          <div className="bg-card rounded-xl border border-border/50 overflow-hidden flex flex-col h-full">
            <div className="px-5 py-4 border-b border-border/30 bg-muted/20">
              <h2 className="font-semibold text-foreground">משימות ({dayTasks.length + recurringForDay.length})</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {dayTasks.length === 0 && recurringForDay.length === 0 ? (
                <div className="flex items-center justify-center h-full text-center py-12">
                  <p className="text-sm text-muted-foreground">אין משימות ביום זה</p>
                </div>
              ) : (
                <>
                  {dayTasks.map(task => (
                    <div
                      key={task.id}
                      className={cn(
                        "p-3 rounded-lg border transition-all cursor-pointer hover:shadow-sm flex items-center gap-3",
                        task.status === "DONE"
                          ? "bg-success/10 border-success/20"
                          : task.priority === "דחוף"
                          ? "bg-destructive/10 border-destructive/20"
                          : "bg-card border-border/50"
                      )}
                      onClick={() => handleSelectTask(task)}
                      onDoubleClick={() => handleToggle(task.id, task.status)}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggle(task.id, task.status);
                        }}
                        className="shrink-0"
                      >
                        {task.status === "DONE" ? (
                          <CheckCircle2 className="h-5 w-5 text-success" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground/30 hover:text-primary transition-colors" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-medium",
                          task.status === "DONE" && "line-through text-muted-foreground"
                        )}>
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-xs text-muted-foreground/60 mt-0.5 line-clamp-1">
                            {task.description}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0">
                        <PriorityBadge priority={task.priority as Priority} />
                      </div>
                    </div>
                  ))}
                  {recurringForDay.map(rt => (
                    <div
                      key={`r-${rt.id}`}
                      className="p-3 rounded-lg border border-violet-500/30 bg-violet-500/10 transition-all cursor-pointer hover:bg-violet-500/20 flex items-center gap-3"
                      onClick={() => handleRecurringClick(rt)}
                    >
                      <Repeat className="h-5 w-5 text-violet-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-violet-900 dark:text-violet-200">{rt.title}</p>
                        {rt.description && (
                          <p className="text-xs text-muted-foreground/60 mt-0.5 line-clamp-1">{rt.description}</p>
                        )}
                        {rt.assignee_name && (
                          <p className="text-xs text-muted-foreground/50 mt-0.5">{rt.assignee_name}</p>
                        )}
                      </div>
                      <div className="shrink-0">
                        <PriorityBadge priority={rt.priority as Priority} />
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Task Detail Modal */}
      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent className="sm:max-w-md">
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

          {selectedTask && (
            editing ? (
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <Label className="text-xs">כותרת</Label>
                  <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">תיאור</Label>
                  <Textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={3} />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveTask} className="flex-1">שמור</Button>
                  <Button variant="outline" onClick={() => setEditing(false)} className="flex-1">ביטול</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{selectedTask.title}</h3>
                  {selectedTask.description && (
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{selectedTask.description}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">עדיפות</p>
                    <PriorityBadge priority={selectedTask.priority as Priority} />
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">סטטוס</p>
                    <p className="text-sm font-medium text-foreground">
                      {selectedTask.status === "DONE" ? "הושלם" : "לביצוע"}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">משויך ל</p>
                    <p className="text-sm font-medium text-foreground">{selectedTask.assignee_name || "לא משויך"}</p>
                  </div>
                </div>

                {selectedTask.notes && (
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">הערות</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{selectedTask.notes}</p>
                  </div>
                )}

                <Button
                  onClick={() => handleToggle(selectedTask.id, selectedTask.status)}
                  className="w-full"
                  variant={selectedTask.status === "DONE" ? "outline" : "default"}
                >
                  {selectedTask.status === "DONE" ? "סמן כלא הושלם" : "סמן כהושלם"}
                </Button>
              </div>
            )
          )}
        </DialogContent>
      </Dialog>

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
