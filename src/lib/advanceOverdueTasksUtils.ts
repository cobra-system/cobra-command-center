import { isPast, isToday, startOfDay, format } from "date-fns";
import type { Task } from "@/contexts/AppContext";

/**
 * Filter tasks that should be advanced to today
 * Criteria: status !== "DONE" AND due_date < today AND not due today
 */
export function getOverdueTasksToAdvance(tasks: Task[]): Task[] {
  const today = startOfDay(new Date());

  return tasks.filter(task => {
    // Must have a due date
    if (!task.due_date) return false;

    // Must not be DONE
    if (task.status === "DONE") return false;

    const dueDate = startOfDay(new Date(task.due_date));

    // Must be in the past
    if (!isPast(dueDate)) return false;

    // Must not be today
    if (isToday(dueDate)) return false;

    return true;
  });
}

/**
 * Create an updated task with due_date set to today
 */
export function advanceTaskToToday(task: Task): Partial<Task> {
  const today = startOfDay(new Date());

  return {
    due_date: today.toISOString(),
  };
}

/**
 * Format a summary message for toast notification
 */
export function formatAdvancementSummary(count: number, taskTitles?: string[]): string {
  if (count === 0) {
    return "No overdue tasks to advance";
  }

  if (count === 1) {
    return `1 overdue task advanced to today`;
  }

  return `${count} overdue tasks advanced to today`;
}
