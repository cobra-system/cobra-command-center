import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Server } from "lucide-react";

interface SapSyncBadgeProps {
  sapCode?: string | null;
  className?: string;
}

export default function SapSyncBadge({ sapCode, className }: SapSyncBadgeProps) {
  if (sapCode) {
    return (
      <Badge variant="outline" className={`gap-1 text-xs border-emerald-500/30 text-emerald-600 dark:text-emerald-400 ${className || ""}`}>
        <CheckCircle className="h-3 w-3" />
        SAP: {sapCode}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={`gap-1 text-xs border-muted-foreground/30 text-muted-foreground ${className || ""}`}>
      <Server className="h-3 w-3" />
      לא מקושר ל-SAP
    </Badge>
  );
}
