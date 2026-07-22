import { useState } from "react";
import { Ship, ChevronDown, ChevronUp } from "lucide-react";
import type { Order } from "@/contexts/types";

interface TclogTrackingWidgetProps {
  order: Order;
}

export function TclogTrackingWidget({ order }: TclogTrackingWidgetProps) {
  // Either an explicit TCLOG reference, or a tracking_number that the user
  // marked as TCLOG (since tracking_number is a generic field — DHL or TCLOG).
  const reference = order.tclog_reference
    ?? (order.tracking_carrier === "tclog" ? order.tracking_number : null);
  const [expanded, setExpanded] = useState(false);
  if (!reference) return null;

  return (
    <div className="bg-card rounded-xl border shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full p-5 flex items-center justify-between gap-3 flex-wrap text-right hover:bg-muted/20 transition-colors rounded-xl"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Ship className="h-5 w-5 text-primary shrink-0" />
          <h2 className="text-lg font-semibold text-foreground">מעקב TCLOG</h2>
          <span className="text-sm font-semibold font-mono truncate">{reference}</span>
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground" />
        }
      </button>

      {expanded && (
        <div className="px-5 pb-5">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">אסמכתא:</span>
            <span className="text-sm font-semibold font-mono">{reference}</span>
          </div>
        </div>
      )}
    </div>
  );
}
