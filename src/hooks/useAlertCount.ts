import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export function useAlertCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      const today = new Date().toISOString().split("T")[0];
      const now = new Date().toISOString();
      const [paymentsRes, etaRes] = await Promise.all([
        supabase
          .from("order_payments")
          .select("id", { count: "exact", head: true })
          .eq("status", "ממתין")
          .not("due_date", "is", null)
          .lt("due_date", today),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .not("eta", "is", null)
          .lt("eta", now)
          .not("status", "in", '("ARRIVED","DELIVERED","CANCELLED")'),
      ]);
      setCount((paymentsRes.count || 0) + (etaRes.count || 0));
    };
    fetchCount();
  }, []);

  return count;
}
