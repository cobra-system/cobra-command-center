import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Get all compliance items
    const { data: items, error } = await supabase
      .from("compliance_items")
      .select("id, name, expiry_date, status");

    if (error) throw error;

    const now = new Date();
    const created: string[] = [];

    for (const item of items || []) {
      if (!item.expiry_date) {
        // Update missing items
        if (item.status !== "missing") {
          await supabase.from("compliance_items").update({ status: "missing" }).eq("id", item.id);
        }
        continue;
      }

      const expiry = new Date(item.expiry_date);
      const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Update status
      let newStatus = "active";
      if (daysLeft < 0) newStatus = "expired";
      else if (daysLeft <= 60) newStatus = "expiring_soon";

      if (item.status !== newStatus) {
        await supabase.from("compliance_items").update({ status: newStatus }).eq("id", item.id);
      }

      // Create task if within 60 days and no existing task
      if (daysLeft <= 60 && daysLeft > 0) {
        const taskTitle = `חדש רישיון: ${item.name}`;
        const { data: existing } = await supabase
          .from("tasks")
          .select("id")
          .eq("title", taskTitle)
          .neq("status", "DONE")
          .limit(1);

        if (!existing || existing.length === 0) {
          await supabase.from("tasks").insert({
            title: taskTitle,
            priority: "דחוף",
            status: "TODO",
            description: `רישיון "${item.name}" פג תוקף ב-${item.expiry_date}. נותרו ${daysLeft} ימים.`,
            due_date: item.expiry_date,
          });
          created.push(taskTitle);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, tasks_created: created }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
