import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useData, type Priority, type TaskStatus } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { TaskStatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, CheckCircle2, AlertOctagon, FileText, MessageSquare } from "lucide-react";
import confetti from "canvas-confetti";

export default function MyTaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tasks, updateTaskStatus, addTaskNote } = useData();
  const task = tasks.find(t => t.id === id);
  const [note, setNote] = useState(task?.notes || "");
  const [saving, setSaving] = useState(false);

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 animate-task-appear">
        <p className="text-lg text-muted-foreground">משימה לא נמצאה</p>
        <Button variant="outline" onClick={() => navigate("/my-tasks")}><ArrowRight className="h-4 w-4 ml-2" />חזרה</Button>
      </div>
    );
  }

  const handleStatusChange = async (status: TaskStatus) => {
    if (status === "DONE") {
      confetti({
        particleCount: 60,
        spread: 55,
        origin: { y: 0.8, x: 0.5 },
        colors: ["#22c55e", "#16a34a", "#3b82f6"],
      });
    }
    await updateTaskStatus(task.id, status);
    navigate("/my-tasks");
  };

  const handleNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    await addTaskNote(task.id, note.trim());
    setSaving(false);
  };

  const isUrgent = task.priority === "P0";
  const isDone = task.status === "DONE";
  const isBlocked = task.status === "BLOCKED";

  return (
    <div className="px-5 py-6 pb-36 animate-task-appear">
      {/* Back button */}
      <button
        onClick={() => navigate("/my-tasks")}
        className="flex items-center gap-1.5 text-muted-foreground text-sm mb-6 active:text-foreground transition-colors"
      >
        <ArrowRight className="h-4 w-4" />
        <span>חזרה למשימות</span>
      </button>

      {/* Task header card */}
      <div className={`
        bg-card rounded-2xl border p-5 shadow-sm mb-4
        ${isUrgent ? "border-r-[3px] border-r-destructive" : ""}
        ${isDone ? "border-r-[3px] border-r-success" : ""}
        ${isBlocked ? "border-r-[3px] border-r-destructive/40" : ""}
      `}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <h1 className="text-xl font-bold text-foreground leading-snug">{task.title}</h1>
          <PriorityBadge priority={task.priority as Priority} />
        </div>
        <TaskStatusBadge status={task.status as TaskStatus} />
      </div>

      {/* Description */}
      {task.description && (
        <div className="bg-card rounded-2xl border p-4 shadow-sm mb-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">תיאור</span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{task.description}</p>
        </div>
      )}

      {/* Notes */}
      <div className="bg-card rounded-2xl border p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground">הערה</span>
        </div>
        <Textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="הוסף הערה..."
          rows={3}
          className="rounded-xl border-muted bg-background/50 resize-none"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleNote}
          disabled={saving || !note.trim()}
          className="mt-2 rounded-xl"
        >
          {saving ? "שומר..." : "שמור הערה"}
        </Button>
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-card/95 backdrop-blur-md border-t p-4 space-y-2.5 z-20">
        {!isDone && (
          <Button
            className="w-full h-12 rounded-2xl text-base font-bold bg-success hover:bg-success/90 text-success-foreground shadow-lg active:scale-[0.98] transition-all"
            onClick={() => handleStatusChange("DONE")}
          >
            <CheckCircle2 className="h-5 w-5 ml-2" />
            סיימתי! ✅
          </Button>
        )}
        {isDone && (
          <Button
            variant="outline"
            className="w-full h-12 rounded-2xl text-base font-medium active:scale-[0.98] transition-all"
            onClick={() => handleStatusChange("TODO")}
          >
            החזר לביצוע
          </Button>
        )}
        {!isBlocked && !isDone && (
          <Button
            variant="outline"
            className="w-full h-11 rounded-2xl text-sm text-destructive border-destructive/20 hover:bg-destructive/5 active:scale-[0.98] transition-all"
            onClick={() => handleStatusChange("BLOCKED")}
          >
            <AlertOctagon className="h-4 w-4 ml-2" />
            חסום — צריך עזרה
          </Button>
        )}
        {isBlocked && (
          <Button
            variant="outline"
            className="w-full h-11 rounded-2xl text-sm active:scale-[0.98] transition-all"
            onClick={() => handleStatusChange("TODO")}
          >
            החזר לביצוע
          </Button>
        )}
      </div>
    </div>
  );
}
