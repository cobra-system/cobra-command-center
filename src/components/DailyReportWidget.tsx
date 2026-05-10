import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sun, CheckCircle2, Circle, Mail, AlertTriangle, Clock,
  ChevronDown, ChevronRight, ChevronLeft, Calendar
} from "lucide-react";
import { format } from "date-fns";

interface CobraUpdate { order_name: string; description: string; }
interface ActionItem { text: string; priority: "red" | "orange" | "yellow"; done: boolean; }
interface PendingClarification { supplier: string; issue: string; resolved: boolean; }
interface MailDraft { recipient: string; subject: string; body: string; status: "pending" | "approved" | "sent"; }
interface Meeting { time: string; title: string; topics: string; }

interface DailyReport {
  id: string; report_date: string; day_name: string;
  cobra_updates: CobraUpdate[]; action_items: ActionItem[];
  pending_clarifications: PendingClarification[]; mail_drafts: MailDraft[]; meetings: Meeting[];
}

interface ReportSummary { id: string; report_date: string; day_name: string; }
type SectionKey = "actions" | "updates" | "clarifications" | "drafts" | "meetings";

export default function DailyReportWidget() {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [allReports, setAllReports] = useState<ReportSummary[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    actions: true, updates: false, clarifications: false, drafts: false, meetings: false,
  });

  const toggle = (key: SectionKey) => setOpen(p => ({ ...p, [key]: !p[key] }));

  // Load list of all report summaries (up to 60 days back)
  useEffect(() => {
    supabase
      .from("daily_reports")
      .select("id, report_date, day_name")
      .order("report_date", { ascending: false })
      .limit(60)
      .then(({ data }) => { if (data) setAllReports(data as ReportSummary[]); });
  }, []);

  // Load full report when index changes
  useEffect(() => {
    if (allReports.length === 0) return;
    const target = allReports[currentIndex];
    if (!target) return;
    setLoading(true);
    setError(null);
    supabase
      .from("daily_reports").select("*").eq("id", target.id).single()
      .then(({ data, error: err }) => {
        if (err) { setError("שגיאה בטעינת הסקירה"); }
        else if (data) setReport(normalize(data));
        setLoading(false);
      });
  }, [allReports, currentIndex]);

  // Fallback: load latest if list empty
  useEffect(() => {
    if (allReports.length > 0) return;
    supabase.from("daily_reports").select("*").order("report_date", { ascending: false }).limit(1).single()
      .then(({ data, error: err }) => {
        if (!err && data) setReport(normalize(data));
        else if (err && err.code !== "PGRST116") setError("שגיאה בטעינת הסקירה");
        setLoading(false);
      });
  }, []);

  const normalize = (data: Record<string, unknown>): DailyReport => ({
    ...(data as DailyReport),
    action_items: Array.isArray(data.action_items) ? data.action_items as ActionItem[] : [],
    cobra_updates: Array.isArray(data.cobra_updates) ? data.cobra_updates as CobraUpdate[] : [],
    pending_clarifications: Array.isArray(data.pending_clarifications) ? data.pending_clarifications as PendingClarification[] : [],
    mail_drafts: Array.isArray(data.mail_drafts) ? data.mail_drafts as MailDraft[] : [],
    meetings: Array.isArray(data.meetings) ? data.meetings as Meeting[] : [],
  });

  const handleCheckActionItem = async (idx: number, currentDone: boolean) => {
    if (!report) return;
    const updated = report.action_items.map((x, i) => i === idx ? { ...x, done: !currentDone } : x);
    const { error: err } = await supabase.from("daily_reports").update({ action_items: updated }).eq("id", report.id);
    if (!err) setReport({ ...report, action_items: updated });
  };

  const handleApproveDraft = async (idx: number) => {
    if (!report) return;
    const updated = report.mail_drafts.map((x, i) => i === idx ? { ...x, status: "approved" as const } : x);
    const { error: err } = await supabase.from("daily_reports").update({ mail_drafts: updated }).eq("id", report.id);
    if (!err) setReport({ ...report, mail_drafts: updated });
  };

  const goToIndex = (idx: number) => {
    setCurrentIndex(idx);
    setShowPicker(false);
    setOpen({ actions: true, updates: false, clarifications: false, drafts: false, meetings: false });
  };

  const hasPrev = currentIndex < allReports.length - 1;
  const hasNext = currentIndex > 0;
  const isToday = currentIndex === 0;

  const fmt = (d: string) => format(new Date(d), "dd/MM");
  const fmtFull = (d: string) => format(new Date(d), "dd/MM/yyyy");

  if (loading) return (
    <div className="bg-card rounded-xl border p-6 flex items-center justify-center gap-2 text-muted-foreground">
      <Clock className="h-4 w-4 animate-spin" /><span className="text-sm">{"טוען..."}</span>
    </div>
  );
  if (error) return <div className="bg-card rounded-xl border p-4 text-sm text-destructive text-right">{error}</div>;
  if (!report) return (
    <div className="bg-card rounded-xl border p-8 text-center">
      <Sun className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">{"אין סקירות עדיין"}</p>
    </div>
  );

  const redItems   = report.action_items.map((x, i) => ({ ...x, i })).filter(x => x.priority === "red");
  const otherItems = report.action_items.map((x, i) => ({ ...x, i })).filter(x => x.priority !== "red");
  const pendingDrafts = report.mail_drafts.filter(d => d.status === "pending").length;
  const unresolved = report.pending_clarifications.filter(c => !c.resolved).length;
  const doneCount = report.action_items.filter(x => x.done).length;
  const total = report.action_items.length;

  const pills = [
    redItems.length   > 0 && { label: `${redItems.length} \u05D3\u05D7\u05D5\u05E3`,    color: "bg-red-100 text-red-700" },
    otherItems.length > 0 && { label: `${otherItems.length} \u05D1\u05D9\u05E0\u05D5\u05E0\u05D9`, color: "bg-yellow-100 text-yellow-700" },
    unresolved        > 0 && { label: `${unresolved} \u05D4\u05D1\u05D4\u05E8\u05D5\u05EA`, color: "bg-orange-100 text-orange-700" },
    pendingDrafts     > 0 && { label: `${pendingDrafts} \u05DE\u05D9\u05D9\u05DC\u05D9\u05DD`, color: "bg-blue-100 text-blue-700" },
    report.meetings.length > 0 && { label: `${report.meetings.length} \u05E4\u05D2\u05D9\u05E9\u05D5\u05EA`, color: "bg-purple-100 text-purple-700" },
  ].filter(Boolean) as { label: string; color: string }[];

  return (
    <div className="bg-card rounded-xl border shadow-sm overflow-hidden" dir="rtl">

      {/* ── Date navigation ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <button onClick={() => hasPrev && goToIndex(currentIndex + 1)} disabled={!hasPrev}
          className="p-1 rounded hover:bg-muted transition-colors disabled:opacity-30" title={"סקירה קודמת"}>
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="relative">
          <button onClick={() => setShowPicker(!showPicker)}
            className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-muted transition-colors">
            <Sun className="h-3.5 w-3.5 text-primary" />
            <span className="text-sm font-medium">
              {isToday ? "\u05D4\u05D9\u05D5\u05DD" : report.day_name}{" · "}{fmt(report.report_date)}
            </span>
            <Calendar className="h-3 w-3 text-muted-foreground ml-0.5" />
          </button>

          {showPicker && allReports.length > 0 && (
            <div className="absolute top-full right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 min-w-[180px] py-1 max-h-60 overflow-y-auto">
              {allReports.map((r, idx) => (
                <button key={r.id} onClick={() => goToIndex(idx)}
                  className={cn("w-full flex items-center justify-between px-3 py-1.5 text-sm hover:bg-muted transition-colors",
                    idx === currentIndex && "bg-primary/10 text-primary font-medium")}>
                  <span className="text-xs text-muted-foreground">{r.day_name}</span>
                  <span>{fmtFull(r.report_date)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button onClick={() => hasNext && goToIndex(currentIndex - 1)} disabled={!hasNext}
          className="p-1 rounded hover:bg-muted transition-colors disabled:opacity-30" title={"סקירה הבאה"}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* ── Pills ── */}
      {pills.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap px-3 py-2 border-b bg-gradient-to-l from-primary/5 to-transparent">
          {pills.map(p => (
            <span key={p.label} className={cn("text-xs font-medium px-2 py-0.5 rounded-full", p.color)}>{p.label}</span>
          ))}
        </div>
      )}

      {/* ── Sections ── */}
      <div className="divide-y">

        {total > 0 && (
          <Section sectionKey="actions" open={open.actions} onToggle={() => toggle("actions")}
            label={"\u05E4\u05E2\u05D5\u05DC\u05D5\u05EA"} badge={`${doneCount}/${total}`}
            badgeColor={doneCount === total ? "text-green-600" : "text-foreground"}>
            {redItems.map(item => (
              <ActionRow key={item.i} text={item.text} done={item.done} dotColor="bg-red-500"
                onChange={() => handleCheckActionItem(item.i, item.done)} />
            ))}
            {otherItems.map(item => (
              <ActionRow key={item.i} text={item.text} done={item.done}
                dotColor={item.priority === "orange" ? "bg-orange-400" : "bg-yellow-400"}
                onChange={() => handleCheckActionItem(item.i, item.done)} />
            ))}
          </Section>
        )}

        {report.cobra_updates.length > 0 && (
          <Section sectionKey="updates" open={open.updates} onToggle={() => toggle("updates")}
            label={"\u05E2\u05D3\u05DB\u05D5\u05E0\u05D9 Cobra"} badge={`${report.cobra_updates.length}`}>
            {report.cobra_updates.map((u, idx) => (
              <div key={idx} className="flex gap-2 py-1.5 px-1 text-sm">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                <div className="min-w-0">
                  <span className="font-medium">{u.order_name}</span>
                  {u.description && <span className="text-muted-foreground"> — {u.description}</span>}
                </div>
              </div>
            ))}
          </Section>
        )}

        {report.pending_clarifications.length > 0 && (
          <Section sectionKey="clarifications" open={open.clarifications} onToggle={() => toggle("clarifications")}
            label={"\u05D4\u05D1\u05D4\u05E8\u05D5\u05EA \u05DE\u05DE\u05EA\u05D9\u05E0\u05D5\u05EA"}
            badge={unresolved > 0 ? `${unresolved}` : undefined} badgeColor="text-orange-600">
            {report.pending_clarifications.map((c, idx) => (
              <div key={idx} className="flex gap-2 py-1.5 px-1 text-sm items-start">
                <div className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0 mt-1.5", c.resolved ? "bg-green-500" : "bg-orange-500")} />
                <div className="min-w-0">
                  <span className="font-medium">{c.supplier}</span>
                  {c.issue && <span className="text-muted-foreground"> — {c.issue}</span>}
                </div>
              </div>
            ))}
          </Section>
        )}

        {report.mail_drafts.length > 0 && (
          <Section sectionKey="drafts" open={open.drafts} onToggle={() => toggle("drafts")}
            label={"\u05D8\u05D9\u05D5\u05D8\u05D5\u05EA \u05D3\u05D5\u05D0\"\u05DC"}
            badge={pendingDrafts > 0 ? `${pendingDrafts} \u05DE\u05DE\u05EA\u05D9\u05E0\u05D5\u05EA` : "\u05D4\u05DB\u05DC \u05D0\u05D5\u05E9\u05E8"}
            badgeColor={pendingDrafts > 0 ? "text-blue-600" : "text-green-600"}>
            {report.mail_drafts.map((draft, idx) => (
              <div key={idx} className="flex items-center gap-2 py-1.5 px-1">
                <Button variant={draft.status === "pending" ? "default" : "ghost"} size="sm"
                  onClick={() => handleApproveDraft(idx)} disabled={draft.status !== "pending"}
                  className="h-6 text-xs px-2 flex-shrink-0">
                  {draft.status === "pending" ? "\u05D0\u05E9\u05E8" : draft.status === "approved" ? "✓" : "\u05E0\u05E9\u05DC\u05D7"}
                </Button>
                <div className="min-w-0 flex-1 text-sm">
                  <span className="font-medium truncate block">{draft.subject}</span>
                  <span className="text-xs text-muted-foreground">{draft.recipient}</span>
                </div>
              </div>
            ))}
          </Section>
        )}

        {report.meetings.length > 0 && (
          <Section sectionKey="meetings" open={open.meetings} onToggle={() => toggle("meetings")}
            label={"\u05E4\u05D2\u05D9\u05E9\u05D5\u05EA"} badge={`${report.meetings.length}`} badgeColor="text-purple-600">
            {report.meetings.map((m, idx) => (
              <div key={idx} className="flex gap-2 py-1.5 px-1 text-sm items-start">
                <div className="h-1.5 w-1.5 rounded-full bg-purple-500 flex-shrink-0 mt-1.5" />
                <div className="min-w-0">
                  <span className="font-medium">{m.time}</span><span> — {m.title}</span>
                  {m.topics && <p className="text-xs text-muted-foreground mt-0.5">{m.topics}</p>}
                </div>
              </div>
            ))}
          </Section>
        )}

      </div>
    </div>
  );
}

function Section({ open, onToggle, label, badge, badgeColor = "text-muted-foreground", children }: {
  sectionKey: SectionKey; open: boolean; onToggle: () => void;
  label: string; badge?: string; badgeColor?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <button onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors">
        <div className="text-muted-foreground">
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </div>
        <div className="flex items-center gap-2">
          {badge && <span className={cn("text-xs font-medium", badgeColor)}>{badge}</span>}
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

function ActionRow({ text, done, dotColor, onChange }: {
  text: string; done: boolean; dotColor: string; onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2.5 py-1.5 px-1 cursor-pointer hover:bg-muted/30 rounded-lg group">
      <input type="checkbox" checked={done} onChange={onChange} className="rounded w-3.5 h-3.5 flex-shrink-0" />
      <div className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", dotColor)} />
      <span className={cn("text-sm flex-1", done && "line-through text-muted-foreground")}>{text}</span>
      {done
        ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0 opacity-70" />
        : <Circle className="h-3.5 w-3.5 text-muted-foreground/30 flex-shrink-0 group-hover:opacity-100" />}
    </label>
  );
}
