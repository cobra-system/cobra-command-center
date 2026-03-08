import { cn } from "@/lib/utils";
import type { OrderStatus, TaskStatus } from "@/data/mockData";
import { statusLabel, taskStatusLabel } from "@/data/mockData";

const orderColors: Record<OrderStatus, string> = {
  PENDING: "bg-muted text-muted-foreground",
  ORDERED: "bg-accent/15 text-accent",
  SHIPPED: "bg-warning/15 text-warning",
  ARRIVED: "bg-success/15 text-success",
  CANCELLED: "bg-destructive/15 text-destructive",
};

const taskColors: Record<TaskStatus, string> = {
  TODO: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-accent/15 text-accent",
  DONE: "bg-success/15 text-success",
  BLOCKED: "bg-destructive/15 text-destructive",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold", orderColors[status])}>
      {statusLabel[status]}
    </span>
  );
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold", taskColors[status])}>
      {taskStatusLabel[status]}
    </span>
  );
}
