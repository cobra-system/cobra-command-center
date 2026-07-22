import { Ship, Truck, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { DHL_LEVELS, describeStatus, normalizeLevel } from "@/lib/dhlStatusMap";
import type { Order } from "@/contexts/types";

interface TrackingBadgeProps {
  order: Order;
}

export function TrackingBadge({ order }: TrackingBadgeProps) {
  // TCLOG: no live data, just signal the carrier.
  if (order.tracking_carrier === "tclog") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium bg-purple-100 text-purple-700 whitespace-nowrap">
        <Ship className="h-3 w-3" />
        TCLOG
      </span>
    );
  }

  // DHL with normalized status code.
  if (order.tracking_carrier === "dhl" && order.tracking_status_code) {
    const level = normalizeLevel(order.tracking_status_code);
    const meta = DHL_LEVELS[level];
    const code = order.tracking_events?.[0]?.code ?? order.tracking_raw_status ?? null;
    // Show only the short Hebrew level label in the cell to keep the column
    // compact; the detailed description (often long English text from DHL)
    // surfaces on hover via title.
    const detail = describeStatus(level, code, order.tracking_description);
    return (
      <span
        title={detail}
        className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium whitespace-nowrap", meta.badgeClass)}
      >
        <Truck className="h-3 w-3" />
        {meta.he}
      </span>
    );
  }

  // DHL marked but not yet synced.
  if (order.tracking_carrier === "dhl") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium bg-muted text-muted-foreground whitespace-nowrap">
        <Truck className="h-3 w-3" />
        ממתין לסנכרון
      </span>
    );
  }

  // Tracking number present but carrier not selected — prompt the user.
  if (order.tracking_number) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium bg-amber-100 text-amber-800 whitespace-nowrap">
        <HelpCircle className="h-3 w-3" />
        בחר חברת שילוח
      </span>
    );
  }

  return <span className="text-muted-foreground">—</span>;
}
