import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { handleError } from "@/lib/errorHandler";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, Pencil, Plus, Trash2, CalendarDays, ChevronLeft, ChevronRight, Loader2, FolderKanban } from "lucide-react";
import ProjectFormDialog, { type ProjectFormValues } from "@/components/projects/ProjectFormDialog";
import {
  type Project,
  type ProjectTask,
  type ProjectTaskStatus,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_COLORS,
  PROJECT_PRIORITY_LABEL,
  PROJECT_PRIORITY_COLORS,
  TASK_STATUS_LABEL,
  TASK_STATUS_ORDER,
} from "@/components/projects/types";
import { format } from "date-fns";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const fetchAll = async () => {
    if (!id) return;
    const [{ data: projData, error: projErr }, { data: taskData }] = await Promise.all([
      supabase.from("projects").select("*").eq("id", id).maybeSingle(),
      supabase.from("project_tasks").select("*").eq("project_id", id).order("sort_order").order("created_at"),
    ]);
    if (projErr || !projData) {
      setNotFound(true);
    } else {
      setProject(projData as Project);
      setTasks((taskData as ProjectTask[]) ?? []);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchAll();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const progress = useMemo(() => {
    if (tasks.length === 0) return 0;
    const done = tasks.filter(t => t.status === "DONE").length;
    return Math.round((done / tasks.length) * 100);
  }, [tasks]);

  const handleUpdateProject = async (values: ProjectFormValues) => {
    if (!project) return;
    const { error } = await supabase
      .from("projects")
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq("id", project.id);
    if (error) {
      handleError(error, "שגיאה בעדכון הפרויקט: " + (error.message || "נסה שוב"));
      return;
    }
    toast.success("הפרויקט עודכן");
    await fetchAll();
  };

  const handleAddTask = async () => {
    const title = newTaskTitle.trim();
    if (!title || !project) return;
    setNewTaskTitle("");
    const { error } = await supabase.from("project_tasks").insert({
      project_id: project.id,
      title,
      status: "TODO",
      sort_order: tasks.length,
    });
    if (error) {
      handleError(error, "שגיאה בהוספת משימה: " + (error.message || "נסה שוב"));
      return;
    }
    await fetchAll();
  };

  const setTaskStatus = async (task: ProjectTask, status: ProjectTaskStatus) => {
    setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, status } : t)));
    const { error } = await supabase.from("project_tasks").update({ status }).eq("id", task.id);
    if (error) {
      handleError(error, "שגיאה בעדכון המשימה");
      await fetchAll();
    }
  };

  const deleteTask = async (task: ProjectTask) => {
    setTasks(prev => prev.filter(t => t.id !== task.id));
    const { error } = await supabase.from("project_tasks").delete().eq("id", task.id);
    if (error) {
      handleError(error, "שגיאה במחיקת המשימה");
      await fetchAll();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (notFound || !project) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-muted-foreground">הפרויקט לא נמצא.</p>
        <Button variant="outline" onClick={() => navigate("/projects")}>
          <ArrowRight className="h-4 w-4 ml-2" />חזרה לפרויקטים
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate("/projects")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowRight className="h-4 w-4" />
        <FolderKanban className="h-4 w-4" />
        חזרה לפרויקטים
      </button>

      {/* Project header */}
      <div className="rounded-xl border bg-card p-5 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 h-full w-1.5" style={{ backgroundColor: project.color }} />
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${PROJECT_STATUS_COLORS[project.status]}`}>
                {PROJECT_STATUS_LABEL[project.status]}
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${PROJECT_PRIORITY_COLORS[project.priority]}`}>
                עדיפות {PROJECT_PRIORITY_LABEL[project.priority]}
              </span>
            </div>
            {project.description && (
              <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{project.description}</p>
            )}
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
              {project.start_date && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  התחלה: {format(new Date(project.start_date), "dd/MM/yyyy")}
                </span>
              )}
              {project.due_date && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  יעד: {format(new Date(project.due_date), "dd/MM/yyyy")}
                </span>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 ml-2" />ערוך
          </Button>
        </div>

        <div className="mt-4 space-y-1.5 max-w-md">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>התקדמות כללית</span>
            <span>{tasks.filter(t => t.status === "DONE").length}/{tasks.length} · {progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* Add task */}
      <div className="flex gap-2 max-w-xl">
        <Input
          value={newTaskTitle}
          onChange={e => setNewTaskTitle(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleAddTask(); }}
          placeholder="הוסף משימה חדשה ולחץ Enter..."
        />
        <Button onClick={handleAddTask} disabled={!newTaskTitle.trim()}>
          <Plus className="h-4 w-4 ml-2" />הוסף
        </Button>
      </div>

      {/* Task board */}
      <div className="grid gap-4 md:grid-cols-3">
        {TASK_STATUS_ORDER.map(status => {
          const colTasks = tasks.filter(t => t.status === status);
          return (
            <div key={status} className="rounded-xl border bg-muted/20 p-3">
              <div className="flex items-center justify-between px-1 pb-2 mb-2 border-b">
                <h3 className="text-sm font-semibold text-foreground">{TASK_STATUS_LABEL[status]}</h3>
                <span className="text-xs text-muted-foreground bg-background rounded-full px-2 py-0.5">{colTasks.length}</span>
              </div>
              <div className="space-y-2 min-h-[40px]">
                {colTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">אין משימות</p>
                ) : (
                  colTasks.map(task => {
                    const idx = TASK_STATUS_ORDER.indexOf(task.status);
                    const prevStatus = TASK_STATUS_ORDER[idx - 1];
                    const nextStatus = TASK_STATUS_ORDER[idx + 1];
                    return (
                      <div key={task.id} className="group rounded-lg border bg-card p-2.5 shadow-sm">
                        <p className={`text-sm ${task.status === "DONE" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {task.title}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1">
                            {/* In RTL, "previous status" sits to the right (ChevronRight), "next" to the left (ChevronLeft) */}
                            <button
                              onClick={() => prevStatus && setTaskStatus(task, prevStatus)}
                              disabled={!prevStatus}
                              className="p-1 rounded text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none"
                              title={prevStatus ? TASK_STATUS_LABEL[prevStatus] : undefined}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => nextStatus && setTaskStatus(task, nextStatus)}
                              disabled={!nextStatus}
                              className="p-1 rounded text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none"
                              title={nextStatus ? TASK_STATUS_LABEL[nextStatus] : undefined}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                          </div>
                          <button
                            onClick={() => deleteTask(task)}
                            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="מחק משימה"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ProjectFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
        onSubmit={handleUpdateProject}
      />
    </div>
  );
}
