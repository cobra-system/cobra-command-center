import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

interface Task {
  id: string;
  title: string;
  due_date: string | null;
  status: string;
  is_daily: boolean;
  recurring_task_id: string | null;
  notes: string | null;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayISO = today.toISOString();

    // Get all incomplete tasks with past due dates
    const { data: tasks, error: fetchError } = await supabase
      .from("tasks")
      .select("id, title, due_date, status, is_daily, recurring_task_id, notes")
      .neq("status", "DONE")
      .neq("status", "TEMPLATE")
      .not("due_date", "is", null);

    if (fetchError) {
      throw fetchError;
    }

    const tasksToAdvance: Task[] = [];

    // Filter tasks that are overdue (due date is in the past and not today)
    for (const task of tasks as Task[]) {
      if (!task.due_date) continue;

      const taskDueDate = new Date(task.due_date);
      const taskDueDateOnly = new Date(taskDueDate.getFullYear(), taskDueDate.getMonth(), taskDueDate.getDate());

      // Skip if task is due today or in the future
      if (taskDueDateOnly >= today) continue;

      tasksToAdvance.push(task);
    }

    console.log(`Found ${tasksToAdvance.length} overdue tasks to advance`);

    if (tasksToAdvance.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No overdue tasks to advance",
          advanced: 0,
          tasks: [],
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const advancedTasks: { id: string; title: string; old_due_date: string; new_due_date: string }[] = [];

    // Advance each task to today
    for (const task of tasksToAdvance) {
      const oldDueDate = task.due_date ? new Date(task.due_date).toISOString() : null;

      // For recurring instances: append a "missed" note and update last_generated on the
      // template to prevent generate-recurring-tasks from creating a duplicate today.
      if (task.recurring_task_id) {
        const missedDate = task.due_date
          ? new Date(task.due_date).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "numeric" })
          : "תאריך לא ידוע";
        const missedNote = `⚠️ לא בוצע ב-${missedDate}`;
        const newNotes = task.notes ? `${task.notes}\n${missedNote}` : missedNote;

        const { error: updateError } = await supabase
          .from("tasks")
          .update({ due_date: todayISO, notes: newNotes })
          .eq("id", task.id);

        if (updateError) {
          console.error(`Error advancing recurring task ${task.id}:`, updateError);
          continue;
        }

        // Stamp last_generated on the template so generate-recurring-tasks won't
        // create a second instance for today.
        await supabase
          .from("tasks")
          .update({ last_generated: now.toISOString() })
          .eq("id", task.recurring_task_id);
      } else {
        // Regular (non-recurring) task: just advance the due date
        const { error: updateError } = await supabase
          .from("tasks")
          .update({ due_date: todayISO })
          .eq("id", task.id);

        if (updateError) {
          console.error(`Error advancing task ${task.id}:`, updateError);
          continue;
        }
      }

      // Log the advancement
      await supabase
        .from("task_advancement_log")
        .insert({
          task_id: task.id,
          old_due_date: oldDueDate,
          new_due_date: todayISO,
          advanced_by: "edge_function_scheduled",
        })
        .catch((error) => {
          console.error(`Error logging advancement for task ${task.id}:`, error);
        });

      advancedTasks.push({
        id: task.id,
        title: task.title,
        old_due_date: oldDueDate || "",
        new_due_date: todayISO,
      });
    }

    console.log(`Successfully advanced ${advancedTasks.length} tasks`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${advancedTasks.length} overdue task(s) advanced to today`,
        advanced: advancedTasks.length,
        tasks: advancedTasks,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in advance-overdue-tasks function:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
