import { cn } from "@/lib/utils";
import type { WasteStatus, WasteReturnStatus } from "@/contexts/types";

const WASTE_STATUS: Record<WasteStatus, { label: string; className: string }> = {
  pending:   { label: "ממתין לטיפול",  className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  destroyed: { label: "הושמד",          className: "bg-red-100 text-red-800 border-red-200" },
  returning: { label: "בהחזרה לספק",   className: "bg-blue-100 text-blue-800 border-blue-200" },
  repairing: { label: "בתיקון",         className: "bg-purple-100 text-purple-800 border-purple-200" },
  sold:      { label: "נמכר",           className: "bg-green-100 text-green-800 border-green-200" },
};

const RETURN_STATUS: Record<WasteReturnStatus, { label: string; className: string }> = {
  draft:     { label: "טיוטה",             className: "bg-muted text-muted-foreground border-border" },
  shipped:   { label: "נשלח",              className: "bg-blue-100 text-blue-800 border-blue-200" },
  delivered: { label: "התקבל אצל ספק",    className: "bg-purple-100 text-purple-800 border-purple-200" },
  settled:   { label: "הוסדר",             className: "bg-green-100 text-green-800 border-green-200" },
};

export function WasteStatusBadge({ status, className }: { status: WasteStatus; className?: string }) {
  const meta = WASTE_STATUS[status] ?? WASTE_STATUS.pending;
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", meta.className, className)}>
      {meta.label}
    </span>
  );
}

export function WasteReturnStatusBadge({ status, className }: { status: WasteReturnStatus; className?: string }) {
  const meta = RETURN_STATUS[status] ?? RETURN_STATUS.draft;
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", meta.className, className)}>
      {meta.label}
    </span>
  );
}

