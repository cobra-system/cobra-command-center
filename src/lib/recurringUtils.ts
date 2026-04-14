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
    case "annual": {
      const targetMonth = rt.month_of_year ?? 0;
      return rt.day_of_month === dayOfMonth && day.getMonth() === targetMonth;
    }
    default: return false;
  }
}

/** Returns the due date for the next occurrence of a recurring template after a given base date. */
export function getNextOccurrenceDate(template: RecurringTask, fromDueDate: Date): Date {
  const base = new Date(fromDueDate);
  switch (template.frequency) {
    case "daily":
      base.setDate(base.getDate() + 1);
      break;
    case "weekly":
      base.setDate(base.getDate() + 7);
      break;
    case "biweekly":
      base.setDate(base.getDate() + 14);
      break;
    case "monthly": {
      const dom = template.day_of_month ?? base.getDate();
      base.setDate(1); // avoid overflow when current day > days in next month
      base.setMonth(base.getMonth() + 1);
      const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
      base.setDate(Math.min(dom, lastDay));
      break;
    }
    case "quarterly": {
      const dom3 = template.day_of_month ?? base.getDate();
      base.setDate(1); // avoid overflow while changing month
      base.setMonth(base.getMonth() + 3);
      const lastDay3 = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
      base.setDate(Math.min(dom3, lastDay3));
      break;
    }
    case "biannual": {
      const dom6 = template.day_of_month ?? base.getDate();
      base.setDate(1);
      base.setMonth(base.getMonth() + 6);
      const lastDay6 = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
      base.setDate(Math.min(dom6, lastDay6));
      break;
    }
    case "annual": {
      const domY = template.day_of_month ?? base.getDate();
      base.setDate(1);
      base.setFullYear(base.getFullYear() + 1);
      const lastDayY = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
      base.setDate(Math.min(domY, lastDayY));
      break;
    }
    default:
      base.setDate(base.getDate() + 1);
  }
  base.setHours(0, 0, 0, 0);
  return base;
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
