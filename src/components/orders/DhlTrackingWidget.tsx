import { useEffect, useState } from "react";
import { RefreshCw, Truck, MapPin, Calendar, AlertTriangle, Check, Package, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useData } from "@/contexts/AppContext";
import {
  DHL_LEVELS,
  DHL_PROGRESS_STAGES,
  describeEvent,
  describeStatus,
  normalizeLevel,
  stageIndexForEvent,
  type TrackingLevel,
} from "@/lib/dhlStatusMap";
import type { Order } from "@/contexts/types";

const INACTIVE_STATUSES = ["DELIVERED", "ARRIVED", "CANCELLED"];

interface DhlTrackingWidgetProps {
  order: Order;
  loading: boolean;
  onRefresh: () => void;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
}

function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("he-IL");
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
              <div
                className={cn(
                  "h-2.5 w-2.5 rounded-full border-2 transition-colors",
                  isException
                    ? "border-red-300 bg-red-100"
                    : reached
                      ? "border-primary bg-primary"
                      : "border-muted-foreground/30 bg-background",
                  current && "ring-2 ring-primary/30"
                )}
              />
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

export function DhlTrackingWidget({ order, loading, onRefresh }: DhlTrackingWidgetProps) {
  const { updateOrderStatus } = useData();
  const [isOpen, setIsOpen] = useState(false);
  const level = normalizeLevel(order.tracking_status_code);
  const meta = DHL_LEVELS[level];
  const headlineCode = order.tracking_events?.[0]?.code ?? order.tracking_raw_status ?? null;
  const headline = describeStatus(level, headlineCode, order.tracking_description);

  // When DHL reports the package as delivered but the order's own status hasn't
  // been updated yet, surface a one-time toast (per session) suggesting the
  // user advance the order. We never auto-update the status — only suggest.
  useEffect(() => {
    if (level !== "delivered") return;
    if (INACTIVE_STATUSES.includes(order.status)) return;
    const key = `tracking:delivered-suggested:${order.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    toast.info("DHL מדווח שהמשלוח נמסר. לסמן את ההזמנה כהגיעה?", {
      action: { label: "סמן כהגיעה", onClick: () => updateOrderStatus(order.id, "DELIVERED") },
      duration: 30000,
    });
  }, [level, order.id, order.status, updateOrderStatus]);

  const events = order.tracking_events ?? [];
  const hasAnyData = !!(order.tracking_status_code || order.tracking_description || events.length || order.tracking_status);

  const Icon = level === "delivered" ? Check
    : level === "failure" ? AlertTriangle
    : level === "transit" ? Truck
    : Package;

  return (
    <div className="bg-card rounded-xl border shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen(o => !o)}
        aria-expanded={isOpen}
        className="w-full p-5 flex items-center justify-between gap-3 flex-wrap hover:bg-muted/20 transition-colors text-right"
      >
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Truck className="h-5 w-5 text-primary shrink-0" />
          <h2 className="text-lg font-semibold text-foreground">מעקב DHL</h2>
          <span className="text-xs text-muted-foreground font-mono">{order.tracking_number}</span>
          {hasAnyData && (
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", meta.badgeClass)}>
              <Icon className="h-3 w-3" />
              {meta.he}
            </span>
          )}
          {order.tracking_eta && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDateOnly(order.tracking_eta)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            role="button"
            tabIndex={0}
            onClick={e => { e.stopPropagation(); if (!loading) onRefresh(); }}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); if (!loading) onRefresh(); } }}
            className={cn(
              "flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border rounded-lg px-3 py-1.5 transition-colors hover:bg-muted/30",
              loading && "opacity-50 pointer-events-none",
            )}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            רענן מעקב
          </span>
          <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform shrink-0", isOpen && "rotate-180")} />
        </div>
      </button>

      {isOpen && (
        <div className="px-5 pb-5 border-t pt-4">
          {!hasAnyData && (
            <p className="text-sm text-muted-foreground">טרם בוצע עדכון מעקב — לחץ "רענן מעקב"</p>
          )}

          {hasAnyData && (
            <>
              <div className="flex items-center gap-3 flex-wrap mb-4">
                <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold", meta.badgeClass)}>
                  <Icon className="h-4 w-4" />
                  {meta.he}
                </span>
                <span className={cn("text-sm", meta.textClass)}>{headline}</span>
              </div>

              <div className="mb-5">
                <ProgressBar level={level} eventCode={headlineCode} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                {order.tracking_eta && (
                  <InfoCard icon={Calendar} label="הגעה משוערת" value={formatDateOnly(order.tracking_eta)} />
                )}
                {order.tracking_last_location && (
                  <InfoCard icon={MapPin} label="מיקום אחרון" value={order.tracking_last_location} />
                )}
                {order.tracking_origin && (
                  <InfoCard icon={MapPin} label="מוצא" value={order.tracking_origin} />
                )}
                {order.tracking_destination && (
                  <InfoCard icon={MapPin} label="יעד" value={order.tracking_destination} />
                )}
                {order.tracking_last_synced_at && (
                  <InfoCard
                    icon={RefreshCw}
                    label="עודכן"
                    value={formatDate(order.tracking_last_synced_at)}
                  />
                )}
              </div>

              {order.tracking_sync_error && (
                <div className="flex items-start gap-2 mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold mb-0.5">שגיאת סנכרון אחרונה</div>
                    <div className="font-mono">{order.tracking_sync_error}</div>
                  </div>
                </div>
              )}

              {events.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-2">היסטוריית אירועים</div>
                  <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {events.slice(0, 10).map((ev, i) => (
                      <li key={i} className="flex gap-3 text-sm border-r-2 border-muted pr-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground">{describeEvent(ev.code, ev.description)}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                            <span>{formatDate(ev.timestamp)}</span>
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

function InfoCard({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-0.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}
