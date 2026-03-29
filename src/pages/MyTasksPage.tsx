import { useAuth, useData, type Priority } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Circle, Flame, Trophy, Star, ChevronLeft, Plus } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import confetti from "canvas-confetti";
import EmployeeTaskCreateDialog from "@/components/tasks/EmployeeTaskCreateDialog";

const motivationalMessages = [
  "בוא נסגור את היום! 💪",
  "אתה על גל! 🌊",
  "קדימה, עוד קצת! 🚀",
  "מצוין! תמשיך ככה! ⭐",
  "אלוף! 🏆",
];

const completionMessages = [
  "כל הכבוד! סיימת הכל! 🎉",
  "אלוף/ה! 100% היום! 🏆",
  "מושלם! אפס משימות פתוחות! ✨",
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "בוקר טוב";
  if (hour < 17) return "צהריים טובים";
  return "ערב טוב";
}

function getMotivation(pct: number, total: number): string {
  if (total === 0) return "אין משימות כרגע 🎉";
  if (pct === 100) return completionMessages[Math.floor(Math.random() * completionMessages.length)];
  if (pct >= 75) return "כמעט שם! סיום קרוב 🔥";
  if (pct >= 50) return "חצי דרך! תמשיך ככה 💪";
  if (pct >= 25) return "התחלה טובה! קדימה 🚀";
  return motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
}

export default function MyTasksPage() {
  const { currentUser } = useAuth();
  const { tasks, updateTaskStatus } = useData();
  const navigate = useNavigate();
  const [justCompleted, setJustCompleted] = useState<string | null>(null);
  const prevPctRef = useRef(0);

  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Helper: check if a date string is today
  const isToday = (dateStr?: string | null) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  };

  const allMyTasks = tasks.filter(t => t.assignee_id === currentUser?.id);
  // Filter out tasks completed on previous days - only show today's completions
  const myTasks = allMyTasks.filter(t => {
    if (t.status === "DONE") {
      return isToday(t.completed_at);
    }
    return true;
  });
  const done = myTasks.filter(t => t.status === "DONE");
  const blocked = myTasks.filter(t => t.status === "BLOCKED");
  const todo = myTasks.filter(t => t.status !== "DONE" && t.status !== "BLOCKED");
  const notDone = myTasks.filter(t => t.status !== "DONE");
  const pct = myTasks.length > 0 ? Math.round((done.length / myTasks.length) * 100) : 0;

  const now = new Date();
  const dayNames = ["יום ראשון", "יום שני", "יום שלישי", "יום רביעי", "יום חמישי", "יום שישי", "שבת"];
  const dayName = dayNames[now.getDay()];

  const p0Tasks = todo.filter(t => t.priority === "דחוף");
  const otherTasks = todo.filter(t => t.priority !== "דחוף");

  // Confetti on 100%
  useEffect(() => {
    if (pct === 100 && prevPctRef.current < 100 && myTasks.length > 0) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6, x: 0.5 },
        colors: ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"],
      });
    }
    prevPctRef.current = pct;
  }, [pct, myTasks.length]);

  const handleToggle = useCallback(async (taskId: string, newStatus: "DONE" | "TODO") => {
    if (newStatus === "DONE") {
      setJustCompleted(taskId);
      setTimeout(() => setJustCompleted(null), 600);
      // Small confetti burst on individual completion
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

  // SVG progress ring
  const circumference = 283; // 2 * PI * 45
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="pb-8">
      {/* Hero section with greeting + progress */}
      <div className="bg-gradient-to-b from-[hsl(var(--employee-header)_/_0.06)] to-transparent px-5 pt-6 pb-2">
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-lg font-bold text-foreground">{getGreeting()}, {currentUser?.name?.split(" ")[0]} 👋</p>
            <p className="text-sm text-muted-foreground mt-0.5">{dayName}</p>
          </div>
          <div className="flex items-center gap-2">
            {done.length > 0 && (
              <div className="flex items-center gap-1.5 bg-gradient-to-r from-[hsl(var(--warning)_/_0.12)] to-[hsl(var(--warning)_/_0.05)] px-3 py-1.5 rounded-full animate-streak-bounce">
                <Flame className="h-4 w-4 text-warning" />
                <span className="text-xs font-bold text-warning">{done.length}</span>
              </div>
            )}
            <button
              onClick={() => setShowCreateDialog(true)}
              className="flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-full transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span className="text-xs font-bold">משימה</span>
            </button>
          </div>
        </div>

        {/* Progress ring */}
        <div className="flex flex-col items-center">
          <div className="relative w-40 h-40 mb-3">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              {/* Background track */}
              <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--border))" strokeWidth="6" strokeLinecap="round" />
              {/* Progress arc */}
              <circle
                cx="50" cy="50" r="45" fill="none"
                stroke={pct === 100 ? "hsl(var(--success))" : "hsl(var(--employee-header))"}
                strokeWidth="6" strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className="transition-all duration-700 ease-out"
                style={{ filter: pct === 100 ? "drop-shadow(0 0 6px hsl(var(--success) / 0.5))" : undefined }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {pct === 100 ? (
                <Trophy className="h-8 w-8 text-success animate-float" />
              ) : (
                <>
                  <span className="text-4xl font-black text-foreground tabular-nums">{pct}%</span>
                </>
              )}
            </div>
          </div>
          <p className="text-sm font-medium text-muted-foreground">{done.length} מתוך {myTasks.length} משימות</p>
          <p className="text-xs text-muted-foreground/70 mt-1">{getMotivation(pct, myTasks.length)}</p>
        </div>
      </div>

      {/* Task lists */}
      <div className="px-4 mt-4 space-y-5">
        {/* Urgent P0 */}
        {p0Tasks.length > 0 && (
          <div className="animate-task-appear">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="h-5 w-1 rounded-full bg-destructive" />
              <h3 className="text-sm font-bold text-foreground">דחוף</h3>
              <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-medium">{p0Tasks.length}</span>
            </div>
            <div className="space-y-2">
              {p0Tasks.map((task, i) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  index={i}
                  isJustCompleted={justCompleted === task.id}
                  onToggle={() => handleToggle(task.id, "DONE")}
                  onTap={() => navigate(`/my-tasks/${task.id}`)}
                  urgent
                />
              ))}
            </div>
          </div>
        )}

        {/* Regular tasks */}
        {otherTasks.length > 0 && (
          <div className="animate-task-appear" style={{ animationDelay: "0.1s" }}>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="h-5 w-1 rounded-full bg-primary" />
              <h3 className="text-sm font-bold text-foreground">משימות</h3>
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{otherTasks.length}</span>
            </div>
            <div className="space-y-2">
              {otherTasks.map((task, i) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  index={i}
                  isJustCompleted={justCompleted === task.id}
                  onToggle={() => handleToggle(task.id, "DONE")}
                  onTap={() => navigate(`/my-tasks/${task.id}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Blocked */}
        {blocked.length > 0 && (
          <div className="animate-task-appear" style={{ animationDelay: "0.15s" }}>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="h-5 w-1 rounded-full bg-destructive/50" />
              <h3 className="text-sm font-bold text-muted-foreground">חסום</h3>
            </div>
            <div className="space-y-2">
              {blocked.map((task, i) => (
                <TaskRow key={task.id} task={task} index={i} blocked onToggle={() => handleToggle(task.id, "TODO")} onTap={() => navigate(`/my-tasks/${task.id}`)} />
              ))}
            </div>
          </div>
        )}

        {/* Completed */}
        {done.length > 0 && (
          <div className="animate-task-appear" style={{ animationDelay: "0.2s" }}>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="h-5 w-1 rounded-full bg-success" />
              <h3 className="text-sm font-bold text-muted-foreground">הושלם</h3>
              <Star className="h-3.5 w-3.5 text-success" />
            </div>
            <div className="space-y-2">
              {done.map((task, i) => (
                <TaskRow key={task.id} task={task} index={i} completed onToggle={() => handleToggle(task.id, "TODO")} onTap={() => navigate(`/my-tasks/${task.id}`)} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {myTasks.length === 0 && (
          <div className="text-center py-16 animate-task-appear">
            <div className="text-5xl mb-4">🎉</div>
            <p className="text-lg font-bold text-foreground">אין משימות כרגע</p>
            <p className="text-sm text-muted-foreground mt-1">נהדר! תהנה מהיום</p>
            <button
              onClick={() => setShowCreateDialog(true)}
              className="mt-4 inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              צור משימה חדשה
            </button>
          </div>
        )}
      </div>

      <EmployeeTaskCreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </div>
  );
}

interface TaskRowProps {
  task: { id: string; title: string; priority: string; notes?: string | null; description?: string | null };
  index: number;
  completed?: boolean;
  blocked?: boolean;
  urgent?: boolean;
  isJustCompleted?: boolean;
  onToggle: () => void;
  onTap: () => void;
}

function TaskRow({ task, index, completed, blocked, urgent, isJustCompleted, onToggle, onTap }: TaskRowProps) {
  const borderColor = urgent ? "border-r-destructive" : completed ? "border-r-success" : blocked ? "border-r-destructive/40" : "border-r-primary/30";

  return (
    <div
      className={`
        bg-card rounded-2xl border border-r-[3px] ${borderColor} p-4 flex items-center gap-3.5
        transition-all duration-300 active:scale-[0.98]
        ${isJustCompleted ? "animate-task-complete" : ""}
        ${completed ? "opacity-60" : "shadow-sm hover:shadow-md"}
        ${blocked ? "opacity-70" : ""}
      `}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className={`shrink-0 transition-all duration-200 active:scale-90 ${
          completed ? "" : "hover:scale-110"
        }`}
      >
        {completed ? (
          <CheckCircle2 className="h-7 w-7 text-success animate-check-mark" />
        ) : blocked ? (
          <div className="h-7 w-7 rounded-full border-2 border-destructive/40 flex items-center justify-center">
            <span className="text-xs">🚫</span>
          </div>
        ) : (
          <div className={`h-7 w-7 rounded-full border-2 transition-colors ${
            urgent ? "border-destructive/50 hover:border-destructive" : "border-muted-foreground/30 hover:border-primary"
          }`} />
        )}
      </button>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onTap} data-navigate-to={`/my-tasks/${task.id}`}>
        <p className={`text-sm font-medium leading-snug ${
          completed ? "line-through text-muted-foreground" : blocked ? "text-muted-foreground" : "text-foreground"
        }`}>
          {task.title}
        </p>
        {task.description && !completed && (
          <p className="text-xs text-muted-foreground/60 mt-0.5 truncate">{task.description}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {urgent && !completed && <PriorityBadge priority="דחוף" />}
        <ChevronLeft className="h-4 w-4 text-muted-foreground/40" />
      </div>
    </div>
  );
}
