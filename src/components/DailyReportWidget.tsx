import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sun, CheckCircle2, Circle, Mail, AlertTriangle, Clock } from "lucide-react";

interface DailyReport {
  id: string;
  report_date: string;
  day_name: string;
  cobra_updates: string[];
  action_items: Array<{
    id: string;
    title: string;
    priority: string;
    done: boolean;
  }>;
  pending_clarifications: string[];
  mail_drafts: Array<{
    id: string;
    subject: string;
    status: string;
  }>;
}

const DAY_NAMES: Record<number, string> = {
  0: "ראשון",
  1: "שני",
  2: "שלישי",
  3: "רביעי",
  4: "חמישי",
  5: "שישי",
  6: "שבת",
};

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
            // No rows found - this is expected for no report today
            setReport(null);
          } else {
            setError("Failed to fetch daily report");
            console.error("Supabase error:", err);
          }
        } else if (data) {
          setReport(data as DailyReport);
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

  const handleCheckActionItem = async (itemId: string, done: boolean) => {
    if (!report) return;

    try {
      const updatedItems = report.action_items.map((item) =>
        item.id === itemId ? { ...item, done: !item.done } : item
      );

      const { error: err } = await supabase
        .from("daily_reports")
        .update({ action_items: updatedItems })
        .eq("id", report.id);

      if (err) {
        console.error("Failed to update action item:", err);
      } else {
        setReport({ ...report, action_items: updatedItems });
      }
    } catch (err) {
      console.error("Error updating action item:", err);
    }
  };

  const handleApproveDraft = async (draftId: string) => {
    if (!report) return;

    try {
      const updatedDrafts = report.mail_drafts.map((draft) =>
        draft.id === draftId ? { ...draft, status: "approved" } : draft
      );

      const { error: err } = await supabase
        .from("daily_reports")
        .update({ mail_drafts: updatedDrafts })
        .eq("id", report.id);

      if (err) {
        console.error("Failed to approve draft:", err);
      } else {
        setReport({ ...report, mail_drafts: updatedDrafts });
      }
    } catch (err) {
      console.error("Error approving draft:", err);
    }
  };

  if (loading) {
    return (
      <div className="bg-card rounded-xl border shadow-sm p-8 flex items-center justify-center">
        <div className="text-center">
          <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2 animate-spin" />
          <p className="text-sm text-muted-foreground">טוען סקירה...</p>
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
        <p className="text-sm text-muted-foreground">אין סקירה להיום</p>
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

  const redItems = report.action_items.filter((item) => item.priority === "red");
  const orangeItems = report.action_items.filter(
    (item) => item.priority === "orange" || item.priority === "yellow"
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-gradient-to-l from-primary/20 to-primary/10 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
        <Sun className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-foreground text-right">
            סקירת בוקר — {report.day_name} {formatDate(report.report_date)}
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {/* Cobra Updates Section */}
        {report.cobra_updates && report.cobra_updates.length > 0 && (
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <div className="bg-blue-50 border-b border-blue-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-blue-900 text-right flex items-center gap-2 justify-end">
                <span>עדכוני Cobra</span>
                <CheckCircle2 className="h-4 w-4" />
              </h3>
            </div>
            <div className="p-4 space-y-2">
              {report.cobra_updates.map((update, idx) => (
                <div key={idx} className="flex items-start gap-3 text-right">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                  <p className="text-sm text-foreground">{update}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Red Priority Action Items */}
        {redItems.length > 0 && (
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <div className="bg-red-50 border-b border-red-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-red-900 text-right flex items-center gap-2 justify-end">
                <span>דחוף - פעולות נדרשות</span>
                <AlertTriangle className="h-4 w-4" />
              </h3>
            </div>
            <div className="p-4 space-y-2">
              {redItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-end gap-3 py-2 px-2 hover:bg-muted/40 rounded-lg transition-colors"
                >
                  <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => handleCheckActionItem(item.id, item.done)}
                      className="rounded w-4 h-4"
                    />
                    <span
                      className={cn(
                        "text-sm flex-1 text-right",
                        item.done && "line-through text-muted-foreground"
                      )}
                    >
                      {item.title}
                    </span>
                  </label>
                  {item.done ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Orange/Yellow Priority Action Items */}
        {orangeItems.length > 0 && (
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <div className="bg-yellow-50 border-b border-yellow-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-yellow-900 text-right flex items-center gap-2 justify-end">
                <span>פעולות - עדיפות בינוני</span>
                <Clock className="h-4 w-4" />
              </h3>
            </div>
            <div className="p-4 space-y-2">
              {orangeItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-end gap-3 py-2 px-2 hover:bg-muted/40 rounded-lg transition-colors"
                >
                  <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => handleCheckActionItem(item.id, item.done)}
                      className="rounded w-4 h-4"
                    />
                    <span
                      className={cn(
                        "text-sm flex-1 text-right",
                        item.done && "line-through text-muted-foreground"
                      )}
                    >
                      {item.title}
                    </span>
                  </label>
                  {item.done ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                  )}
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
                <span>הבהרות ממתינות</span>
                <AlertTriangle className="h-4 w-4" />
              </h3>
            </div>
            <div className="p-4 space-y-2">
              {report.pending_clarifications.map((clarification, idx) => (
                <div key={idx} className="flex items-start gap-3 text-right">
                  <div className="h-1.5 w-1.5 rounded-full bg-orange-500 flex-shrink-0 mt-1.5" />
                  <p className="text-sm text-foreground">{clarification}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mail Drafts Section */}
        {report.mail_drafts && report.mail_drafts.length > 0 && (
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <div className="bg-blue-50 border-b border-blue-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-blue-900 text-right flex items-center gap-2 justify-end">
                <span>טיוטות דוא"ל ({report.mail_drafts.length})</span>
                <Mail className="h-4 w-4" />
              </h3>
            </div>
            <div className="p-4 space-y-2">
              {report.mail_drafts.map((draft) => (
                <div
                  key={draft.id}
                  className="flex items-center justify-between p-2 hover:bg-muted/40 rounded-lg transition-colors"
                >
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleApproveDraft(draft.id)}
                    disabled={draft.status === "approved"}
                    className={cn(
                      "text-xs",
                      draft.status === "approved" && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    {draft.status === "approved" ? "אושר" : "אשר"}
                  </Button>
                  <span className="text-sm text-foreground text-right flex-1 min-w-0 truncate">
                    {draft.subject}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
