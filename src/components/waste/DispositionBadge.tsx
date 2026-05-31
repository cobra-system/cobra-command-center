import { Badge } from "@/components/ui/badge";

export type DispositionType =
  | "השמדה"
  | "החזרה לספק"
  | "מכירה"
  | "מכירה בערוץ שלישי"
  | "אחר"
  | null
  | undefined;

interface Props {
  disposition: DispositionType;
  className?: string;
}

export function DispositionBadge({ disposition, className }: Props) {
  if (!disposition) {
    return (
      <Badge variant="secondary" className={`bg-muted text-muted-foreground ${className ?? ""}`}>
        ממתין
      </Badge>
    );
  }

  if (disposition === "השמדה") {
    return (
      <Badge variant="destructive" className={`bg-destructive/15 text-destructive border-0 ${className ?? ""}`}>
        השמדה
      </Badge>
    );
  }

  if (disposition === "החזרה לספק") {
    return (
      <Badge className={`bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 border-0 ${className ?? ""}`}>
        החזרה לספק
      </Badge>
    );
  }

  if (disposition === "מכירה" || disposition === "מכירה בערוץ שלישי") {
    return (
      <Badge className={`bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 border-0 ${className ?? ""}`}>
        מכירה בערוץ שלישי
      </Badge>
    );
  }

  if (disposition === "אחר") {
    return (
      <Badge className={`bg-purple-100 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 border-0 ${className ?? ""}`}>
        אחר
      </Badge>
    );
  }

  return null;
}

export function SupplierReturnStatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    "טיוטה": "bg-muted text-muted-foreground",
    "נשלח": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    "התקבל אצל ספק": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    "הוסדר": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  };

  return (
    <Badge className={`border-0 ${classes[status] ?? "bg-muted text-muted-foreground"}`}>
      {status}
    </Badge>
  );
}
