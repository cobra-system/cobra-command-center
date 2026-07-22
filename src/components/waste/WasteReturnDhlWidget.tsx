/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import {
  RefreshCw, Truck, MapPin, Calendar, AlertTriangle, Check,
  Package, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import {
  DHL_LEVELS,
  DHL_PROGRESS_STAGES,
  describeEvent,
  describeStatus,
  normalizeLevel,
  stageIndexForEvent,
  type TrackingLevel,
} from "@/lib/dhlStatusMap";
import type { WasteSupplierReturn } from "@/contexts/types";

interface Props {
  ret: WasteSupplierReturn;
  onRefreshed: () => void;
}

function fmt(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : format(d, "dd/MM/yyyy HH:mm");
}

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : format(d, "dd/MM/yyyy");
}

function ProgressBar({ level, eventCode }: { level: TrackingLevel; eventCode: string | null | undefined }) {
  const idx = stageIndexForEvent(eventCode, level);
  const isException = idx === -1;
  return (
    <div className="flex items-center gap-1">
      {DHL_PROGRESS_STAGES.map((stage, i) => {
        const reached = !isException && idx >= i;
        const current = !isException && idx === i;
        return (
          <div key={stage.key} className="flex items-center gap-1 flex-1">
            <div className="flex flex-col items-center gap-1 flex-1">
              <div className={cn(
                "h-2.5 w-2.5 rounded-full border-2 transition-colors",
                isException ? "border-red-300 bg-red-100"
                  : reached ? "border-primary bg-primary"
                  : "border-muted-foreground/30 bg-background",
                current && "ring-2 ring-primary/30",
              )} />
              <span className={cn("text-[10px] whitespace-nowrap", reached ? "text-foreground font-medium" : "text-muted-foreground")}>
                {stage.he}
              </span>
            </div>
            {i < DHL_PROGRESS_STAGES.length - 1 && (
              <div className={cn("h-0.5 flex-1 rounded-full -mt-3", reached && !isException ? "bg-primary" : "bg-muted-foreground/20")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-0.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />{label}
      </div>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

export function WasteReturnDhlWidget({ ret, onRefreshed }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const level = normalizeLevel(ret.tracking_status_code);
  const meta = DHL_LEVELS[level];
  const headlineCode = (ret.tracking_events as any)?.[0]?.code ?? ret.tracking_raw_status ?? null;
  const headline = describeStatus(level, headlineCode, ret.tracking_description);

  // Suggest marking as delivered when DHL reports delivery
  useEffect(() => {
    if (level !== "delivered") return;
    if (ret.status === "delivered" || ret.status === "settled") return;
    const key = `waste-return:delivered-suggested:${ret.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    toast.info("DHL מדווח שהמשלוח הגיע. לסמן החזרה כ'התקבל אצל ספק'?", { duration: 20000 });
  }, [level, ret.id, ret.status]);

  const events = (ret.tracking_events as any[]) ?? [];
  const hasData = !!(ret.tracking_status_code || ret.tracking_description || events.length);

  async function handleRefresh() {
    if (!ret.tracking_number || loading) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-waste-return`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ return_id: ret.id }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "שגיאת רענון מעקב");
      } else {
        toast.success("מעקב עודכן");
        onRefreshed();
      }
    } catch {
      toast.error("שגיאת רשת");
    } finally {
      setLoading(false);
    }
  }

  const Icon = level === "delivered" ? Check
    : level === "failure" ? AlertTriangle
    : level === "transit" ? Truck
    : Package;

  return (
    <div className="bg-card rounded-xl border shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full p-5 flex items-center justify-between gap-3 flex-wrap text-right hover:bg-muted/20 transition-colors rounded-xl"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Truck className="h-5 w-5 text-primary shrink-0" />
          <h2 className="text-lg font-semibold text-foreground">מעקב DHL</h2>
          {ret.tracking_number && (
            <span className="text-xs text-muted-foreground font-mono truncate">{ret.tracking_number}</span>
          )}
          {hasData && (
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", meta.badgeClass)}>
              <Icon className="h-3 w-3" />{meta.he}
            </span>
          )}
          {ret.tracking_eta && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />{fmtDate(ret.tracking_eta)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            role="button" tabIndex={0}
            onClick={e => { e.stopPropagation(); handleRefresh(); }}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); handleRefresh(); } }}
            aria-disabled={loading}
            className={cn(
              "inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border rounded-lg px-3 py-1.5 transition-colors hover:bg-muted/30",
              loading && "opacity-50 pointer-events-none",
            )}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            רענן מעקב
          </span>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5">
          {!hasData && <p className="text-sm text-muted-foreground">טרם בוצע עדכון מעקב — לחץ "רענן מעקב"</p>}

          {hasData && (
            <>
              <div className="flex items-center gap-3 flex-wrap mb-4">
                <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold", meta.badgeClass)}>
                  <Icon className="h-4 w-4" />{meta.he}
                </span>
                <span className={cn("text-sm", meta.textClass)}>{headline}</span>
              </div>

              <div className="mb-5">
                <ProgressBar level={level} eventCode={headlineCode} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                {ret.tracking_eta && <InfoCard icon={Calendar} label="הגעה משוערת" value={fmtDate(ret.tracking_eta)} />}
                {ret.tracking_last_location && <InfoCard icon={MapPin} label="מיקום אחרון" value={ret.tracking_last_location} />}
                {ret.tracking_origin && <InfoCard icon={MapPin} label="מוצא" value={ret.tracking_origin} />}
                {ret.tracking_destination && <InfoCard icon={MapPin} label="יעד" value={ret.tracking_destination} />}
                {ret.tracking_last_synced_at && <InfoCard icon={RefreshCw} label="עודכן" value={fmt(ret.tracking_last_synced_at)} />}
              </div>

              {ret.tracking_sync_error && (
                <div className="flex items-start gap-2 mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold mb-0.5">שגיאת סנכרון אחרונה</div>
                    <div className="font-mono">{ret.tracking_sync_error}</div>
                  </div>
                </div>
              )}

              {events.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-2">היסטוריית אירועים</div>
                  <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {events.slice(0, 10).map((ev: any, i: number) => (
                      <li key={i} className="flex gap-3 text-sm border-r-2 border-muted pr-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground">{describeEvent(ev.code, ev.description)}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                            <span>{fmt(ev.timestamp)}</span>
                            {ev.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{ev.location}</span>}
                            {ev.code && <span className="font-mono opacity-70">[{ev.code}]</span>}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
