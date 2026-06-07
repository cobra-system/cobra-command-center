import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { fetchDhlTracking } from "../_shared/dhlParse.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authResult = await verifyAuth(req);
    if ("error" in authResult) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { return_id } = await req.json() as { return_id: string };
    if (!return_id) {
      return new Response(
        JSON.stringify({ error: "return_id נדרש" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { supabaseAdmin } = authResult.auth;
    const { data: ret, error: fetchErr } = await supabaseAdmin
      .from("waste_supplier_returns")
      .select("id, tracking_number, tracking_carrier")
      .eq("id", return_id)
      .is("deleted_at", null)
      .single();

    if (fetchErr || !ret) {
      return new Response(
        JSON.stringify({ error: "החזרה לא נמצאה" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!ret.tracking_number) {
      return new Response(
        JSON.stringify({ error: "להחזרה זו אין מספר מעקב" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (ret.tracking_carrier !== "dhl") {
      return new Response(
        JSON.stringify({ error: "מעקב אוטומטי זמין רק עבור DHL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const dhlApiKey = Deno.env.get("DHL_API_KEY");
    if (!dhlApiKey) {
      return new Response(
        JSON.stringify({ error: "DHL_API_KEY לא מוגדר" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = await fetchDhlTracking(ret.tracking_number, dhlApiKey);
    const now = new Date().toISOString();

    if (!result.ok) {
      await supabaseAdmin.from("waste_supplier_returns").update({
        tracking_last_synced_at: now,
        tracking_sync_error: result.errorCode,
      }).eq("id", return_id);

      return new Response(
        JSON.stringify({ error: result.message, error_code: result.errorCode }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const p = result.payload;
    await supabaseAdmin.from("waste_supplier_returns").update({
      tracking_status_code: p.tracking_status_code,
      tracking_raw_status: p.tracking_raw_status,
      tracking_description: p.tracking_description,
      tracking_eta: p.tracking_eta,
      tracking_last_location: p.tracking_last_location,
      tracking_origin: p.tracking_origin,
      tracking_destination: p.tracking_destination,
      tracking_events: p.tracking_events,
      tracking_status: p.tracking_status,
      tracking_last_event: p.tracking_last_event,
      tracking_updated_at: now,
      tracking_last_synced_at: now,
      tracking_sync_error: null,
    }).eq("id", return_id);

    return new Response(
      JSON.stringify({
        success: true,
        tracking_status_code: p.tracking_status_code,
        tracking_description: p.tracking_description,
        tracking_eta: p.tracking_eta,
        tracking_last_location: p.tracking_last_location,
        events_count: p.tracking_events.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "שגיאה פנימית" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
