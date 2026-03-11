import { cn } from "@/lib/utils";
import { docStatusColors, payStatusColors } from "./constants";

export function DocStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", docStatusColors[status] || "bg-muted text-muted-foreground")}>
      {status}
    </span>
  );
}

export function PayStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", payStatusColors[status] || "bg-muted text-muted-foreground")}>
      {status}
    </span>
  );
}

export function DocTypeBadge({ type }: { type: string }) {
  return (
    <span className={cn("px-2 py-0.5 rounded text-xs font-bold", type === "PI" ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent")}>
      {type}
    </span>
  );
}
