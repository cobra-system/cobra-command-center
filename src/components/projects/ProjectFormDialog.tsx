import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  type Project,
  type ProjectStatus,
  type ProjectPriority,
  PROJECT_STATUS_LABEL,
  PROJECT_PRIORITY_LABEL,
  PROJECT_COLOR_SWATCHES,
} from "./types";

export interface ProjectFormValues {
  name: string;
  description: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  color: string;
  start_date: string | null;
  due_date: string | null;
}

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project | null;
  onSubmit: (values: ProjectFormValues) => Promise<void> | void;
}

const emptyValues: ProjectFormValues = {
  name: "",
  description: "",
  status: "active",
  priority: "medium",
  color: PROJECT_COLOR_SWATCHES[0],
  start_date: null,
  due_date: null,
};

export default function ProjectFormDialog({ open, onOpenChange, project, onSubmit }: ProjectFormDialogProps) {
  const [values, setValues] = useState<ProjectFormValues>(emptyValues);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValues(
        project
          ? {
              name: project.name,
              description: project.description ?? "",
              status: project.status,
              priority: project.priority,
              color: project.color,
              start_date: project.start_date,
              due_date: project.due_date,
            }
          : emptyValues
      );
    }
  }, [open, project]);

  const handleSave = async () => {
    if (!values.name.trim()) return;
    setSaving(true);
    try {
      await onSubmit({ ...values, name: values.name.trim(), description: values.description.trim() });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{project ? "עריכת פרויקט" : "פרויקט חדש"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="project-name">שם הפרויקט</Label>
            <Input
              id="project-name"
              value={values.name}
              onChange={e => setValues(v => ({ ...v, name: e.target.value }))}
              placeholder="לדוגמה: השקת אתר חדש"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-desc">תיאור</Label>
            <Textarea
              id="project-desc"
              value={values.description}
              onChange={e => setValues(v => ({ ...v, description: e.target.value }))}
              placeholder="מה מטרת הפרויקט?"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>סטטוס</Label>
              <Select value={values.status} onValueChange={(val: ProjectStatus) => setValues(v => ({ ...v, status: val }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PROJECT_STATUS_LABEL).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>עדיפות</Label>
              <Select value={values.priority} onValueChange={(val: ProjectPriority) => setValues(v => ({ ...v, priority: val }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PROJECT_PRIORITY_LABEL).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="project-start">תאריך התחלה</Label>
              <Input
                id="project-start"
                type="date"
                value={values.start_date ?? ""}
                onChange={e => setValues(v => ({ ...v, start_date: e.target.value || null }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-due">תאריך יעד</Label>
              <Input
                id="project-due"
                type="date"
                value={values.due_date ?? ""}
                onChange={e => setValues(v => ({ ...v, due_date: e.target.value || null }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>צבע</Label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLOR_SWATCHES.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setValues(v => ({ ...v, color }))}
                  className={`h-7 w-7 rounded-full transition-transform ${values.color === color ? "ring-2 ring-offset-2 ring-foreground scale-110" : "hover:scale-110"}`}
                  style={{ backgroundColor: color }}
                  aria-label={color}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button onClick={handleSave} disabled={saving || !values.name.trim()}>
            {project ? "שמור שינויים" : "צור פרויקט"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
