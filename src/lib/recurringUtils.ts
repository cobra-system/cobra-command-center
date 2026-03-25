import { format, startOfDay, getDay, getDate } from "date-fns";
import { supabase } from "@/lib/supabase";
import type { Task } from "@/contexts/AppContext";

// A recurring template is a Task with frequency set and status = "TEMPLATE"
export type RecurringTask = Task;

export function recurringMatchesDay(rt: RecurringTask, day: Date): boolean {
  const dayOfWeek = getDay(day);
  const dayOfMonth = getDate(day);
  switch (rt.frequency) {
    case "daily": return true;
    case "weekly": return rt.day_of_week === dayOfWeek;
    case "biweekly": {
      if (rt.day_of_week !== dayOfWeek) return false;
      const weekNum = Math.floor(day.getTime() / (7 * 24 * 60 * 60 * 1000));
      return weekNum % 2 === 0;
    }
    case "monthly": return rt.day_of_month === dayOfMonth;
    case "quarterly":
      return rt.day_of_month === dayOfMonth && day.getMonth() % 3 === 0;
    case "biannual":
      return rt.day_of_month === dayOfMonth && (day.getMonth() === 0 || day.getMonth() === 6);
    case "annual":
      return rt.day_of_month === dayOfMonth && day.getMonth() === 0;
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
