import { useState, useEffect, useMemo, useCallback } from "react";
import { format, startOfDay } from "date-fns";
import { he } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, Circle, ChevronDown, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Task, type Priority, type Profile, type TaskStatus } from "@/contexts/AppContext";
import { getOverdueTasksToAdvance } from "@/lib/advanceOverdueTasksUtils";
import { PriorityBadge } from "@/components/PriorityBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { toast } from "sonner";

const DISMISSAL_KEY = "overdue-panel-dismissed-date";

const PRIORITY_ORDER: Priority[] = ["דחוף", "גבוה", "בינוני", "נמוך"];

interface OverdueTasksPanelProps {
  tasks: Task[];
  profiles: Profile[];
  currentUser: { id: string; role: string; name: string } | null;
  onUpdate: (id: string, updates: Partial<Task>) => Promise<void>;
  onStatusChange: (id: string, status: TaskStatus) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export function OverdueTasksPanel({
  tasks,
  profiles,
  currentUser,
  onUpdate,
  onStatusChange,
  onDelete,
}: OverdueTasksPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  const overdueTasks = useMemo(() => getOverdueTasksToAdvance(tasks), [tasks]);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    overdueTasks.forEach(task => {
      const key = format(startOfDay(new Date(task.due_date!)), "yyyy-MM-dd");
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
    });
    // Sort each group by priority
    Object.values(groups).forEach(group => {
      group.sort((a, b) => PRIORITY_ORDER.indexOf(a.priority as Priority) - PRIORITY_ORDER.indexOf(b.priority as Priority));
    });
    // Sort groups oldest-first
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [overdueTasks]);

  // Auto-open on mount if not dismissed today and there are overdue tasks
  useEffect(() => {
    const todayKey = format(new Date(), "yyyy-MM-dd");
    const dismissedDate = localStorage.getItem(DISMISSAL_KEY);
    if (dismissedDate !== todayKey && overdueTasks.length > 0) {
      setIsOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — only auto-open on mount

  const handleDismiss = useCallback(() => {
    const todayKey = format(new Date(), "yyyy-MM-dd");
    localStorage.setItem(DISMISSAL_KEY, todayKey);
    setIsOpen(false);
  }, []);

  const handleMoveToToday = useCallback(async (taskId: string) => {
    const today = startOfDay(new Date());
    await onUpdate(taskId, { due_date: today.toISOString() });
  }, [onUpdate]);

  const handleMoveAllToToday = useCallback(async () => {
    const today = startOfDay(new Date());
    for (const task of overdueTasks) {
      await onUpdate(task.id, { due_date: today.toISOString() });
    }
    toast.success(`${overdueTasks.length} משימות הועברו להיום`);
    handleDismiss();
  }, [overdueTasks, onUpdate, handleDismiss]);

  const handleMarkDone = useCallback(async (taskId: string, currentStatus: string) => {
    const newStatus: TaskStatus = currentStatus === "DONE" ? "TODO" : "DONE";
    await onStatusChange(taskId, newStatus);
  }, [onStatusChange]);

  if (overdueTasks.length === 0) return null;

  return (
    <>
      <div dir="rtl" className="rounded-xl overflow-hidden border border-destructive/30 bg-destructive/5">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 text-sm font-semibold text-destructive hover:opacity-80 transition-opacity">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>משימות באיחור</span>
                <Badge variant="destructive" className="text-xs px-1.5 py-0 h-5">
                  {overdueTasks.length}
                </Badge>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    isOpen && "rotate-180"
                  )}
                />
              </button>
            </CollapsibleTrigger>

            <div className="flex items-center gap-2">
              {isOpen && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs"
                  onClick={handleMoveAllToToday}
                >
                  העבר הכל להיום
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={handleDismiss}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Expandable content */}
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-4">
              {groupedByDate.map(([dateKey, tasksInGroup]) => (
                <div key={dateKey}>
                  <p className="text-xs font-semibold text-destructive/70 mb-1.5">
                    {format(new Date(dateKey + "T12:00:00"), "EEEE, d בMMMM", { locale: he })}
                  </p>
                  <div className="space-y-1.5">
                    {tasksInGroup.map(task => (
                      <div
                        key={task.id}
                        className="flex items-center gap-2 p-2 rounded-lg bg-card border border-border/50"
                      >
                        {/* Done toggle */}
                        <button
                          className="shrink-0 hover:scale-110 transition-transform"
                          onClick={() => handleMarkDone(task.id, task.status)}
                          title={task.status === "DONE" ? "בטל סימון" : "סמן כבוצע"}
                        >
                          {task.status === "DONE" ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground/40 hover:text-primary" />
                          )}
                        </button>

                        {/* Title */}
                        <p
                          className={cn(
                            "flex-1 text-sm truncate",
                            task.status === "DONE" && "line-through text-muted-foreground"
                          )}
                        >
                          {task.title}
                        </p>

                        {/* Priority badge */}
                        <PriorityBadge priority={task.priority as Priority} />

                        {/* Assignee name */}
                        {task.assignee_name && (
                          <span className="text-xs text-muted-foreground hidden sm:inline shrink-0">
                            {task.assignee_name}
                          </span>
                        )}

                        {/* Move to today */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs px-2 shrink-0"
                          onClick={() => handleMoveToToday(task.id)}
                          disabled={task.status === "DONE"}
                          title="העבר להיום"
                        >
                          להיום
                        </Button>

                        {/* Open full edit dialog */}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 shrink-0"
                          onClick={() => setDetailTask(task)}
                          title="ערוך משימה"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Full edit dialog */}
      <TaskDetailDialog
        task={detailTask}
        onClose={() => setDetailTask(null)}
        profiles={profiles}
        currentUser={currentUser}
        onUpdate={onUpdate}
        onStatusChange={onStatusChange}
        onDelete={onDelete}
      />
    </>
  );
}
