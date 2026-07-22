import { useState, useMemo } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { Order } from "@/contexts/types";

interface TrackingSyncErrorsBannerProps {
  orders: Order[];
  onShowFailed: () => void;
}

const DISMISS_KEY = "tracking:sync-errors-dismissed";

const ERROR_DESCRIPTIONS: Record<string, string> = {
  unauthorized: "מפתח DHL לא תקף או פג תוקף — יש לעדכן את DHL_API_KEY",
  rate_limited: "DHL חרגה ממכסת הבקשות היומית — נסה מאוחר יותר",
  exception: "שגיאה לא צפויה בעיבוד תשובת DHL",
};

export function TrackingSyncErrorsBanner({ orders, onShowFailed }: TrackingSyncErrorsBannerProps) {
  const [dismissedAt, setDismissedAt] = useState<string | null>(() => sessionStorage.getItem(DISMISS_KEY));

  const errored = useMemo(
    () => orders.filter(o => o.tracking_carrier === "dhl" && o.tracking_sync_error),
    [orders],
  );

  // Group by error code so we can describe what's happening.
  const breakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of errored) {
      const code = o.tracking_sync_error || "unknown";
      map.set(code, (map.get(code) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [errored]);

  if (errored.length === 0) return null;
  if (dismissedAt) return null;

  const dismiss = () => {
    const ts = String(Date.now());
    sessionStorage.setItem(DISMISS_KEY, ts);
    setDismissedAt(ts);
  };

  const hasUnauthorized = breakdown.some(([code]) => code === "unauthorized");
  const variant = hasUnauthorized ? "destructive" as const : "default" as const;

  return (
    <Alert variant={variant} className="relative">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{errored.length} הזמנות נכשלו בסנכרון מעקב DHL</AlertTitle>
      <AlertDescription className="space-y-2">
        <ul className="text-xs space-y-0.5 mt-1">
          {breakdown.map(([code, count]) => (
            <li key={code}>
              <span className="font-mono">{code}</span> — {ERROR_DESCRIPTIONS[code] ?? `שגיאה: ${code}`} <span className="opacity-70">({count} הזמנות)</span>
            </li>
          ))}
        </ul>
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={onShowFailed}>הצג הזמנות שנכשלו</Button>
          <Button size="sm" variant="ghost" onClick={dismiss}>התעלם</Button>
        </div>
      </AlertDescription>
      <button onClick={dismiss} className="absolute top-2 left-2 p-1 hover:bg-foreground/10 rounded" aria-label="סגור">
        <X className="h-3.5 w-3.5" />
      </button>
    </Alert>
  );
}
