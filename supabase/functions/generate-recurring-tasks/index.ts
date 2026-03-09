import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RecurringTask {
  id: string;
  title: string;
  description: string | null;
  priority: string | null;
  frequency: string;
  day_of_week: number | null;
  day_of_month: number | null;
  days_before: number | null;
  next_due: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  is_active: boolean;
}

function calculateNextDue(task: RecurringTask, fromDate: Date): string {
  const date = new Date(fromDate);

  switch (task.frequency) {
    case "daily":
      date.setDate(date.getDate() + 1);
      break;
    case "weekly":
      date.setDate(date.getDate() + 7);
      break;
    case "monthly":
      date.setMonth(date.getMonth() + 1);
      if (task.day_of_month) {
        date.setDate(Math.min(task.day_of_month, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
      }
      break;
    case "quarterly":
      date.setMonth(date.getMonth() + 3);
      break;
    case "biannual":
      date.setMonth(date.getMonth() + 6);
      break;
    case "yearly":
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      date.setDate(date.getDate() + 7);
  }

  return date.toISOString().split("T")[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];

    // Fetch active recurring tasks
    const { data: recurringTasks, error: fetchError } = await supabase
      .from("recurring_tasks")
      .select("*")
      .eq("is_active", true);

    if (fetchError) {
      throw new Error(`Failed to fetch recurring tasks: ${fetchError.message}`);
    }

    const results: { created: string[]; skipped: string[]; errors: string[] } = {
      created: [],
      skipped: [],
      errors: [],
    };

    for (const task of recurringTasks || []) {
      try {
        if (!task.next_due) {
          results.skipped.push(`${task.title}: no next_due date`);
          continue;
        }

        const nextDue = new Date(task.next_due);
        const daysBefore = task.days_before || 0;
        const triggerDate = new Date(nextDue);
        triggerDate.setDate(triggerDate.getDate() - daysBefore);

        // Check if we should generate today
        if (triggerDate > today) {
          results.skipped.push(`${task.title}: trigger date ${triggerDate.toISOString().split("T")[0]} is in the future`);
          continue;
        }

        // Check if task was already generated for this period
        const { data: existing } = await supabase
          .from("tasks")
          .select("id")
          .eq("recurring_task_id", task.id)
          .gte("created_at", new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString())
          .limit(1);

        if (existing && existing.length > 0) {
          results.skipped.push(`${task.title}: already generated today`);
          continue;
        }

        // Create the task
        const { error: insertError } = await supabase.from("tasks").insert({
          title: task.title,
          description: task.description,
          priority: task.priority || "בינוני",
          status: "TODO",
          assignee_id: task.assignee_id,
          assignee_name: task.assignee_name,
          due_date: task.next_due,
          is_daily: false,
          recurring_task_id: task.id,
        });

        if (insertError) {
          results.errors.push(`${task.title}: ${insertError.message}`);
          continue;
        }

        // Update next_due
        const newNextDue = calculateNextDue(task, nextDue);
        await supabase
          .from("recurring_tasks")
          .update({
            next_due: newNextDue,
            last_generated: new Date().toISOString(),
          })
          .eq("id", task.id);

        results.created.push(task.title);
      } catch (err) {
        results.errors.push(`${task.title}: ${err instanceof Error ? err.message : "unknown error"}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: todayStr,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
