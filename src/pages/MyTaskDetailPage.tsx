import { useParams, useNavigate } from "react-router-dom";
import { useData } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { TaskStatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import type { TaskStatus } from "@/data/mockData";

export default function MyTaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { tasks, updateTaskStatus, addTaskNote } = useData();
  const navigate = useNavigate();
  const task = tasks.find(t => t.id === id);
  const [note, setNote] = useState(task?.notes || "");

  if (!task) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">משימה לא נמצאה</p>
      </div>
    );
  }

  const handleStatusChange = (status: TaskStatus) => {
    updateTaskStatus(task.id, status);
    if (note !== (task.notes || "")) {
      addTaskNote(task.id, note);
    }
    navigate("/my-tasks");
  };

  const handleSaveNote = () => {
    addTaskNote(task.id, note);
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-60px)]">
      {/* Back button */}
      <div className="px-4 py-3">
        <button onClick={() => navigate("/my-tasks")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-4 w-4" />
          חזרה
        </button>
      </div>

      {/* Content */}
      <div className="px-5 space-y-4 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-bold text-foreground leading-tight">{task.title}</h1>
          <PriorityBadge priority={task.priority} />
        </div>

        <TaskStatusBadge status={task.status} />

        {task.description && (
          <p className="text-sm text-muted-foreground">{task.description}</p>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">הערה</label>
          <Textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="הוסף הערה..."
            rows={3}
            className="resize-none"
          />
          <Button size="sm" variant="outline" onClick={handleSaveNote}>שמור הערה</Button>
        </div>
      </div>

      {/* Fixed bottom actions */}
      <div className="sticky bottom-0 bg-background border-t p-4 space-y-2">
        {task.status !== "IN_PROGRESS" && (
          <Button
            className="w-full"
            variant="outline"
            size="lg"
            onClick={() => handleStatusChange("IN_PROGRESS")}
          >
            🔄 בביצוע
          </Button>
        )}
        {task.status !== "DONE" && (
          <Button
            className="w-full"
            variant="success"
            size="lg"
            onClick={() => handleStatusChange("DONE")}
          >
            ✅ הושלם
          </Button>
        )}
        {task.status !== "BLOCKED" && (
          <Button
            className="w-full"
            variant="destructive"
            size="lg"
            onClick={() => handleStatusChange("BLOCKED")}
          >
            🚫 חסום — צריך עזרה
          </Button>
        )}
      </div>
    </div>
  );
}
