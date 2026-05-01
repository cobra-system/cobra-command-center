import { Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { DHL_LEVELS, describeStatus, normalizeLevel } from "@/lib/dhlStatusMap";
import type { Order } from "@/contexts/types";

interface TrackingBadgeProps {
  order: Order;
}

export function TrackingBadge({ order }: TrackingBadgeProps) {
  // Prefer the new normalized status_code; fall back to legacy string-match for orders not yet re-synced.
  if (order.tracking_status_code) {
    const level = normalizeLevel(order.tracking_status_code);
    const meta = DHL_LEVELS[level];
    const code = order.tracking_events?.[0]?.code ?? order.tracking_raw_status ?? null;
    const text = describeStatus(level, code, order.tracking_description);
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium", meta.badgeClass)}>
        <Truck className="h-3 w-3" />
        {text}
      </span>
    );
  }

  if (order.tracking_status) {
    const lc = order.tracking_status.toLowerCase();
    const cls = lc.includes("delivered") || lc.includes("נמסר") ? "bg-green-100 text-green-700"
      : lc.includes("transit") || lc.includes("shipment") || lc.includes("בדרך") ? "bg-blue-100 text-blue-700"
      : lc.includes("exception") || lc.includes("failure") || lc.includes("תקלה") ? "bg-red-100 text-red-700"
      : "bg-muted text-muted-foreground";
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium", cls)}>
        <Truck className="h-3 w-3" />
        {order.tracking_status}
      </span>
    );
  }

  return <span className="text-muted-foreground">—</span>;
}
