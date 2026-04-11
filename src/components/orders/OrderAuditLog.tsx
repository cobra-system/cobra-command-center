import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { History, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditRow {
  id: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

interface NoteRow {
  id: string;
  note_text: string;
  changed_by: string | null;
  changed_at: string;
  change_reason: string | null;
}

interface TimelineEntry {
  id: string;
  timestamp: string;
  type: "audit" | "note";
  action?: string;
  details?: Record<string, unknown>;
  noteText?: string;
  changedBy?: string | null;
  reason?: string | null;
}

const actionLabel: Record<string, string> = {
  "order.create":   "נוצר",
  "order.update":   "עודכן",
  "order.delete":   "נמחק",
  "order.status":   "סטטוס שונה",
  "order.payment":  "תשלום עודכן",
};

const actionColor: Record<string, string> = {
  "order.create": "bg-success",
  "order.update": "bg-accent",
  "order.delete": "bg-destructive",
};

function getColor(action: string) {
  return actionColor[action] || "bg-muted-foreground";
}

function renderDiff(details: Record<string, unknown>): React.ReactNode {
  if (!details || typeof details !== "object") return null;
  const entries = Object.entries(details).filter(([k]) => !["id", "updated_at", "created_at"].includes(k));
  if (entries.length === 0) return null;
  return (
    <div className="mt-1 space-y-0.5">
      {entries.map(([key, val]) => {
        if (typeof val === "object" && val !== null && "old" in val && "new" in val) {
          const v = val as { old: unknown; new: unknown };
          return (
            <div key={key} className="text-xs text-muted-foreground">
              <span className="font-mono text-foreground/60">{key}:</span>{" "}
              <span className="line-through opacity-50">{String(v.old ?? "—")}</span>
              {" → "}
              <span className="text-foreground">{String(v.new ?? "—")}</span>
            </div>
          );
        }
        return (
          <div key={key} className="text-xs text-muted-foreground">
            <span className="font-mono text-foreground/60">{key}:</span> {String(val ?? "—")}
          </div>
        );
      })}
    </div>
  );
}

export function OrderAuditLog({ orderId }: { orderId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    const [auditRes, noteRes] = await Promise.all([
      supabase
        .from("audit_log")
        .select("id, action, details, created_at")
        .eq("entity_type", "order")
        .eq("entity_id", orderId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("order_notes_history")
        .select("id, note_text, changed_by, changed_at, change_reason")
        .eq("order_id", orderId)
        .order("changed_at", { ascending: false })
        .limit(20),
    ]);

    const auditEntries: TimelineEntry[] = (auditRes.data || []).map((r: AuditRow) => ({
      id: `audit-${r.id}`,
      timestamp: r.created_at,
      type: "audit" as const,
      action: r.action,
      details: r.details,
    }));

    const noteEntries: TimelineEntry[] = (noteRes.data || []).map((r: NoteRow) => ({
      id: `note-${r.id}`,
      timestamp: r.changed_at,
      type: "note" as const,
      noteText: r.note_text,
      changedBy: r.changed_by,
      reason: r.change_reason,
    }));

    const merged = [...auditEntries, ...noteEntries].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    setEntries(merged);
    setLoading(false);
    setLoaded(true);
  }, [orderId]);

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !loaded) fetchHistory();
  };

  return (
    <div className="bg-card rounded-xl border shadow-sm">
      <button
        className="w-full p-4 flex items-center justify-between text-right"
        onClick={handleToggle}
      >
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-foreground text-sm">היסטוריית שינויים</span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          {loading && <p className="text-sm text-muted-foreground py-4 text-center">טוען...</p>}
          {!loading && entries.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">אין היסטוריה זמינה</p>
          )}
          {!loading && entries.length > 0 && (
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute top-2 bottom-2 end-2 w-px bg-border" />
              <div className="space-y-4">
                {entries.map(entry => (
                  <div key={entry.id} className="flex gap-3 pe-6 relative">
                    {/* Dot */}
                    <div className={cn(
                      "absolute end-0 top-1.5 w-2.5 h-2.5 rounded-full border-2 border-background -translate-x-0",
                      entry.type === "note" ? "bg-primary" : getColor(entry.action || "")
                    )} style={{ right: "-1.25rem" }} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-foreground">
                          {entry.type === "note"
                            ? "הערה עודכנה"
                            : (actionLabel[entry.action || ""] || entry.action)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {entry.changedBy && (
                          <span className="text-xs text-muted-foreground">— {entry.changedBy}</span>
                        )}
                      </div>
                      {entry.type === "note" && entry.noteText && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{entry.noteText}</p>
                      )}
                      {entry.type === "audit" && entry.details && renderDiff(entry.details)}
                      {entry.reason && (
                        <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{entry.reason}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
