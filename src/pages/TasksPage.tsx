import { useData } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { TaskStatusBadge } from "@/components/StatusBadge";
import type { TaskStatus, Task } from "@/data/mockData";

const columns: { status: TaskStatus; label: string; bgClass: string }[] = [
  { status: "TODO", label: "לביצוע", bgClass: "bg-[hsl(var(--todo))]" },
  { status: "IN_PROGRESS", label: "בביצוע", bgClass: "bg-[hsl(var(--in-progress))]" },
  { status: "DONE", label: "הושלם", bgClass: "bg-[hsl(var(--done))]" },
  { status: "BLOCKED", label: "חסום", bgClass: "bg-[hsl(var(--blocked))]" },
];

export default function TasksPage() {
  const { tasks, updateTaskStatus } = useData();

  const getColumnTasks = (status: TaskStatus): Task[] =>
    tasks.filter(t => t.status === status);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">משימות</h1>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {columns.map(col => {
          const colTasks = getColumnTasks(col.status);
          return (
            <div key={col.status} className="space-y-3">
              <div className={`${col.bgClass} rounded-lg px-4 py-2.5 flex items-center justify-between`}>
                <h3 className="font-semibold text-sm text-foreground">{col.label}</h3>
                <span className="text-xs bg-card px-2 py-0.5 rounded-full text-muted-foreground font-medium">
                  {colTasks.length}
                </span>
              </div>

              <div className="space-y-2 min-h-[200px]">
                {colTasks.map(task => (
                  <div
                    key={task.id}
                    className="bg-card rounded-lg border p-3 shadow-sm space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground leading-tight">{task.title}</p>
                      <PriorityBadge priority={task.priority} className="shrink-0" />
                    </div>
                    {task.assigneeName && (
                      <p className="text-xs text-muted-foreground">👤 {task.assigneeName}</p>
                    )}
                    {task.notes && (
                      <p className="text-xs text-muted-foreground truncate">💬 {task.notes}</p>
                    )}
                    {task.isDaily && (
                      <span className="inline-block text-xs bg-warning/15 text-warning px-2 py-0.5 rounded-full">
                        יומית
                      </span>
                    )}

                    {/* Quick status change */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {columns
                        .filter(c => c.status !== task.status)
                        .map(c => (
                          <button
                            key={c.status}
                            onClick={() => updateTaskStatus(task.id, c.status)}
                            className="text-[10px] px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                          >
                            {c.label}
                          </button>
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
