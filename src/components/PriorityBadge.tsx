import React from "react";
import { cn } from "@/lib/utils";
import type { Priority } from "@/contexts/AppContext";

const colors: Record<Priority, string> = {
  "דחוף": "priority-urgent",
  "גבוה": "priority-high",
  "בינוני": "priority-medium",
  "נמוך": "priority-low",
};

export const PriorityBadge = React.forwardRef<HTMLSpanElement, { priority: Priority; className?: string }>(
  ({ priority, className, ...props }, ref) => {
    return (
      <span ref={ref} className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold", colors[priority] || "priority-medium", className)} {...props}>
        {priority}
      </span>
    );
  }
);
PriorityBadge.displayName = "PriorityBadge";
