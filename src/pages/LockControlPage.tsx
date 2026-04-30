import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Lock,
  Unlock,
  RefreshCw,
  Printer,
  Camera,
  User2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ScanLine,
  History,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth, useData } from "@/contexts/AppContext";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BarcodeScanner } from "@/components/lock-control/BarcodeScanner";
import {
  feedbackError,
  feedbackSuccess,
  formatScanTime,
  isStale,
  nextActionFor,
  statusAfterAction,
  type LockStatus,
  type ScanAction,
} from "@/components/lock-control/lockControlUtils";
import { logActivity } from "@/lib/activityLogger";

interface WarehouseLock {
  id: number;
  name: string;
  barcode_value: string;
  sort_order: number;
  current_status: LockStatus;
  last_scan_at: string | null;
  last_scan_by: string | null;
}

interface RecentScan {
  id: string;
  lock_id: number;
  action: "open" | "close";
  scanned_by: string | null;
  scanned_at: string;
  method: "camera" | "manual";
}

const STATUS_LABEL: Record<LockStatus, string> = {
  open: "פתוח",
  closed: "סגור",
  unknown: "לא ידוע",
};

const RECENT_SCANS_LIMIT = 8;
const AUTO_REFRESH_MS = 30_000;

export default function LockControlPage() {
  const { currentUser } = useAuth();
  const { profiles } = useData();
  const isManager = currentUser?.role === "MANAGER";

  const [locks, setLocks] = useState<WarehouseLock[]>([]);
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanningLock, setScanningLock] = useState<WarehouseLock | null>(null);
  const [freeScan, setFreeScan] = useState(false);
  const submittingRef = useRef(false);
  const [pendingConfirm, setPendingConfirm] = useState<{
    lock: WarehouseLock;
    barcode: string;
    method: "camera" | "manual";
    action: ScanAction;
  } | null>(null);
  const [bulkClosing, setBulkClosing] = useState(false);

  const profileNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of profiles) map.set(p.id, p.name);
    return map;
  }, [profiles]);

  const lockByBarcode = useMemo(() => {
    const map = new Map<string, WarehouseLock>();
    for (const l of locks) map.set(l.barcode_value, l);
    return map;
  }, [locks]);

  const lockById = useMemo(() => {
    const map = new Map<number, WarehouseLock>();
    for (const l of locks) map.set(l.id, l);
    return map;
  }, [locks]);

  const refreshLocks = useCallback(async () => {
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

  const refreshRecentScans = useCallback(async () => {
    const { data } = await supabase
      .from("warehouse_lock_scans")
      .select("id, lock_id, action, scanned_by, scanned_at, method")
      .order("scanned_at", { ascending: false })
      .limit(RECENT_SCANS_LIMIT);
    setRecentScans((data ?? []) as RecentScan[]);
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([refreshLocks(), refreshRecentScans()]);
  }, [refreshLocks, refreshRecentScans]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  // Realtime subscription — watch lock status changes and new scans
  useEffect(() => {
    const channel = supabase
      .channel("lock-control-room")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "warehouse_locks" },
        () => {
          refreshLocks();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "warehouse_lock_scans" },
        () => {
          refreshRecentScans();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshLocks, refreshRecentScans]);

  // Auto-refresh fallback (in case realtime isn't connected)
  useEffect(() => {
    const interval = window.setInterval(() => {
      refresh();
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const total = locks.length;
  const closedCount = locks.filter((l) => l.current_status === "closed").length;
  const openCount = locks.filter((l) => l.current_status === "open").length;
  const closedPct = total === 0 ? 0 : Math.round((closedCount / total) * 100);
  const openPct = total === 0 ? 0 : Math.round((openCount / total) * 100);

  const handleLockClick = (lock: WarehouseLock) => {
    setScanningLock(lock);
    setFreeScan(false);
    setScannerOpen(true);
  };

  const handleFreeScan = () => {
    setScanningLock(null);
    setFreeScan(true);
    setScannerOpen(true);
  };

  const closeScanner = () => {
    setScannerOpen(false);
    setScanningLock(null);
    setFreeScan(false);
  };

  const performScan = useCallback(
    async (
      lock: WarehouseLock,
      barcodeValue: string,
      method: "camera" | "manual",
      action: ScanAction
    ): Promise<boolean> => {
      if (submittingRef.current) return false;
      submittingRef.current = true;
      try {
        const nextStatus = statusAfterAction(action);
        const now = new Date().toISOString();

        const { error: scanError } = await supabase.from("warehouse_lock_scans").insert({
          lock_id: lock.id,
          action,
          scanned_by: currentUser?.id ?? null,
          barcode_value: barcodeValue,
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
          .eq("id", lock.id);
        if (updateError) throw updateError;

        // Fire-and-forget unified audit trail (managers' audit log).
        logActivity({
          action: action === "open" ? "lock_open" : "lock_close",
          entityType: "warehouse_lock",
          details: {
            lock_id: lock.id,
            lock_name: lock.name,
            barcode_value: barcodeValue,
            method,
            previous_status: lock.current_status,
            new_status: nextStatus,
          },
        });

        feedbackSuccess();
        toast.success(
          action === "open" ? `${lock.name} סומן כפתוח` : `${lock.name} סומן כסגור`
        );
        await refresh();
        return true;
      } catch (err) {
        feedbackError();
        const message = err instanceof Error ? err.message : "שגיאה לא ידועה";
        toast.error("שגיאה בעדכון הסטטוס", { description: message });
        return false;
      } finally {
        submittingRef.current = false;
      }
    },
    [currentUser?.id, refresh]
  );

  const handleScan = useCallback(
    async (scannedValue: string, method: "camera" | "manual" = "camera") => {
      const cleaned = scannedValue.trim();
      if (!cleaned) return;

      // Free-scan mode: identify the lock by its barcode.
      if (freeScan) {
        const matched = lockByBarcode.get(cleaned);
        if (!matched) {
          feedbackError();
          toast.error("ברקוד לא מזוהה", {
            description: "ודא/י שהברקוד שייך לאחד מ-10 המנעולים שהוגדרו.",
          });
          return;
        }
        const action = nextActionFor(matched.current_status);
        // Close the scanner BEFORE the DB write + refresh, so the camera tears
        // down before parent state updates trigger a re-render cascade.
        closeScanner();
        await performScan(matched, cleaned, method, action);
        return;
      }

      // Targeted mode: must match the clicked lock exactly.
      const target = scanningLock;
      if (!target) return;
      if (cleaned !== target.barcode_value) {
        feedbackError();
        const otherLock = lockByBarcode.get(cleaned);
        toast.error(`הברקוד שנסרק אינו תואם ל"${target.name}"`, {
          description: otherLock
            ? `הברקוד שייך ל"${otherLock.name}". סרוק/י את הברקוד הנכון.`
            : "סרוק/י את הברקוד הנכון או חזור/י לדף ובחר/י את המנעול הנכון.",
        });
        return;
      }

      const action = nextActionFor(target.current_status);
      const expectedNext = statusAfterAction(action);
      // If the lock's status already equals what the toggle would produce, the
      // user is most likely confirming an already-set state (e.g. mid-day check).
      // Prompt before silently flipping it again.
      if (target.current_status !== "unknown" && target.current_status === expectedNext) {
        // (cannot happen by definition of toggle, but kept for clarity)
      }
      // Confirm if the lock was scanned very recently (within 30s) to avoid
      // accidental double-toggles when the worker scans twice.
      const lastScanMs = target.last_scan_at ? Date.now() - new Date(target.last_scan_at).getTime() : Infinity;
      if (lastScanMs < 30_000) {
        setPendingConfirm({ lock: target, barcode: cleaned, method, action });
        setScannerOpen(false);
        return;
      }

      // Close the scanner BEFORE the DB write + refresh — see comment above.
      closeScanner();
      await performScan(target, cleaned, method, action);
    },
    [freeScan, lockByBarcode, scanningLock, performScan]
  );

  const confirmPending = async () => {
    if (!pendingConfirm) return;
    const { lock, barcode, method, action } = pendingConfirm;
    setPendingConfirm(null);
    await performScan(lock, barcode, method, action);
    closeScanner();
  };

  const handleMarkAllClosed = async () => {
    if (!isManager || bulkClosing) return;
    const stillOpen = locks.filter((l) => l.current_status !== "closed");
    if (stillOpen.length === 0) {
      toast.info("כל המנעולים כבר סגורים.");
      return;
    }
    if (!window.confirm(`לסמן את כל ${stillOpen.length} המנעולים שאינם סגורים כסגורים?`)) return;

    setBulkClosing(true);
    try {
      const now = new Date().toISOString();
      const scanRows = stillOpen.map((l) => ({
        lock_id: l.id,
        action: "close" as const,
        scanned_by: currentUser?.id ?? null,
        barcode_value: l.barcode_value,
        method: "manual" as const,
        scanned_at: now,
      }));
      const { error: insertError } = await supabase.from("warehouse_lock_scans").insert(scanRows);
      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from("warehouse_locks")
        .update({
          current_status: "closed",
          last_scan_at: now,
          last_scan_by: currentUser?.id ?? null,
          updated_at: now,
        })
        .in(
          "id",
          stillOpen.map((l) => l.id)
        );
      if (updateError) throw updateError;

      logActivity({
        action: "lock_bulk_close",
        entityType: "warehouse_lock",
        details: { count: stillOpen.length, lock_ids: stillOpen.map((l) => l.id) },
      });

      feedbackSuccess();
      toast.success(`${stillOpen.length} מנעולים סומנו כסגורים`);
      await refresh();
    } catch (err) {
      feedbackError();
      const message = err instanceof Error ? err.message : "שגיאה לא ידועה";
      toast.error("שגיאה בסימון מרובה", { description: message });
    } finally {
      setBulkClosing(false);
    }
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
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleFreeScan}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <ScanLine className="h-3.5 w-3.5" />
            סריקה חופשית
          </button>
          {isManager && (
            <button
              type="button"
              onClick={handleMarkAllClosed}
              disabled={bulkClosing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
              title="סימון כל המנעולים שאינם סגורים כסגורים (מנהל בלבד)"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              סמן הכל כסגור
            </button>
          )}
          <Link
            to="/lock-control/history"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <History className="h-3.5 w-3.5" />
            היסטוריה
          </Link>
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
            const stale = isStale(lock.last_scan_at);
            const scannerName = lock.last_scan_by
              ? profileNameById.get(lock.last_scan_by) ?? "—"
              : null;
            return (
              <button
                key={lock.id}
                type="button"
                onClick={() => handleLockClick(lock)}
                className={`text-right rounded-xl border p-4 transition-all hover:shadow-md hover:-translate-y-0.5 group ${
                  stale && !isUnknown
                    ? "border-border bg-muted/20 hover:border-primary/40"
                    : isOpen
                    ? "border-warning/40 bg-warning/5 hover:border-warning/60"
                    : isClosed
                    ? "border-success/40 bg-success/5 hover:border-success/60"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">
                      #{lock.id}
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                        stale && !isUnknown
                          ? "bg-muted text-muted-foreground"
                          : isOpen
                          ? "bg-warning/15 text-warning"
                          : isClosed
                          ? "bg-success/15 text-success"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isOpen ? <Unlock className="h-3 w-3" /> : isClosed ? <Lock className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                      {STATUS_LABEL[lock.current_status]}
                    </span>
                    {stale && !isUnknown && (
                      <span className="text-[10px] text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">
                        ישן
                      </span>
                    )}
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

      {/* Recent scans feed */}
      {recentScans.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" />
                סריקות אחרונות
              </h2>
              <Link
                to="/lock-control/history"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                כל ההיסטוריה →
              </Link>
            </div>
            <ul className="divide-y divide-border/60">
              {recentScans.map((s) => {
                const lock = lockById.get(s.lock_id);
                const userName = s.scanned_by ? profileNameById.get(s.scanned_by) ?? "—" : "—";
                return (
                  <li key={s.id} className="px-4 py-2.5 flex items-center justify-between text-sm gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {s.action === "open" ? (
                        <Unlock className="h-3.5 w-3.5 text-warning shrink-0" />
                      ) : (
                        <Lock className="h-3.5 w-3.5 text-success shrink-0" />
                      )}
                      <span className="font-medium text-foreground truncate">
                        {lock?.name ?? `#${s.lock_id}`}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {s.action === "open" ? "פתיחה" : "סגירה"}
                      </span>
                      {s.method === "manual" && (
                        <span className="text-[10px] text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">
                          ידני
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                      <span className="hidden sm:inline">{userName}</span>
                      <span>{formatScanTime(s.scanned_at)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <BarcodeScanner
        open={scannerOpen}
        title={
          freeScan
            ? "סריקה חופשית"
            : scanningLock
            ? `סריקת ברקוד — ${scanningLock.name}`
            : "סריקת ברקוד"
        }
        hint={
          freeScan
            ? "סרוק/י כל ברקוד מהרשימה — המנעול יזוהה אוטומטית והסטטוס יתחלף."
            : scanningLock
            ? scanningLock.current_status === "open"
              ? "סרוק/י את הברקוד ליד המנעול לרישום סגירה"
              : "סרוק/י את הברקוד ליד המנעול לרישום פתיחה"
            : undefined
        }
        onScan={(value) => handleScan(value, "camera")}
        onManualEntry={(value) => handleScan(value, "manual")}
        onClose={closeScanner}
      />

      {pendingConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPendingConfirm(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-3">
              <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-foreground">סריקה חוזרת בתוך 30 שניות</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {pendingConfirm.lock.name} נסרק לאחרונה.
                  {" "}
                  {pendingConfirm.action === "open"
                    ? "להמשיך ולסמן כפתוח?"
                    : "להמשיך ולסמן כסגור?"}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={confirmPending}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
              >
                אישור
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
