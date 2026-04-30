import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Download, Filter, Lock, Unlock, RefreshCw, User2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useData } from "@/contexts/AppContext";
import { Card, CardContent } from "@/components/ui/card";
import { downloadCsv, formatScanTime } from "@/components/lock-control/lockControlUtils";

interface LockRef {
  id: number;
  name: string;
}

interface ScanRow {
  id: string;
  lock_id: number;
  action: "open" | "close";
  scanned_by: string | null;
  barcode_value: string;
  method: "camera" | "manual";
  scanned_at: string;
}

const PAGE_SIZE = 100;

function isoDateInputToFromTs(value: string): string | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00`).toISOString();
}

function isoDateInputToToTs(value: string): string | null {
  if (!value) return null;
  return new Date(`${value}T23:59:59.999`).toISOString();
}

export default function LockControlHistoryPage() {
  const { profiles } = useData();
  const [locks, setLocks] = useState<LockRef[]>([]);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [lockFilter, setLockFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<"all" | "open" | "close">("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const profileNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of profiles) map.set(p.id, p.name);
    return map;
  }, [profiles]);

  const lockNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const l of locks) map.set(l.id, l.name);
    return map;
  }, [locks]);

  const refresh = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("warehouse_lock_scans")
      .select("id, lock_id, action, scanned_by, barcode_value, method, scanned_at")
      .order("scanned_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (lockFilter !== "all") query = query.eq("lock_id", Number(lockFilter));
    if (actionFilter !== "all") query = query.eq("action", actionFilter);
    if (userFilter !== "all") query = query.eq("scanned_by", userFilter);
    const fromTs = isoDateInputToFromTs(fromDate);
    const toTs = isoDateInputToToTs(toDate);
    if (fromTs) query = query.gte("scanned_at", fromTs);
    if (toTs) query = query.lte("scanned_at", toTs);

    const { data, error } = await query;
    if (error) {
      toast.error("שגיאה בטעינת ההיסטוריה");
      setLoading(false);
      return;
    }
    setScans((data ?? []) as ScanRow[]);
    setLoading(false);
  }, [lockFilter, actionFilter, userFilter, fromDate, toDate]);

  useEffect(() => {
    supabase
      .from("warehouse_locks")
      .select("id, name")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => setLocks((data ?? []) as LockRef[]));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleExport = () => {
    const rows: string[][] = [
      ["תאריך ושעה", "מנעול", "פעולה", "משתמש", "שיטה", "קוד"],
      ...scans.map((s) => [
        formatScanTime(s.scanned_at),
        lockNameById.get(s.lock_id) ?? `#${s.lock_id}`,
        s.action === "open" ? "פתיחה" : "סגירה",
        s.scanned_by ? profileNameById.get(s.scanned_by) ?? "—" : "—",
        s.method === "camera" ? "מצלמה" : "ידני",
        s.barcode_value,
      ]),
    ];
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`lock-control-history-${stamp}.csv`, rows);
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/lock-control"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-1"
          >
            <ArrowRight className="h-3 w-3 rotate-180" />
            חזרה לבקרת נעילה
          </Link>
          <h1 className="text-2xl font-bold text-foreground">היסטוריית סריקות נעילה</h1>
          <p className="text-sm text-muted-foreground mt-1">
            לוג מלא של כל פעולות הפתיחה והסגירה (עד {PAGE_SIZE} רשומות אחרונות לפי הסינון).
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
          <button
            type="button"
            onClick={handleExport}
            disabled={scans.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            יצוא CSV
          </button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            סינון
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">מנעול</span>
              <select
                value={lockFilter}
                onChange={(e) => setLockFilter(e.target.value)}
                className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-sm"
              >
                <option value="all">הכל</option>
                {locks.map((l) => (
                  <option key={l.id} value={l.id}>
                    #{l.id} — {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">פעולה</span>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value as "all" | "open" | "close")}
                className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-sm"
              >
                <option value="all">הכל</option>
                <option value="open">פתיחה</option>
                <option value="close">סגירה</option>
              </select>
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">משתמש</span>
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-sm"
              >
                <option value="all">הכל</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">מתאריך</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-sm"
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">עד תאריך</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-sm"
              />
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-right p-3 font-semibold">תאריך ושעה</th>
                <th className="text-right p-3 font-semibold">מנעול</th>
                <th className="text-right p-3 font-semibold">פעולה</th>
                <th className="text-right p-3 font-semibold">משתמש</th>
                <th className="text-right p-3 font-semibold">שיטה</th>
                <th className="text-right p-3 font-semibold">קוד</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground text-sm">
                    טוען...
                  </td>
                </tr>
              ) : scans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground text-sm">
                    אין רשומות בטווח שנבחר.
                  </td>
                </tr>
              ) : (
                scans.map((s) => (
                  <tr key={s.id} className="border-b border-border/60 hover:bg-muted/30">
                    <td className="p-3 whitespace-nowrap">{formatScanTime(s.scanned_at)}</td>
                    <td className="p-3">
                      <span className="text-xs font-mono text-muted-foreground me-1">#{s.lock_id}</span>
                      {lockNameById.get(s.lock_id) ?? "—"}
                    </td>
                    <td className="p-3">
                      {s.action === "open" ? (
                        <span className="inline-flex items-center gap-1 text-warning text-xs font-medium">
                          <Unlock className="h-3 w-3" /> פתיחה
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-success text-xs font-medium">
                          <Lock className="h-3 w-3" /> סגירה
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {s.scanned_by ? (
                        <span className="inline-flex items-center gap-1">
                          <User2 className="h-3 w-3 text-muted-foreground" />
                          {profileNameById.get(s.scanned_by) ?? "—"}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {s.method === "camera" ? "מצלמה" : "ידני"}
                    </td>
                    <td className="p-3 text-xs font-mono text-muted-foreground">{s.barcode_value}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
