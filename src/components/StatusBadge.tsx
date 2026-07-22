import React from "react";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/contexts/types";
import type { TaskStatus } from "@/data/mockData";
import { statusLabel, taskStatusLabel } from "@/data/mockData";

const orderColors: Record<OrderStatus, string> = {
  PENDING:           "bg-muted text-muted-foreground",
  ORDERED:           "bg-accent/15 text-accent",
  SHIPPED:           "bg-warning/15 text-warning",
  ARRIVED_PORT:      "bg-blue-100 text-blue-700",
  CUSTOMS_CLEARANCE: "bg-warning/15 text-warning",
  DELIVERED:         "bg-success/15 text-success",
  ARRIVED:           "bg-success/15 text-success",
  CANCELLED:         "bg-destructive/15 text-destructive",
};

const taskColors: Record<TaskStatus, string> = {
  TODO: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-accent/15 text-accent",
  DONE: "bg-success/15 text-success",
  BLOCKED: "bg-destructive/15 text-destructive",
};

export const OrderStatusBadge = React.forwardRef<HTMLSpanElement, { status: OrderStatus; className?: string }>(
  ({ status, className, ...props }, ref) => (
    <span ref={ref} className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold", orderColors[status], className)} {...props}>
      {statusLabel[status]}
    </span>
  )
);
OrderStatusBadge.displayName = "OrderStatusBadge";

export const TaskStatusBadge = React.forwardRef<HTMLSpanElement, { status: TaskStatus; className?: string }>(
  ({ status, className, ...props }, ref) => (
    <span ref={ref} className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold", taskColors[status], className)} {...props}>
      {taskStatusLabel[status]}
    </span>
  )
);
TaskStatusBadge.displayName = "TaskStatusBadge";
