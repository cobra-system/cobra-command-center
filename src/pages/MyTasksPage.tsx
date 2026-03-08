import { useAuth, useData } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { CheckCircle2, Circle } from "lucide-react";

export default function MyTasksPage() {
  const { currentUser } = useAuth();
  const { tasks, updateTaskStatus } = useData();
  const navigate = useNavigate();

  const myTasks = tasks.filter(t => t.assigneeId === currentUser?.id);
  const done = myTasks.filter(t => t.status === "DONE");
  const notDone = myTasks.filter(t => t.status !== "DONE");
  const pct = myTasks.length > 0 ? Math.round((done.length / myTasks.length) * 100) : 0;

  const now = new Date();
  const dayNames = ["יום ראשון", "יום שני", "יום שלישי", "יום רביעי", "יום חמישי", "יום שישי", "שבת"];
  const dayName = dayNames[now.getDay()];
  const dateStr = now.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });

  const p0Tasks = notDone.filter(t => t.priority === "P0");
  const otherTasks = notDone.filter(t => t.priority !== "P0");

  const donutData = [
    { name: "done", value: done.length },
    { name: "remaining", value: notDone.length },
  ];

  return (
    <div className="pb-6">
      {/* Date header */}
      <div className="bg-[hsl(var(--employee-header))] text-[hsl(var(--employee-header-foreground))] px-5 py-5">
        <p className="text-2xl font-bold">{dayName}</p>
        <p className="text-sm opacity-70">{dateStr}</p>
      </div>

      {/* Donut chart */}
      <div className="flex flex-col items-center py-6">
        <div className="relative w-36 h-36">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutData}
                innerRadius={50}
                outerRadius={65}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
                strokeWidth={0}
              >
                <Cell fill="hsl(142 71% 35%)" />
                <Cell fill="hsl(var(--border))" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-foreground">{pct}%</span>
            <span className="text-xs text-muted-foreground">התקדמות</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2">{done.length} מתוך {myTasks.length} משימות</p>
      </div>

      {/* Tasks sections */}
      <div className="px-4 space-y-4">
        {p0Tasks.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-foreground mb-2">⚡ דחוף (P0)</h3>
            <div className="space-y-2">
              {p0Tasks.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onToggle={() => updateTaskStatus(task.id, "DONE")}
                  onTap={() => navigate(`/my-tasks/${task.id}`)}
                />
              ))}
            </div>
          </div>
        )}

        {otherTasks.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-foreground mb-2">📋 משימות</h3>
            <div className="space-y-2">
              {otherTasks.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onToggle={() => updateTaskStatus(task.id, "DONE")}
                  onTap={() => navigate(`/my-tasks/${task.id}`)}
                />
              ))}
            </div>
          </div>
        )}

        {done.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-foreground mb-2">✅ הושלם</h3>
            <div className="space-y-2">
              {done.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  completed
                  onToggle={() => updateTaskStatus(task.id, "TODO")}
                  onTap={() => navigate(`/my-tasks/${task.id}`)}
                />
              ))}
            </div>
          </div>
        )}

        {myTasks.length === 0 && (
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground">אין משימות כרגע 🎉</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface TaskRowProps {
  task: { id: string; title: string; priority: string; notes?: string };
  completed?: boolean;
  onToggle: () => void;
  onTap: () => void;
}

function TaskRow({ task, completed, onToggle, onTap }: TaskRowProps) {
  return (
    <div className="bg-card rounded-xl border p-4 flex items-center gap-3 active:bg-muted/50 transition-colors">
      <button onClick={onToggle} className="shrink-0">
        {completed ? (
          <CheckCircle2 className="h-6 w-6 text-success animate-check-mark" />
        ) : (
          <Circle className="h-6 w-6 text-muted-foreground" />
        )}
      </button>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onTap}>
        <p className={`text-sm font-medium ${completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
          {task.title}
        </p>
      </div>
      {task.priority === "P0" && !completed && <PriorityBadge priority="P0" />}
    </div>
  );
}
