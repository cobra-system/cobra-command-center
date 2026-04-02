import { z } from "zod";

export const taskSchema = z.object({
  title: z.string().min(1, "כותרת משימה היא שדה חובה"),
  description: z.string().nullable().optional(),
  priority: z.enum(["דחוף", "גבוה", "בינוני", "נמוך"]).default("בינוני"),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "TEMPLATE"]).default("TODO"),
  assignee_id: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  start_date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  milestone: z.string().nullable().optional(),
  deliverable: z.string().nullable().optional(),
});

export type TaskFormData = z.infer<typeof taskSchema>;
