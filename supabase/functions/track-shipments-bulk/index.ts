import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { fetchDhlTracking, persistTracking, persistTrackingError } from "../_shared/dhlParse.ts";

const MAX_ORDERS_PER_CALL = 50;
const CONCURRENCY = 4;

async function processInPool<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = index++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]);
    }
  });
  await Promise.all(runners);
  return results;
}

interface OrderRow {
  id: string;
  tracking_number: string | null;
}

interface PerOrderResult {
  order_id: string;
  ok: boolean;
  status_code?: string;
  error?: string;
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

    const body = await req.json() as { order_ids?: string[] };
    const orderIds = (body.order_ids ?? []).filter(id => typeof id === "string" && id.length > 0);
    if (orderIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "order_ids נדרש" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (orderIds.length > MAX_ORDERS_PER_CALL) {
      return new Response(
        JSON.stringify({ error: `מקסימום ${MAX_ORDERS_PER_CALL} הזמנות לקריאה` }),
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

    const { supabaseAdmin } = authResult.auth;
    const { data: orders, error: fetchErr } = await supabaseAdmin
      .from("orders")
      .select("id, tracking_number")
      .in("id", orderIds);

    if (fetchErr) {
      return new Response(
        JSON.stringify({ error: "שגיאה בשליפת הזמנות" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const trackable = (orders as OrderRow[] | null ?? []).filter(o => !!o.tracking_number);

    const perOrder = await processInPool<OrderRow, PerOrderResult>(trackable, CONCURRENCY, async (order) => {
      try {
        const result = await fetchDhlTracking(order.tracking_number!, dhlApiKey);
        if (!result.ok) {
          await persistTrackingError(supabaseAdmin, order.id, result.errorCode);
          return { order_id: order.id, ok: false, error: result.errorCode };
        }
        await persistTracking(supabaseAdmin, order.id, result.payload);
        return { order_id: order.id, ok: true, status_code: result.payload.tracking_status_code };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "internal";
        await persistTrackingError(supabaseAdmin, order.id, "exception");
        return { order_id: order.id, ok: false, error: msg };
      }
    });

    const updated = perOrder.filter(r => r.ok).length;
    const failed = perOrder.filter(r => !r.ok);

    return new Response(
      JSON.stringify({
        success: true,
        requested: orderIds.length,
        processed: trackable.length,
        updated,
        failed,
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
