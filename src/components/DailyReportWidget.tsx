import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sun, CheckCircle2, Circle, Mail, AlertTriangle, Clock } from "lucide-react";

interface CobraUpdate {
  order_name: string;
  description: string;
}

interface ActionItem {
  text: string;
  priority: "red" | "orange" | "yellow";
  done: boolean;
}

interface PendingClarification {
  supplier: string;
  issue: string;
  resolved: boolean;
}

interface MailDraft {
  recipient: string;
  subject: string;
  body: string;
  status: "pending" | "approved" | "sent";
}

interface Meeting {
  time: string;
  title: string;
  topics: string;
}

interface DailyReport {
  id: string;
  report_date: string;
  day_name: string;
  cobra_updates: CobraUpdate[];
  action_items: ActionItem[];
  pending_clarifications: PendingClarification[];
  mail_drafts: MailDraft[];
  meetings: Meeting[];
  total_action_items: number;
  total_mail_drafts: number;
  total_cobra_updates: number;
}

export default function DailyReportWidget() {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDailyReport = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: err } = await supabase
          .from("daily_reports")
          .select("*")
          .order("report_date", { ascending: false })
          .limit(1)
          .single();

        if (err) {
          if (err.code === "PGRST116") {
            setReport(null);
          } else {
            setError("Failed to fetch daily report");
            console.error("Supabase error:", err);
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
        setError("Failed to fetch daily report");
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDailyReport();
  }, []);

  const handleCheckActionItem = async (idx: number, currentDone: boolean) => {
    if (!report) return;
    try {
      const updatedItems = report.action_items.map((item, i) =>
        i === idx ? { ...item, done: !currentDone } : item
      );
      const { error: err } = await supabase
        .from("daily_reports")
        .update({ action_items: updatedItems })
        .eq("id", report.id);
      if (!err) setReport({ ...report, action_items: updatedItems });
    } catch (err) {
      console.error("Error updating action item:", err);
    }
  };

  const handleApproveDraft = async (idx: number) => {
    if (!report) return;
    try {
      const updatedDrafts = report.mail_drafts.map((draft, i) =>
        i === idx ? { ...draft, status: "approved" as const } : draft
      );
      const { error: err } = await supabase
        .from("daily_reports")
        .update({ mail_drafts: updatedDrafts })
        .eq("id", report.id);
      if (!err) setReport({ ...report, mail_drafts: updatedDrafts });
    } catch (err) {
      console.error("Error approving draft:", err);
    }
  };

  if (loading) {
    return (
      <div className="bg-card rounded-xl border shadow-sm p-8 flex items-center justify-center">
        <div className="text-center">
          <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2 animate-spin" />
          <p className="text-sm text-muted-foreground">{"טוען סקירה..."}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card rounded-xl border shadow-sm p-6">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="bg-card rounded-xl border shadow-sm p-8 text-center">
        <Sun className="h-12 w-12 text-primary mx-auto mb-3 opacity-50" />
        <p className="text-sm text-muted-foreground">{"אין סקירה להיום"}</p>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("he-IL", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const redItems = report.action_items
    .map((item, idx) => ({ ...item, idx }))
    .filter((item) => item.priority === "red");
  const orangeItems = report.action_items
    .map((item, idx) => ({ ...item, idx }))
    .filter((item) => item.priority === "orange" || item.priority === "yellow");

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-gradient-to-l from-primary/20 to-primary/10 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
        <Sun className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-foreground text-right">
            {"\u05E1\u05E7\u05D9\u05E8\u05EA \u05D1\u05D5\u05E7\u05E8 \u2014"} {report.day_name} {formatDate(report.report_date)}
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {/* Cobra Updates */}
        {report.cobra_updates && report.cobra_updates.length > 0 && (
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <div className="bg-blue-50 border-b border-blue-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-blue-900 text-right flex items-center gap-2 justify-end">
                <span>{"\u05E2\u05D3\u05DB\u05D5\u05E0\u05D9 Cobra"} ({report.cobra_updates.length})</span>
                <CheckCircle2 className="h-4 w-4" />
              </h3>
            </div>
            <div className="p-4 space-y-2">
              {report.cobra_updates.map((update, idx) => (
                <div key={idx} className="flex items-start gap-3 text-right">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{update.order_name}</p>
                    <p className="text-xs text-muted-foreground">{update.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Red Priority */}
        {redItems.length > 0 && (
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <div className="bg-red-50 border-b border-red-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-red-900 text-right flex items-center gap-2 justify-end">
                <span>{"\u05D3\u05D7\u05D5\u05E3 - \u05E4\u05E2\u05D5\u05DC\u05D5\u05EA \u05E0\u05D3\u05E8\u05E9\u05D5\u05EA"}</span>
                <AlertTriangle className="h-4 w-4" />
              </h3>
            </div>
            <div className="p-4 space-y-2">
              {redItems.map((item) => (
                <div key={item.idx} className="flex items-center justify-end gap-3 py-2 px-2 hover:bg-muted/40 rounded-lg transition-colors">
                  <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => handleCheckActionItem(item.idx, item.done)}
                      className="rounded w-4 h-4"
                    />
                    <span className={cn("text-sm flex-1 text-right", item.done && "line-through text-muted-foreground")}>
                      {item.text}
                    </span>
                  </label>
                  {item.done
                    ? <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    : <Circle className="h-4 w-4 text-red-500 flex-shrink-0" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Orange/Yellow Priority */}
        {orangeItems.length > 0 && (
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <div className="bg-yellow-50 border-b border-yellow-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-yellow-900 text-right flex items-center gap-2 justify-end">
                <span>{"\u05E4\u05E2\u05D5\u05DC\u05D5\u05EA - \u05E2\u05D3\u05D9\u05E4\u05D5\u05EA \u05D1\u05D9\u05E0\u05D5\u05E0\u05D9"}</span>
                <Clock className="h-4 w-4" />
              </h3>
            </div>
            <div className="p-4 space-y-2">
              {orangeItems.map((item) => (
                <div key={item.idx} className="flex items-center justify-end gap-3 py-2 px-2 hover:bg-muted/40 rounded-lg transition-colors">
                  <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => handleCheckActionItem(item.idx, item.done)}
                      className="rounded w-4 h-4"
                    />
                    <span className={cn("text-sm flex-1 text-right", item.done && "line-through text-muted-foreground")}>
                      {item.text}
                    </span>
                  </label>
                  {item.done
                    ? <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    : <Circle className="h-4 w-4 text-yellow-500 flex-shrink-0" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending Clarifications */}
        {report.pending_clarifications && report.pending_clarifications.length > 0 && (
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <div className="bg-orange-50 border-b border-orange-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-orange-900 text-right flex items-center gap-2 justify-end">
                <span>{"\u05D4\u05D1\u05D4\u05E8\u05D5\u05EA \u05DE\u05DE\u05EA\u05D9\u05E0\u05D5\u05EA"} ({report.pending_clarifications.filter(c => !c.resolved).length})</span>
                <AlertTriangle className="h-4 w-4" />
              </h3>
            </div>
            <div className="p-4 space-y-2">
              {report.pending_clarifications.map((c, idx) => (
                <div key={idx} className="flex items-start gap-3 text-right">
                  <div className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0 mt-1.5", c.resolved ? "bg-green-500" : "bg-orange-500")} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{c.supplier}</p>
                    <p className="text-xs text-muted-foreground">{c.issue}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mail Drafts */}
        {report.mail_drafts && report.mail_drafts.length > 0 && (
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <div className="bg-blue-50 border-b border-blue-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-blue-900 text-right flex items-center gap-2 justify-end">
                <span>{"\u05D8\u05D9\u05D5\u05D8\u05D5\u05EA \u05D3\u05D5\u05D0\"\u05DC"} ({report.mail_drafts.length})</span>
                <Mail className="h-4 w-4" />
              </h3>
            </div>
            <div className="p-4 space-y-2">
              {report.mail_drafts.map((draft, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 hover:bg-muted/40 rounded-lg transition-colors">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleApproveDraft(idx)}
                    disabled={draft.status === "approved" || draft.status === "sent"}
                    className={cn("text-xs", (draft.status === "approved" || draft.status === "sent") && "opacity-60 cursor-not-allowed")}
                  >
                    {draft.status === "approved" ? "\u05D0\u05D5\u05E9\u05E8" : draft.status === "sent" ? "\u05E0\u05E9\u05DC\u05D7" : "\u05D0\u05E9\u05E8"}
                  </Button>
                  <div className="text-right flex-1 min-w-0 px-2">
                    <p className="text-sm font-medium text-foreground truncate">{draft.subject}</p>
                    <p className="text-xs text-muted-foreground truncate">{"\u05D0\u05DC:"} {draft.recipient}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Meetings */}
        {report.meetings && report.meetings.length > 0 && (
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <div className="bg-purple-50 border-b border-purple-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-purple-900 text-right flex items-center gap-2 justify-end">
                <span>{"\u05E4\u05D2\u05D9\u05E9\u05D5\u05EA \u05D4\u05D9\u05D5\u05DD"} ({report.meetings.length})</span>
                <Clock className="h-4 w-4" />
              </h3>
            </div>
            <div className="p-4 space-y-2">
              {report.meetings.map((meeting, idx) => (
                <div key={idx} className="flex items-start gap-3 text-right">
                  <div className="h-1.5 w-1.5 rounded-full bg-purple-500 flex-shrink-0 mt-1.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{meeting.time} {"\u2014"} {meeting.title}</p>
                    {meeting.topics && <p className="text-xs text-muted-foreground">{meeting.topics}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
