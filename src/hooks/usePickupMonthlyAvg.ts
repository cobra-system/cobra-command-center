import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Computes average monthly consumption per product from equipment pickup history
 * over the last 3 months, aggregated across all divisions.
 */
export function usePickupMonthlyAvg(): {
  avgByProduct: Map<string, number>;
  loading: boolean;
} {
  const [avgByProduct, setAvgByProduct] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 3);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    (async () => {
      // Step 1: fetch pickup IDs within the date range
      const { data: recentPickups } = await supabase
        .from("equipment_pickups")
        .select("id")
        .gte("pickup_date", cutoffStr);

      const pickupIds = (recentPickups ?? []).map((p) => p.id as string);

      if (pickupIds.length === 0) {
        setAvgByProduct(new Map());
        setLoading(false);
        return;
      }

      // Step 2: fetch all items for those pickups
      const { data: items } = await supabase
        .from("equipment_pickup_items")
        .select("product_id, quantity")
        .in("pickup_id", pickupIds);

      const totals = new Map<string, number>();
      for (const item of items ?? []) {
        const pid = item.product_id as string;
        totals.set(pid, (totals.get(pid) ?? 0) + ((item.quantity as number) ?? 0));
      }

      // Divide by 3 to get monthly average
      setAvgByProduct(
        new Map([...totals.entries()].map(([pid, t]) => [pid, Math.round((t / 3) * 10) / 10]))
      );
      setLoading(false);
    })();
  }, []);

  return { avgByProduct, loading };
}
