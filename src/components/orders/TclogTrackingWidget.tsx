import { Ship } from "lucide-react";
import type { Order } from "@/contexts/types";

interface TclogTrackingWidgetProps {
  order: Order;
}

export function TclogTrackingWidget({ order }: TclogTrackingWidgetProps) {
  if (!order.tclog_reference) return null;

  return (
    <div className="bg-card rounded-xl border shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <Ship className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">מעקב TCLOG</h2>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">אסמכתא:</span>
        <span className="text-sm font-semibold font-mono">{order.tclog_reference}</span>
      </div>
    </div>
  );
}
