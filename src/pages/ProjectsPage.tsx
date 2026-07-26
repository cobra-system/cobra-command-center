import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { handleError } from "@/lib/errorHandler";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { FolderKanban, Plus, Search, Eye, Pencil, Trash2, CalendarDays, ListChecks, Loader2 } from "lucide-react";
import { EntityContextMenu, type ContextMenuGroupItem } from "@/components/EntityContextMenu";
import ProjectFormDialog, { type ProjectFormValues } from "@/components/projects/ProjectFormDialog";
import {
  type Project,
  type ProjectStatus,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_COLORS,
  PROJECT_PRIORITY_LABEL,
  PROJECT_PRIORITY_COLORS,
} from "@/components/projects/types";
import { format } from "date-fns";

interface TaskCount {
  total: number;
  done: number;
}

const STATUS_FILTERS: (ProjectStatus | "all")[] = ["all", "active", "planning", "on_hold", "done"];

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [taskCounts, setTaskCounts] = useState<Record<string, TaskCount>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("sort_order")
      .order("created_at", { ascending: false });
    if (error) {
      if (error.message?.includes("schema cache") || error.code === "42P01") {
        toast.error("טבלת הפרויקטים לא נמצאה — יש להריץ את המיגרציה (supabase/migrations).");
      }
      setProjects([]);
      return;
    }
    setProjects((data as Project[]) ?? []);
  };

  const fetchTaskCounts = async () => {
    const { data } = await supabase.from("project_tasks").select("project_id, status");
    if (data) {
      const counts: Record<string, TaskCount> = {};
      (data as { project_id: string; status: string }[]).forEach(t => {
        if (!counts[t.project_id]) counts[t.project_id] = { total: 0, done: 0 };
        counts[t.project_id].total++;
        if (t.status === "DONE") counts[t.project_id].done++;
      });
      setTaskCounts(counts);
    }
  };

  const refresh = async () => {
    await Promise.all([fetchProjects(), fetchTaskCounts()]);
  };

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (values: ProjectFormValues) => {
    const { error } = await supabase.from("projects").insert(values);
    if (error) {
      handleError(error, "שגיאה ביצירת הפרויקט: " + (error.message || "נסה שוב"));
      return;
    }
    toast.success("הפרויקט נוצר");
    await refresh();
  };

  const handleUpdate = async (values: ProjectFormValues) => {
    if (!editProject) return;
    const { error } = await supabase
      .from("projects")
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq("id", editProject.id);
    if (error) {
      handleError(error, "שגיאה בעדכון הפרויקט: " + (error.message || "נסה שוב"));
      return;
    }
    toast.success("הפרויקט עודכן");
    await refresh();
  };

  const handleDelete = async (project: Project) => {
    const { error } = await supabase.from("projects").delete().eq("id", project.id);
    if (error) {
      handleError(error, "שגיאה במחיקת הפרויקט: " + (error.message || "נסה שוב"));
      return;
    }
    toast.success("הפרויקט נמחק");
    await refresh();
  };

  const filtered = useMemo(() => {
    let list = projects;
    if (statusFilter !== "all") list = list.filter(p => p.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        p => p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [projects, statusFilter, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FolderKanban className="h-6 w-6 text-primary" />
          פרויקטים
        </h1>
        <Button onClick={() => { setEditProject(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 ml-2" />פרויקט חדש
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש פרויקטים..."
            className="pr-10"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                statusFilter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              {f === "all" ? "הכל" : PROJECT_STATUS_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Project grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          {projects.length === 0
            ? "אין פרויקטים עדיין. צור פרויקט חדש כדי להתחיל."
            : "לא נמצאו תוצאות."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(project => {
            const counts = taskCounts[project.id] ?? { total: 0, done: 0 };
            const progress = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;
            const menuGroups: ContextMenuGroupItem[][] = [
              [
                { label: "פתח פרויקט", icon: Eye, onClick: () => navigate(`/projects/${project.id}`) },
                { label: "ערוך פרויקט", icon: Pencil, onClick: () => { setEditProject(project); setFormOpen(true); } },
              ],
              [
                {
                  label: "מחק פרויקט",
                  icon: Trash2,
                  onClick: () => handleDelete(project),
                  variant: "destructive" as const,
                  confirmTitle: "מחיקת פרויקט",
                  confirmDescription: `האם למחוק את הפרויקט "${project.name}"? כל המשימות המשויכות יימחקו גם כן.`,
                },
              ],
            ];
            return (
              <EntityContextMenu key={project.id} groups={menuGroups}>
                <div
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="group relative p-5 rounded-xl border bg-card hover:bg-muted/30 transition-colors cursor-pointer shadow-sm overflow-hidden"
                >
                  <div className="absolute top-0 right-0 h-full w-1" style={{ backgroundColor: project.color }} />
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-foreground line-clamp-1 flex-1">{project.name}</h3>
                    <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${PROJECT_STATUS_COLORS[project.status]}`}>
                      {PROJECT_STATUS_LABEL[project.status]}
                    </span>
                  </div>

                  {project.description && (
                    <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{project.description}</p>
                  )}

                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>התקדמות</span>
                      <span>{counts.done}/{counts.total} · {progress}%</span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${PROJECT_PRIORITY_COLORS[project.priority]}`}>
                      {PROJECT_PRIORITY_LABEL[project.priority]}
                    </span>
                    <span className="flex items-center gap-1">
                      <ListChecks className="h-3.5 w-3.5" />
                      {counts.total} משימות
                    </span>
                    {project.due_date && (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {format(new Date(project.due_date), "dd/MM/yyyy")}
                      </span>
                    )}
                  </div>
                </div>
              </EntityContextMenu>
            );
          })}
        </div>
      )}

      <ProjectFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        project={editProject}
        onSubmit={editProject ? handleUpdate : handleCreate}
      />
    </div>
  );
}
