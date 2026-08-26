export type ProjectStatus = "planning" | "active" | "on_hold" | "done";
export type ProjectPriority = "low" | "medium" | "high";
export type ProjectTaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  priority: ProjectPriority;
  color: string;
  start_date: string | null;
  due_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  status: ProjectTaskStatus;
  due_date: string | null;
  sort_order: number;
  created_at: string;
}

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "בתכנון",
  active: "פעיל",
  on_hold: "בהמתנה",
  done: "הושלם",
};

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  planning: "bg-muted text-muted-foreground",
  active: "bg-accent/15 text-accent",
  on_hold: "bg-warning/15 text-warning",
  done: "bg-success/15 text-success",
};

export const PROJECT_PRIORITY_LABEL: Record<ProjectPriority, string> = {
  low: "נמוכה",
  medium: "בינונית",
  high: "גבוהה",
};

export const PROJECT_PRIORITY_COLORS: Record<ProjectPriority, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-accent/15 text-accent",
  high: "bg-destructive/15 text-destructive",
};

export const TASK_STATUS_LABEL: Record<ProjectTaskStatus, string> = {
  TODO: "לביצוע",
  IN_PROGRESS: "בביצוע",
  DONE: "הושלם",
};

export const TASK_STATUS_ORDER: ProjectTaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];

export const PROJECT_COLOR_SWATCHES = [
  "#0e7490", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#2563eb", "#dc2626", "#0891b2",
];
