import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

const HEBREW_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const cronSecret = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("Authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date();
  // Reference the month that just ended (previous calendar month)
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthLabel = `${HEBREW_MONTHS[prevMonth.getMonth()]} ${prevMonth.getFullYear()}`;

  // Find all monthly requests that are currently fulfilled
  const { data: requests, error: fetchError } = await supabase
    .from("order_requests")
    .select("id")
    .eq("order_type", "חודשית")
    .eq("status", "ordered");

  if (fetchError) {
    console.error("Fetch error:", fetchError.message);
    return new Response(JSON.stringify({ success: false, error: fetchError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!requests || requests.length === 0) {
    return new Response(JSON.stringify({ success: true, reset: 0, month: monthLabel }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ids = requests.map((r: { id: string }) => r.id);

  // Reset to pending — clear all fulfillment fields; created_at is preserved so
  // accumulated waiting days carry forward naturally.
  const { error: updateError } = await supabase
    .from("order_requests")
    .update({
      status: "pending",
      order_id: null,
      linked_order_ids: [],
      ordered_at: null,
      ordered_by: null,
      ordered_by_name: null,
      reviewed_at: null,
      reviewed_by: null,
      reviewed_by_name: null,
      delivery_status: null,
      received_qty: null,
      actual_ordered_qty: null,
      payment_status: null,
      shipping_type: null,
      estimated_arrival_date: null,
    })
    .in("id", ids);

  if (updateError) {
    console.error("Update error:", updateError.message);
    return new Response(JSON.stringify({ success: false, error: updateError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Add a comment to each request recording the completed month
  const comments = ids.map((id: string) => ({
    request_id: id,
    body: `ההזמנה בוצעה לחודש ${monthLabel}`,
    created_by: null,
    created_by_name: "מערכת",
    created_by_role: "SYSTEM",
  }));

  const { error: commentError } = await supabase
    .from("order_request_comments")
    .insert(comments);

  if (commentError) {
    console.error("Comment insert error:", commentError.message);
  }

  // Record audit history
  const historyEntries = ids.map((id: string) => ({
    request_id: id,
    changed_by: null,
    changed_by_name: "מערכת",
    action: "reverted",
    note: `איפוס חודשי אוטומטי — ההזמנה בוצעה לחודש ${monthLabel}`,
  }));

  const { error: historyError } = await supabase
    .from("order_request_history")
    .insert(historyEntries);

  if (historyError) {
    console.error("History insert error:", historyError.message);
  }

  console.log(`Monthly reset complete: ${ids.length} requests reset for ${monthLabel}`);

  return new Response(
    JSON.stringify({ success: true, reset: ids.length, month: monthLabel }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
