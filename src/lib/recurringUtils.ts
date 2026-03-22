import { format, startOfDay, getDay, getDate } from "date-fns";
import { supabase } from "@/lib/supabase";
import type { Task } from "@/contexts/AppContext";

export interface RecurringTask {
  id: string;
  title: string;
  description: string | null;
  frequency: string;
  day_of_week: number | null;
  day_of_month: number | null;
  days_before: number;
  priority: string;
  assignee_id: string | null;
  assignee_name: string | null;
  is_active: boolean;
  next_due: string | null;
}

export function recurringMatchesDay(rt: RecurringTask, day: Date): boolean {
  const dayOfWeek = getDay(day);
  const dayOfMonth = getDate(day);
  switch (rt.frequency) {
    case "daily": return true;
    case "weekly": return rt.day_of_week === dayOfWeek;
    case "biweekly": return rt.day_of_week === dayOfWeek;
    case "monthly": return rt.day_of_month === dayOfMonth;
    case "quarterly":
    case "biannual":
    case "annual": return rt.day_of_month === dayOfMonth;
    default: return false;
  }
}

export async function findOrCreateRecurringInstance(
  rt: RecurringTask,
  date: Date
): Promise<Task | null> {
  const dateStr = format(startOfDay(date), "yyyy-MM-dd");

  // Check for existing instance on this date
  const { data: existing } = await supabase
    .from("tasks")
    .select("*")
    .eq("recurring_task_id", rt.id)
    .gte("due_date", dateStr + "T00:00:00")
    .lte("due_date", dateStr + "T23:59:59")
    .maybeSingle();

  if (existing) return existing as Task;

  // Create new instance
  const { data: created } = await supabase
    .from("tasks")
    .insert({
      title: rt.title,
      description: rt.description,
      priority: rt.priority,
      status: "TODO",
      assignee_id: rt.assignee_id,
      assignee_name: rt.assignee_name,
      recurring_task_id: rt.id,
      due_date: startOfDay(date).toISOString(),
      is_daily: false,
    })
    .select("*")
    .single();

  return created as Task | null;
}
