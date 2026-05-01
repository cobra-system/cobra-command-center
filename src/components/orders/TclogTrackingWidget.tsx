import { Ship } from "lucide-react";
import type { Order } from "@/contexts/types";

interface TclogTrackingWidgetProps {
  order: Order;
}

export function TclogTrackingWidget({ order }: TclogTrackingWidgetProps) {
  // Either an explicit TCLOG reference, or a tracking_number that the user
  // marked as TCLOG (since tracking_number is a generic field — DHL or TCLOG).
  const reference = order.tclog_reference
    ?? (order.tracking_carrier === "tclog" ? order.tracking_number : null);
  if (!reference) return null;

  return (
    <div className="bg-card rounded-xl border shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <Ship className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">מעקב TCLOG</h2>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">אסמכתא:</span>
        <span className="text-sm font-semibold font-mono">{reference}</span>
      </div>
    </div>
  );
}
