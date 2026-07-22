import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { ChevronDown, ChevronUp, History } from "lucide-react";

interface LogEntry {
  id: string;
  zone_id: string;
  action: "create" | "update" | "delete" | "move";
  details: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  create: "נוצר",
  update: "עודכן",
  delete: "נמחק",
  move: "הוזז",
};

function formatDetail(entry: LogEntry): string {
  if (!entry.details) return "";
  const d = entry.details;

  if (entry.action === "move") {
    const nr = d.new_row as string | undefined;
    const nc = d.new_col as string | undefined;
    if (nr || nc) return `→ שורה ${nr ?? ""}, עמודה ${nc ?? ""}`;
  }
  if (entry.action === "create") {
    const n = d.name as string | undefined;
    return n ? `"${n}"` : "";
  }
  if (entry.action === "update") {
    const changes = d.changes as Record<string, { old: unknown; new: unknown }> | undefined;
    if (!changes || Object.keys(changes).length === 0) return "";
    const FIELD_LABELS: Record<string, string> = {
      name: "שם", color: "צבע", gridRow: "שורה", gridCol: "עמודה", notes: "הערות",
    };
    const parts = Object.entries(changes).map(([f, { old: o, new: n }]) =>
      `${FIELD_LABELS[f] ?? f}: "${o}" → "${n}"`,
    );
    return parts.join(", ");
  }
  if (entry.action === "delete") {
    const n = d.name as string | undefined;
    return n ? `"${n}"` : "";
  }
  return "";
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

interface ZoneChangeLogProps {
  zoneId: string;
}

export default function ZoneChangeLog({ zoneId }: ZoneChangeLogProps) {
  const [expanded, setExpanded] = useState(false);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    setLoading(true);
    supabase
      .from("warehouse_zone_log")
      .select("id, zone_id, action, details, created_at")
      .eq("zone_id", zoneId)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setEntries((data ?? []) as LogEntry[]);
        setLoading(false);
      });
  }, [expanded, zoneId]);

  return (
    <div className="border-t mt-3 pt-3">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-right"
      >
        <History className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="flex-1">היסטוריית שינויים</span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5">
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-2">טוען...</p>
          ) : entries.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">אין שינויים מתועדים</p>
          ) : (
            entries.map((entry) => {
              const detail = formatDetail(entry);
              const userEmail = (entry.details?._user_email as string | null) ?? null;
              return (
                <div key={entry.id} className="flex items-start gap-2 text-xs">
                  <span
                    className={`flex-shrink-0 font-medium px-1.5 py-0.5 rounded text-[10px] ${
                      entry.action === "delete"
                        ? "bg-destructive/10 text-destructive"
                        : entry.action === "create"
                        ? "bg-green-100 text-green-700"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {ACTION_LABELS[entry.action] ?? entry.action}
                  </span>
                  <div className="flex-1 min-w-0">
                    {detail && (
                      <span className="text-foreground/70 block truncate">{detail}</span>
                    )}
                    <span className="text-muted-foreground">
                      {formatTime(entry.created_at)}
                      {userEmail ? ` · ${userEmail.split("@")[0]}` : ""}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
