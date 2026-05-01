import { useState } from "react";
import { Ship, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Order } from "@/contexts/types";

interface TclogTrackingWidgetProps {
  order: Order;
}

export function TclogTrackingWidget({ order }: TclogTrackingWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Either an explicit TCLOG reference, or a tracking_number that the user
  // marked as TCLOG (since tracking_number is a generic field — DHL or TCLOG).
  const reference = order.tclog_reference
    ?? (order.tracking_carrier === "tclog" ? order.tracking_number : null);
  if (!reference) return null;

  return (
    <div className="bg-card rounded-xl border shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen(o => !o)}
        aria-expanded={isOpen}
        className="w-full p-5 flex items-center justify-between gap-3 flex-wrap hover:bg-muted/20 transition-colors text-right"
      >
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Ship className="h-5 w-5 text-primary shrink-0" />
          <h2 className="text-lg font-semibold text-foreground">מעקב TCLOG</h2>
          <span className="text-xs text-muted-foreground font-mono">{reference}</span>
        </div>
        <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform shrink-0", isOpen && "rotate-180")} />
      </button>
      {isOpen && (
        <div className="px-5 pb-5 border-t pt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">אסמכתא:</span>
            <span className="text-sm font-semibold font-mono">{reference}</span>
          </div>
        </div>
      )}
    </div>
  );
}
