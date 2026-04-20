import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Order } from "@/contexts/types";

interface PaymentTotals {
  monthly: number;
  quarterly: number;
  currency: string;
  loading: boolean;
}

export function useProductSupplierPayments(productId: string, relatedOrders: Order[]): PaymentTotals {
  const orderIds = relatedOrders.map(o => o.id);

  const { data, isLoading } = useQuery({
    queryKey: ["product-supplier-payments", productId],
    enabled: orderIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: payments } = await supabase
        .from("order_payments")
        .select("order_id, amount, currency, paid_date, status")
        .in("order_id", orderIds)
        .eq("status", "שולם")
        .not("paid_date", "is", null);

      return payments ?? [];
    },
  });

  if (isLoading || !data || orderIds.length === 0) {
    return { monthly: 0, quarterly: 0, currency: "USD", loading: isLoading };
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);

  // Build a lookup of product's proportion per order
  // proportion = (product item value) / order total price
  const proportionByOrder: Record<string, number> = {};
  for (const order of relatedOrders) {
    const item = order.items.find(i => i.product_id === productId);
    if (!item || !order.total_price || order.total_price === 0) {
      proportionByOrder[order.id] = 1;
      continue;
    }
    const itemValue = (item.price ?? 0) * (item.qty ?? 1);
    proportionByOrder[order.id] = itemValue / order.total_price;
  }

  let monthly = 0;
  let quarterly = 0;
  let currency = "USD";

  for (const p of data) {
    if (!p.paid_date) continue;
    const paidDate = new Date(p.paid_date);
    const amount = Number(p.amount ?? 0);
    const proportion = proportionByOrder[p.order_id] ?? 1;
    const attributed = amount * proportion;
    currency = p.currency ?? "USD";

    if (paidDate >= startOfMonth) monthly += attributed;
    if (paidDate >= startOfQuarter) quarterly += attributed;
  }

  return { monthly, quarterly, currency, loading: false };
}
