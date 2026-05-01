import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";

const DHL_API_URL = "https://api-eu.dhl.com/track/shipments";

interface DhlEvent {
  timestamp: string;
  location?: { address?: { addressLocality?: string } };
  description: string;
}

interface DhlShipment {
  status?: {
    status?: string;
    description?: string;
  };
  events?: DhlEvent[];
}

interface DhlResponse {
  shipments?: DhlShipment[];
}

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

    // DHL is strict about tracking-number format: strip whitespace and dashes.
    const trackingNumber = order.tracking_number.replace(/[\s-]/g, "");

    const dhlRes = await fetch(
      `${DHL_API_URL}?trackingNumber=${encodeURIComponent(trackingNumber)}`,
      { headers: { "DHL-API-Key": dhlApiKey, "Accept": "application/json" } }
    );

    // DHL Unified Tracking API returns 404 when no shipment data is available
    // for the given tracking number — this is normal for shipments not yet
    // scanned into DHL's system. Treat as "no data yet", not as an error.
    if (dhlRes.status === 404) {
      const notFoundStatus = "לא נמצא במערכת DHL";
      await supabaseAdmin
        .from("orders")
        .update({
          tracking_status: notFoundStatus,
          tracking_last_event: null,
          tracking_updated_at: new Date().toISOString(),
        })
        .eq("id", order_id);

      return new Response(
        JSON.stringify({
          success: true,
          tracking_status: notFoundStatus,
          tracking_last_event: null,
          note: "DHL טרם מצא מידע על מספר מעקב זה — ייתכן שהמשלוח טרם נסרק במערכת",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!dhlRes.ok) {
      const errText = await dhlRes.text();
      const msg = dhlRes.status === 401
        ? "DHL API: מפתח לא תקף או פג תוקף — יש לעדכן DHL_API_KEY"
        : dhlRes.status === 429
        ? "DHL API: חרגת ממכסת הבקשות — נסה שוב מאוחר יותר"
        : `DHL API שגיאה: ${dhlRes.status}`;
      return new Response(
        JSON.stringify({ error: msg, details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dhlData = await dhlRes.json() as DhlResponse;
    const shipment = dhlData.shipments?.[0];
    const trackingStatus = shipment?.status?.status ?? null;
    const lastEvent = shipment?.events?.[0]?.description ?? shipment?.status?.description ?? null;

    await supabaseAdmin
      .from("orders")
      .update({
        tracking_status: trackingStatus,
        tracking_last_event: lastEvent,
        tracking_updated_at: new Date().toISOString(),
      })
      .eq("id", order_id);

    return new Response(
      JSON.stringify({ success: true, tracking_status: trackingStatus, tracking_last_event: lastEvent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "שגיאה פנימית" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
