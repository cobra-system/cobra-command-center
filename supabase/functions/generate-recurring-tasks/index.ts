import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

interface RecurringTask {
  id: string;
  title: string;
  description: string | null;
  frequency: string;
  day_of_week: number | null;
  day_of_month: number | null;
  days_before: number;
  time_of_day: string;
  priority: string;
  assignee_id: string | null;
  assignee_name: string | null;
  is_active: boolean;
  next_due: string | null;
  last_generated: string | null;
  month_of_year: number | null;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all active recurring task templates
    const { data: recurringTasks, error: fetchError } = await supabase
      .from("tasks")
      .select("*")
      .eq("status", "TEMPLATE")
      .eq("is_active", true);

    if (fetchError) {
      throw fetchError;
    }

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const currentDay = now.getDay(); // 0 = Sunday
    const currentDayOfMonth = now.getDate();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = `${currentHour.toString().padStart(2, "0")}:${currentMinute.toString().padStart(2, "0")}`;

    const tasksToCreate: Record<string, unknown>[] = [];

    for (const task of recurringTasks as RecurringTask[]) {
      // Check if task should be generated based on time
      const taskTime = task.time_of_day?.slice(0, 5) || "09:00";
      if (currentTime < taskTime) continue;

      // Check if already generated today
      if (task.last_generated) {
        const lastGen = task.last_generated.split("T")[0];
        if (lastGen === today) continue;
      }

      let shouldGenerate = false;

      // Calculate target date (when the task is actually due)
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + task.days_before);
      const targetDay = targetDate.getDay();
      const targetDayOfMonth = targetDate.getDate();
      const targetMonth = targetDate.getMonth();

      switch (task.frequency) {
        case "daily":
          shouldGenerate = true;
          break;

        case "weekly":
          // Generate if target day matches day_of_week
          if (task.day_of_week !== null && targetDay === task.day_of_week) {
            shouldGenerate = true;
          }
          break;

        case "biweekly":
          // Every other week: check day_of_week matches and use epoch week parity
          if (task.day_of_week !== null && targetDay === task.day_of_week) {
            const weekNum = Math.floor(targetDate.getTime() / (7 * 24 * 60 * 60 * 1000));
            if (weekNum % 2 === 0) {
              shouldGenerate = true;
            }
          }
          break;

        case "monthly":
          if (task.day_of_month !== null) {
            const lastDayM = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
            if (targetDayOfMonth === Math.min(task.day_of_month, lastDayM)) {
              shouldGenerate = true;
            }
          }
          break;

        case "quarterly":
          // Every 3 months: Jan, Apr, Jul, Oct
          if (task.day_of_month !== null && targetMonth % 3 === 0) {
            const lastDayQ = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
            if (targetDayOfMonth === Math.min(task.day_of_month, lastDayQ)) {
              shouldGenerate = true;
            }
          }
          break;

        case "biannual":
          // Every 6 months: Jan, Jul
          if (task.day_of_month !== null && (targetMonth === 0 || targetMonth === 6)) {
            const lastDayB = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
            if (targetDayOfMonth === Math.min(task.day_of_month, lastDayB)) {
              shouldGenerate = true;
            }
          }
          break;

        case "annual": {
          // Once a year in the configured month (default: January)
          const annualMonth = task.month_of_year ?? 0;
          if (task.day_of_month !== null && targetMonth === annualMonth) {
            const lastDayA = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
            if (targetDayOfMonth === Math.min(task.day_of_month, lastDayA)) {
              shouldGenerate = true;
            }
          }
          break;
        }
      }

      if (shouldGenerate) {
        tasksToCreate.push({
          title: task.title,
          description: task.description,
          priority: task.priority,
          status: "TODO",
          assignee_id: task.assignee_id,
          assignee_name: task.assignee_name,
          recurring_task_id: task.id,
          due_date: targetDate.toISOString(),
        });

        // Update last_generated
        await supabase
          .from("tasks")
          .update({ last_generated: now.toISOString() })
          .eq("id", task.id);
      }
    }

    // Insert all tasks
    if (tasksToCreate.length > 0) {
      const { error: insertError } = await supabase
        .from("tasks")
        .insert(tasksToCreate);

      if (insertError) {
        throw insertError;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        generated: tasksToCreate.length,
        tasks: tasksToCreate.map(t => t.title),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
