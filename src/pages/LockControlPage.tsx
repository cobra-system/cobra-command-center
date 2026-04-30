import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Lock, Unlock, RefreshCw, Printer, Camera, User2, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth, useData } from "@/contexts/AppContext";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BarcodeScanner } from "@/components/lock-control/BarcodeScanner";

type LockStatus = "open" | "closed" | "unknown";

interface WarehouseLock {
  id: number;
  name: string;
  barcode_value: string;
  sort_order: number;
  current_status: LockStatus;
  last_scan_at: string | null;
  last_scan_by: string | null;
}

const STATUS_LABEL: Record<LockStatus, string> = {
  open: "פתוח",
  closed: "סגור",
  unknown: "לא ידוע",
};

function formatScanTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LockControlPage() {
  const { currentUser } = useAuth();
  const { profiles } = useData();
  const [locks, setLocks] = useState<WarehouseLock[]>([]);
  const [loading, setLoading] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanningLock, setScanningLock] = useState<WarehouseLock | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const profileNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of profiles) map.set(p.id, p.name);
    return map;
  }, [profiles]);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("warehouse_locks")
      .select("id, name, barcode_value, sort_order, current_status, last_scan_at, last_scan_by")
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      toast.error("שגיאה בטעינת המנעולים");
      return;
    }
    setLocks((data ?? []) as WarehouseLock[]);
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const total = locks.length;
  const closedCount = locks.filter((l) => l.current_status === "closed").length;
  const openCount = locks.filter((l) => l.current_status === "open").length;
  const closedPct = total === 0 ? 0 : Math.round((closedCount / total) * 100);
  const openPct = total === 0 ? 0 : Math.round((openCount / total) * 100);

  const handleLockClick = (lock: WarehouseLock) => {
    setScanningLock(lock);
    setScannerOpen(true);
  };

  const handleScan = useCallback(
    async (scannedValue: string, method: "camera" | "manual" = "camera") => {
      const target = scanningLock;
      if (!target || submitting) return;

      const cleaned = scannedValue.trim();
      if (cleaned !== target.barcode_value) {
        toast.error(`הברקוד שנסרק אינו תואם ל"${target.name}"`, {
          description: `סרוק/י את הברקוד ליד המנעול הנכון.`,
        });
        return;
      }

      setSubmitting(true);
      try {
        // Toggle: closed → open, open → close, unknown → close (assume locking)
        const nextAction: "open" | "close" =
          target.current_status === "open" ? "close" : "open";
        const nextStatus: LockStatus = nextAction === "open" ? "open" : "closed";
        const now = new Date().toISOString();

        const { error: scanError } = await supabase.from("warehouse_lock_scans").insert({
          lock_id: target.id,
          action: nextAction,
          scanned_by: currentUser?.id ?? null,
          barcode_value: cleaned,
          method,
          scanned_at: now,
        });
        if (scanError) throw scanError;

        const { error: updateError } = await supabase
          .from("warehouse_locks")
          .update({
            current_status: nextStatus,
            last_scan_at: now,
            last_scan_by: currentUser?.id ?? null,
            updated_at: now,
          })
          .eq("id", target.id);
        if (updateError) throw updateError;

        toast.success(
          nextAction === "open" ? `${target.name} סומן כפתוח` : `${target.name} סומן כסגור`
        );
        setScannerOpen(false);
        setScanningLock(null);
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "שגיאה לא ידועה";
        toast.error("שגיאה בעדכון הסטטוס", { description: message });
      } finally {
        setSubmitting(false);
      }
    },
    [scanningLock, submitting, currentUser?.id, refresh]
  );

  const closeScanner = () => {
    setScannerOpen(false);
    setScanningLock(null);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">בקרת נעילה</h1>
          <p className="text-sm text-muted-foreground mt-1">
            סריקת ברקוד ליד כל מנעול לרישום פתיחה/סגירה — קוברה תל אביב
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refresh()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            רענון
          </button>
          <Link
            to="/lock-control/print"
            target="_blank"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            הדפסת ברקודים
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="font-medium text-foreground flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" />
                  סגירה
                </span>
                <span className="text-muted-foreground">
                  {closedCount}/{total} ({closedPct}%)
                </span>
              </div>
              <Progress value={closedPct} className="h-3" />
            </div>
            <div>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="font-medium text-foreground flex items-center gap-1.5">
                  <Unlock className="h-3.5 w-3.5" />
                  פתיחה
                </span>
                <span className="text-muted-foreground">
                  {openCount}/{total} ({openPct}%)
                </span>
              </div>
              <Progress value={openPct} className="h-3" />
            </div>
          </div>
          {closedCount === total && total > 0 && (
            <div className="flex items-center gap-2 text-sm text-success bg-success/10 px-3 py-2 rounded-lg">
              <CheckCircle2 className="h-4 w-4" />
              כל המנעולים סגורים — סבב הסגירה הושלם.
            </div>
          )}
          {openCount === total && total > 0 && (
            <div className="flex items-center gap-2 text-sm text-success bg-success/10 px-3 py-2 rounded-lg">
              <CheckCircle2 className="h-4 w-4" />
              כל המנעולים פתוחים — סבב הפתיחה הושלם.
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 rounded-lg border border-border bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {locks.map((lock) => {
            const isOpen = lock.current_status === "open";
            const isClosed = lock.current_status === "closed";
            const isUnknown = lock.current_status === "unknown";
            const scannerName = lock.last_scan_by ? profileNameById.get(lock.last_scan_by) ?? "—" : null;
            return (
              <button
                key={lock.id}
                type="button"
                onClick={() => handleLockClick(lock)}
                className={`text-right rounded-xl border p-4 transition-all hover:shadow-md hover:-translate-y-0.5 group ${
                  isOpen
                    ? "border-warning/40 bg-warning/5 hover:border-warning/60"
                    : isClosed
                    ? "border-success/40 bg-success/5 hover:border-success/60"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">
                      #{lock.id}
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                        isOpen
                          ? "bg-warning/15 text-warning"
                          : isClosed
                          ? "bg-success/15 text-success"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isOpen ? <Unlock className="h-3 w-3" /> : isClosed ? <Lock className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                      {STATUS_LABEL[lock.current_status]}
                    </span>
                  </div>
                  <Camera className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>

                <h3 className="font-semibold text-foreground text-base leading-tight mb-2">{lock.name}</h3>

                <div className="space-y-1 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    <span>{isUnknown ? "טרם נסרק" : formatScanTime(lock.last_scan_at)}</span>
                  </div>
                  {scannerName && (
                    <div className="flex items-center gap-1.5">
                      <User2 className="h-3 w-3" />
                      <span>{scannerName}</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <BarcodeScanner
        open={scannerOpen}
        title={
          scanningLock
            ? `סריקת ברקוד — ${scanningLock.name}`
            : "סריקת ברקוד"
        }
        hint={
          scanningLock
            ? scanningLock.current_status === "open"
              ? "סרוק/י את הברקוד ליד המנעול לרישום סגירה"
              : "סרוק/י את הברקוד ליד המנעול לרישום פתיחה"
            : undefined
        }
        onScan={(value) => {
          if (!submitting) handleScan(value, "camera");
        }}
        onManualEntry={(value) => {
          if (!submitting) handleScan(value, "manual");
        }}
        onClose={closeScanner}
      />
    </div>
  );
}
