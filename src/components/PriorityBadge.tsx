import { cn } from "@/lib/utils";
import type { Priority } from "@/data/mockData";

const colors: Record<Priority, string> = {
  P0: "priority-p0",
  P1: "priority-p1",
  P2: "priority-p2",
  P3: "priority-p3",
};

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold", colors[priority], className)}>
      {priority}
    </span>
  );
}
