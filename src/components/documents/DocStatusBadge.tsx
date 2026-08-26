import { cn } from "@/lib/utils";
import { docStatusColors, payStatusColors, docSubtypeColors, docSubtypeLabels } from "./constants";

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

/**
 * Subtype chip (SWIFT, BL, invoice…). Renders nothing when the subtype adds no
 * information beyond the document type itself (PI documents with subtype PI).
 */
export function DocSubtypeBadge({ type, subtype }: { type?: string; subtype?: string | null }) {
  if (!subtype || subtype === type) return null;
  return (
    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold leading-none", docSubtypeColors[subtype] || "bg-muted text-muted-foreground")}>
      {docSubtypeLabels[subtype] || subtype}
    </span>
  );
}
