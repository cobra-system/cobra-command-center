import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all active recurring tasks
    const { data: recurringTasks, error: fetchError } = await supabase
      .from("recurring_tasks")
      .select("*")
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

    const tasksToCreate: any[] = [];

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
          if (task.day_of_month !== null && targetDayOfMonth === task.day_of_month) {
            shouldGenerate = true;
          }
          break;

        case "quarterly":
          // Every 3 months
          if (task.day_of_month !== null && targetDayOfMonth === task.day_of_month) {
            const monthsSinceJan = targetMonth;
            if (monthsSinceJan % 3 === 0) {
              shouldGenerate = true;
            }
          }
          break;

        case "biannual":
          // Every 6 months
          if (task.day_of_month !== null && targetDayOfMonth === task.day_of_month) {
            if (targetMonth === 0 || targetMonth === 6) {
              shouldGenerate = true;
            }
          }
          break;

        case "annual":
          // Once a year - check if we're in the right month
          if (task.day_of_month !== null && targetDayOfMonth === task.day_of_month) {
            // For annual, we generate in January or based on next_due
            if (targetMonth === 0) {
              shouldGenerate = true;
            }
          }
          break;
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
          .from("recurring_tasks")
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
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
