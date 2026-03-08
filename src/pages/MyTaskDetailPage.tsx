import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useData, type Priority, type TaskStatus } from "@/contexts/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { TaskStatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight } from "lucide-react";

export default function MyTaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tasks, updateTaskStatus, addTaskNote } = useData();
  const task = tasks.find(t => t.id === id);
  const [note, setNote] = useState(task?.notes || "");

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-lg text-muted-foreground">משימה לא נמצאה</p>
        <Button variant="outline" onClick={() => navigate("/my-tasks")}><ArrowRight className="h-4 w-4 ml-2" />חזרה</Button>
      </div>
    );
  }

  const handleStatusChange = async (status: TaskStatus) => {
    await updateTaskStatus(task.id, status);
    navigate("/my-tasks");
  };

  const handleNote = async () => {
    if (note.trim()) await addTaskNote(task.id, note.trim());
  };

  return (
    <div className="px-4 py-6 space-y-6">
      <button onClick={() => navigate("/my-tasks")} className="flex items-center gap-1 text-muted-foreground text-sm"><ArrowRight className="h-4 w-4" /> חזרה למשימות</button>
      <div>
        <div className="flex items-start justify-between gap-3 mb-2">
          <h1 className="text-xl font-bold text-foreground">{task.title}</h1>
          <PriorityBadge priority={task.priority as Priority} />
        </div>
        <TaskStatusBadge status={task.status as TaskStatus} />
      </div>
      {task.description && <p className="text-sm text-muted-foreground leading-relaxed">{task.description}</p>}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">הערה</label>
        <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="הוסף הערה..." rows={3} />
        <Button variant="outline" size="sm" onClick={handleNote}>שמור הערה</Button>
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t p-4 space-y-2">
        <Button variant="warning" className="w-full" onClick={() => handleStatusChange("IN_PROGRESS")}>🔄 בביצוע</Button>
        <Button variant="success" className="w-full" onClick={() => handleStatusChange("DONE")}>✅ הושלם</Button>
        <Button variant="destructive" className="w-full" onClick={() => handleStatusChange("BLOCKED")}>🚫 חסום — צריך עזרה</Button>
      </div>
    </div>
  );
}
