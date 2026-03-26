import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sun, CheckCircle2, Circle, Mail, AlertTriangle, Clock, ChevronDown, ChevronRight
} from "lucide-react";

interface CobraUpdate { order_name: string; description: string; }
interface ActionItem { text: string; priority: "red" | "orange" | "yellow"; done: boolean; }
interface PendingClarification { supplier: string; issue: string; resolved: boolean; }
interface MailDraft { recipient: string; subject: string; body: string; status: "pending" | "approved" | "sent"; }
interface Meeting { time: string; title: string; topics: string; }

interface DailyReport {
  id: string;
  report_date: string;
  day_name: string;
  cobra_updates: CobraUpdate[];
  action_items: ActionItem[];
  pending_clarifications: PendingClarification[];
  mail_drafts: MailDraft[];
  meetings: Meeting[];
}

type SectionKey = "actions" | "updates" | "clarifications" | "drafts" | "meetings";

export default function DailyReportWidget() {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    actions: true,
    updates: false,
    clarifications: false,
    drafts: false,
    meetings: false,
  });

  const toggle = (key: SectionKey) =>
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    const fetchDailyReport = async () => {
      try {
        setLoading(true);
        const { data, error: err } = await supabase
          .from("daily_reports")
          .select("*")
          .order("report_date", { ascending: false })
          .limit(1)
          .single();

        if (err) {
          if (err.code !== "PGRST116") {
            setError("שגיאה בטעינת הסקירה");
            console.error(err);
          }
        } else if (data) {
          setReport({
            ...data,
            action_items: Array.isArray(data.action_items) ? data.action_items : [],
            cobra_updates: Array.isArray(data.cobra_updates) ? data.cobra_updates : [],
            pending_clarifications: Array.isArray(data.pending_clarifications) ? data.pending_clarifications : [],
            mail_drafts: Array.isArray(data.mail_drafts) ? data.mail_drafts : [],
            meetings: Array.isArray(data.meetings) ? data.meetings : [],
          } as DailyReport);
        }
      } catch (err) {
        setError("שגיאה בטעינת הסקירה");
      } finally {
        setLoading(false);
      }
    };
    fetchDailyReport();
  }, []);

  const handleCheckActionItem = async (idx: number, currentDone: boolean) => {
    if (!report) return;
    const updatedItems = report.action_items.map((item, i) =>
      i === idx ? { ...item, done: !currentDone } : item
    );
    const { error: err } = await supabase
      .from("daily_reports").update({ action_items: updatedItems }).eq("id", report.id);
    if (!err) setReport({ ...report, action_items: updatedItems });
  };

  const handleApproveDraft = async (idx: number) => {
    if (!report) return;
    const updatedDrafts = report.mail_drafts.map((draft, i) =>
      i === idx ? { ...draft, status: "approved" as const } : draft
    );
    const { error: err } = await supabase
      .from("daily_reports").update({ mail_drafts: updatedDrafts }).eq("id", report.id);
    if (!err) setReport({ ...report, mail_drafts: updatedDrafts });
  };

  if (loading) return (
    <div className="bg-card rounded-xl border p-6 flex items-center justify-center gap-2 text-muted-foreground">
      <Clock className="h-4 w-4 animate-spin" />
      <span className="text-sm">{"טוען סקירה..."}</span>
    </div>
  );

  if (error) return (
    <div className="bg-card rounded-xl border p-4 text-sm text-destructive text-right">{error}</div>
  );

  if (!report) return (
    <div className="bg-card rounded-xl border p-8 text-center">
      <Sun className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">{"אין סקירה להיום"}</p>
    </div>
  );

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });

  const redItems   = report.action_items.map((x, i) => ({ ...x, i })).filter(x => x.priority === "red");
  const otherItems = report.action_items.map((x, i) => ({ ...x, i })).filter(x => x.priority !== "red");
  const pendingDrafts = report.mail_drafts.filter(d => d.status === "pending").length;
  const unresolvedClarifications = report.pending_clarifications.filter(c => !c.resolved).length;
  const doneCount = report.action_items.filter(x => x.done).length;
  const totalActions = report.action_items.length;

  // Summary pills for header
  const pills = [
    redItems.length > 0 && { label: `${redItems.length} דחוף`, color: "bg-red-100 text-red-700" },
    otherItems.length > 0 && { label: `${otherItems.length} בינוני`, color: "bg-yellow-100 text-yellow-700" },
    unresolvedClarifications > 0 && { label: `${unresolvedClarifications} הבהרות`, color: "bg-orange-100 text-orange-700" },
    pendingDrafts > 0 && { label: `${pendingDrafts} מיילים`, color: "bg-blue-100 text-blue-700" },
    report.meetings.length > 0 && { label: `${report.meetings.length} פגישות`, color: "bg-purple-100 text-purple-700" },
  ].filter(Boolean) as { label: string; color: string }[];

  return (
    <div className="bg-card rounded-xl border shadow-sm overflow-hidden" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-l from-primary/10 to-transparent">
        <div className="flex items-center gap-2 flex-wrap">
          {pills.map((p) => (
            <span key={p.label} className={cn("text-xs font-medium px-2 py-0.5 rounded-full", p.color)}>
              {p.label}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-muted-foreground">{formatDate(report.report_date)}</span>
          <Sun className="h-4 w-4 text-primary" />
        </div>
      </div>

      {/* ── Sections ── */}
      <div className="divide-y">

        {/* Action Items */}
        {totalActions > 0 && (
          <Section
            sectionKey="actions"
            open={open.actions}
            onToggle={() => toggle("actions")}
            label={"פעולות"}
            badge={`${doneCount}/${totalActions}`}
            badgeColor={doneCount === totalActions ? "text-green-600" : "text-foreground"}
          >
            {redItems.length > 0 && (
              <div className="mb-1">
                {redItems.map((item) => (
                  <ActionRow
                    key={item.i}
                    text={item.text}
                    done={item.done}
                    dotColor="bg-red-500"
                    onChange={() => handleCheckActionItem(item.i, item.done)}
                  />
                ))}
              </div>
            )}
            {otherItems.length > 0 && (
              <div>
                {otherItems.map((item) => (
                  <ActionRow
                    key={item.i}
                    text={item.text}
                    done={item.done}
                    dotColor={item.priority === "orange" ? "bg-orange-400" : "bg-yellow-400"}
                    onChange={() => handleCheckActionItem(item.i, item.done)}
                  />
                ))}
              </div>
            )}
          </Section>
        )}

        {/* Cobra Updates */}
        {report.cobra_updates.length > 0 && (
          <Section
            sectionKey="updates"
            open={open.updates}
            onToggle={() => toggle("updates")}
            label={"עדכוני Cobra"}
            badge={`${report.cobra_updates.length}`}
          >
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

        {/* Clarifications */}
        {report.pending_clarifications.length > 0 && (
          <Section
            sectionKey="clarifications"
            open={open.clarifications}
            onToggle={() => toggle("clarifications")}
            label={"הבהרות ממתינות"}
            badge={unresolvedClarifications > 0 ? `${unresolvedClarifications}` : undefined}
            badgeColor="text-orange-600"
          >
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

        {/* Mail Drafts */}
        {report.mail_drafts.length > 0 && (
          <Section
            sectionKey="drafts"
            open={open.drafts}
            onToggle={() => toggle("drafts")}
            label={"טיוטות דוא\"ל"}
            badge={pendingDrafts > 0 ? `${pendingDrafts} ממתינות` : "הכל אושר"}
            badgeColor={pendingDrafts > 0 ? "text-blue-600" : "text-green-600"}
          >
            {report.mail_drafts.map((draft, idx) => (
              <div key={idx} className="flex items-center gap-2 py-1.5 px-1">
                <Button
                  variant={draft.status === "pending" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => handleApproveDraft(idx)}
                  disabled={draft.status !== "pending"}
                  className="h-6 text-xs px-2 flex-shrink-0"
                >
                  {draft.status === "pending" ? "אשר" : draft.status === "approved" ? "✓" : "נשלח"}
                </Button>
                <div className="min-w-0 flex-1 text-sm">
                  <span className="font-medium truncate block">{draft.subject}</span>
                  <span className="text-xs text-muted-foreground">{draft.recipient}</span>
                </div>
              </div>
            ))}
          </Section>
        )}

        {/* Meetings */}
        {report.meetings.length > 0 && (
          <Section
            sectionKey="meetings"
            open={open.meetings}
            onToggle={() => toggle("meetings")}
            label={"פגישות"}
            badge={`${report.meetings.length}`}
            badgeColor="text-purple-600"
          >
            {report.meetings.map((m, idx) => (
              <div key={idx} className="flex gap-2 py-1.5 px-1 text-sm items-start">
                <div className="h-1.5 w-1.5 rounded-full bg-purple-500 flex-shrink-0 mt-1.5" />
                <div className="min-w-0">
                  <span className="font-medium">{m.time}</span>
                  <span> — {m.title}</span>
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

/* ── Reusable Section Accordion ── */
function Section({
  open, onToggle, label, badge, badgeColor = "text-muted-foreground", children,
}: {
  sectionKey: SectionKey;
  open: boolean;
  onToggle: () => void;
  label: string;
  badge?: string;
  badgeColor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors text-right"
      >
        <div className="flex items-center gap-1.5 text-muted-foreground">
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

/* ── Compact Action Row ── */
function ActionRow({ text, done, dotColor, onChange }: {
  text: string; done: boolean; dotColor: string; onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2.5 py-1.5 px-1 cursor-pointer hover:bg-muted/30 rounded-lg group">
      <input type="checkbox" checked={done} onChange={onChange} className="rounded w-3.5 h-3.5 flex-shrink-0" />
      <div className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", dotColor)} />
      <span className={cn("text-sm flex-1", done && "line-through text-muted-foreground")}>
        {text}
      </span>
      {done
        ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0 opacity-70" />
        : <Circle className="h-3.5 w-3.5 text-muted-foreground/30 flex-shrink-0 group-hover:opacity-100" />}
    </label>
  );
}
