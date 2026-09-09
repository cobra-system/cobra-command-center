/**
 * The most recent goods-receipt mail sent for one order.
 *
 * The order header shows it so a second person opening the order can see the
 * clerk was already told — the mistake this feature is meant to prevent is
 * sending the same arrival twice, not forgetting to send it.
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface LastGoodsReceiptEmail {
  id: string;
  created_at: string;
  recipient_email: string;
  sent_by_name: string | null;
}

export function useLastGoodsReceiptEmail(orderId: string | undefined) {
  const [latest, setLatest] = useState<LastGoodsReceiptEmail | null>(null);

  const refresh = useCallback(async () => {
    if (!orderId) { setLatest(null); return; }
    const { data } = await supabase
      .from("goods_receipt_emails")
      .select("id, created_at, recipient_email, sent_by_name")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLatest((data as LastGoodsReceiptEmail | null) ?? null);
  }, [orderId]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { latest, refresh };
}
