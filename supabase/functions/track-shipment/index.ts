import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { fetchDhlTracking, persistTracking, persistTrackingError } from "../_shared/dhlParse.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authResult = await verifyAuth(req);
    if ("error" in authResult) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { order_id } = await req.json() as { order_id: string };
    if (!order_id) {
      return new Response(
        JSON.stringify({ error: "order_id נדרש" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { supabaseAdmin } = authResult.auth;
    const { data: order, error: fetchErr } = await supabaseAdmin
      .from("orders")
      .select("id, tracking_number")
      .eq("id", order_id)
      .single();

    if (fetchErr || !order) {
      return new Response(
        JSON.stringify({ error: "הזמנה לא נמצאה" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!order.tracking_number) {
      return new Response(
        JSON.stringify({ error: "להזמנה זו אין מספר מעקב" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dhlApiKey = Deno.env.get("DHL_API_KEY");
    if (!dhlApiKey) {
      return new Response(
        JSON.stringify({ error: "DHL_API_KEY לא מוגדר" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await fetchDhlTracking(order.tracking_number, dhlApiKey);
    if (!result.ok) {
      await persistTrackingError(supabaseAdmin, order_id, result.errorCode);
      return new Response(
        JSON.stringify({ error: result.message, error_code: result.errorCode }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await persistTracking(supabaseAdmin, order_id, result.payload);

    return new Response(
      JSON.stringify({
        success: true,
        tracking_status_code: result.payload.tracking_status_code,
        tracking_description: result.payload.tracking_description,
        tracking_eta: result.payload.tracking_eta,
        tracking_last_location: result.payload.tracking_last_location,
        events_count: result.payload.tracking_events.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "שגיאה פנימית" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
