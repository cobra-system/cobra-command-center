import { useState, useEffect, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/lib/supabase";
import { useAuth, useData } from "@/contexts/AppContext";
import { toast } from "sonner";
import { format, formatDistanceToNow, addDays } from "date-fns";
import { he } from "date-fns/locale";
import {
  Pencil, MessageSquare, Clock, ShoppingCart, Ban, RotateCcw, Trash2, ExternalLink,
  Send, AlertTriangle, Lightbulb, Paperclip, Info, Truck, Sparkles,
} from "lucide-react";
import type { OrderRequest, OrderRequestHistory, OrderRequestComment, OrderRequestAttachment } from "@/contexts/types";
import {
  fmtNum, fmtPct, urgencyClass, statusClass, STATUS_LABELS,
  utilizationColor, daysSince, suggestUrgency, ageBadge,
} from "./orderRequestUtils";

interface Props {
  request: OrderRequest | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (req: OrderRequest) => void;
  onFulfill: (req: OrderRequest) => void;
  onReject: (req: OrderRequest) => void;
  onDelete: (req: OrderRequest) => void;
  onRevert: (req: OrderRequest) => void;
  onRefresh: () => void;
  navigateToOrder: (orderId: string) => void;
  navigateToProduct: (productId: string) => void;
  navigateToSupplier: (name: string) => void;
}

const FIELD_LABELS: Record<string, string> = {
  status: "סטטוס",
  quantity: "כמות",
  required_to_order: "כמות",
  urgency: "דחיפות",
  division_stock: "מלאי חטיבה",
  order_execution_date: "תאריך ביצוע",
};

const ACTION_LABELS: Record<OrderRequestHistory["action"], string> = {
  created: "נוצרה",
  updated: "עודכן",
  status_changed: "סטטוס שונה",
  fulfilled: "אושרה והוזמנה",
  rejected: "נדחתה",
  cancelled: "בוטלה",
  reverted: "הוחזרה ל-ממתין",
};

export function RequestDetailPanel({
  request,
  onOpenChange,
  onEdit,
  onFulfill,
  onReject,
  onDelete,
  onRevert,
  onRefresh,
  navigateToOrder,
  navigateToProduct,
  navigateToSupplier,
}: Props) {
  const { currentUser } = useAuth();
  const { suppliers } = useData();
  const [tab, setTab] = useState<"details" | "history" | "comments" | "files">("details");
  const [history, setHistory] = useState<OrderRequestHistory[]>([]);
  const [comments, setComments] = useState<OrderRequestComment[]>([]);
  const [attachments, setAttachments] = useState<OrderRequestAttachment[]>([]);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [newFileUrl, setNewFileUrl] = useState("");
  const [newFileName, setNewFileName] = useState("");
  const [newFileDesc, setNewFileDesc] = useState("");
  const [savingFile, setSavingFile] = useState(false);
  const isManager = currentUser?.role === "MANAGER";

  const fetchHistory = useCallback(async (id: string) => {
    const { data } = await supabase
      .from("order_request_history")
      .select("*")
      .eq("request_id", id)
      .order("changed_at", { ascending: false });
    setHistory((data ?? []) as OrderRequestHistory[]);
  }, []);

  const fetchComments = useCallback(async (id: string) => {
    const { data } = await supabase
      .from("order_request_comments")
      .select("*")
      .eq("request_id", id)
      .order("created_at", { ascending: false });
    setComments((data ?? []) as OrderRequestComment[]);
  }, []);

  const fetchAttachments = useCallback(async (id: string) => {
    const { data } = await supabase
      .from("order_request_attachments")
      .select("*")
      .eq("request_id", id)
      .order("created_at", { ascending: false });
    setAttachments((data ?? []) as OrderRequestAttachment[]);
  }, []);

  useEffect(() => {
    if (!request) return;
    setTab("details");
    void fetchHistory(request.id);
    void fetchComments(request.id);
    void fetchAttachments(request.id);
  }, [request, fetchHistory, fetchComments, fetchAttachments]);

  // Realtime: when comments/history/attachments change, refresh
  useEffect(() => {
    if (!request) return;
    const ch = supabase
      .channel(`req-${request.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_request_comments", filter: `request_id=eq.${request.id}` },
        () => void fetchComments(request.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "order_request_history", filter: `request_id=eq.${request.id}` },
        () => void fetchHistory(request.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "order_request_attachments", filter: `request_id=eq.${request.id}` },
        () => void fetchAttachments(request.id))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [request, fetchComments, fetchHistory, fetchAttachments]);

  const submitAttachment = async () => {
    if (!request || !newFileUrl.trim() || !newFileName.trim()) {
      toast.error("שם וקישור חובה");
      return;
    }
    setSavingFile(true);
    const { error } = await supabase.from("order_request_attachments").insert({
      request_id: request.id,
      file_name: newFileName.trim(),
      file_url: newFileUrl.trim(),
      description: newFileDesc.trim() || null,
      created_by: currentUser?.id ?? null,
      created_by_name: currentUser?.name ?? null,
    });
    setSavingFile(false);
    if (error) { toast.error("שגיאה בצירוף הקובץ"); return; }
    setNewFileName(""); setNewFileUrl(""); setNewFileDesc("");
    void fetchAttachments(request.id);
  };

  const deleteAttachment = async (id: string) => {
    if (!confirm("למחוק את הקובץ המצורף?")) return;
    const { error } = await supabase.from("order_request_attachments").delete().eq("id", id);
    if (error) { toast.error("שגיאה במחיקה"); return; }
    if (request) void fetchAttachments(request.id);
  };

  const submitComment = async () => {
    if (!request || !draft.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("order_request_comments").insert({
      request_id: request.id,
      body: draft.trim(),
      created_by: currentUser?.id ?? null,
      created_by_name: currentUser?.name ?? null,
      created_by_role: currentUser?.role ?? null,
    });
    setSaving(false);
    if (error) { toast.error("שגיאה בפרסום התגובה"); return; }
    setDraft("");
    void fetchComments(request.id);
  };

  const deleteComment = async (id: string) => {
    if (!confirm("למחוק את התגובה?")) return;
    const { error } = await supabase.from("order_request_comments").delete().eq("id", id);
    if (error) { toast.error("שגיאה במחיקה"); return; }
    if (request) void fetchComments(request.id);
  };

  if (!request) return null;

  const suggested = suggestUrgency(request);
  const stale = (() => {
    const d = daysSince(request.updated_at ?? request.created_at);
    return d !== null && d >= 30;
  })();
  const age = ageBadge(request);
  const supplierForLink = suppliers.find(s => s.company === request.supplier);
  const editable = isManager || (currentUser?.division === request.division && request.status === "pending");

  return (
    <Sheet open={!!request} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-2xl overflow-y-auto" dir="rtl">
        <SheetHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="text-right">
                {request.product_id ? (
                  <button onClick={() => navigateToProduct(request.product_id!)} className="hover:underline">
                    {request.product_name}
                  </button>
                ) : request.product_name}
              </SheetTitle>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusClass(request.status)}`}>
                  {STATUS_LABELS[request.status]}
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${urgencyClass(request.urgency)}`}>
                  {request.urgency}
                </span>
                {age && <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${age.cls}`}>{age.text}</span>}
                {stale && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-orange-50 text-orange-700 border-orange-200 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> מיושן
                  </span>
                )}
                {suggested && suggested !== request.urgency && editable && (
                  <button
                    className="text-xs font-medium px-2 py-0.5 rounded-full border bg-purple-50 text-purple-700 border-purple-200 flex items-center gap-1 hover:bg-purple-100 transition-colors"
                    title="לחץ ליישום הדחיפות המומלצת"
                    onClick={async () => {
                      const { error } = await supabase.from("order_requests").update({ urgency: suggested }).eq("id", request.id);
                      if (error) toast.error("שגיאה בעדכון");
                      else { toast.success("הדחיפות עודכנה"); onRefresh(); }
                    }}
                  >
                    <Lightbulb className="h-3 w-3" /> החל המלצה: {suggested}
                  </button>
                )}
                {suggested && suggested !== request.urgency && !editable && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-purple-50 text-purple-700 border-purple-200 flex items-center gap-1" title="לפי המלאי הנוכחי המערכת מציעה דחיפות גבוהה יותר">
                    <Lightbulb className="h-3 w-3" /> מומלץ: {suggested}
                  </span>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Action bar */}
        <div className="flex flex-wrap gap-2 mt-4 pb-4 border-b">
          {editable && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onEdit(request)}>
              <Pencil className="h-3.5 w-3.5" /> ערוך
            </Button>
          )}
          {request.status === "pending" && isManager && (
            <Button size="sm" className="gap-1.5" onClick={() => onFulfill(request)}>
              <ShoppingCart className="h-3.5 w-3.5" /> הזמן
            </Button>
          )}
          {request.status === "pending" && isManager && (
            <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => onReject(request)}>
              <Ban className="h-3.5 w-3.5" /> דחה
            </Button>
          )}
          {request.status === "ordered" && request.order_id && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigateToOrder(request.order_id!)}>
              <ExternalLink className="h-3.5 w-3.5" /> פתח הזמנה
            </Button>
          )}
          {(request.status === "rejected" || request.status === "cancelled") && isManager && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onRevert(request)}>
              <RotateCcw className="h-3.5 w-3.5" /> החזר
            </Button>
          )}
          {editable && (
            <Button size="sm" variant="ghost" className="gap-1.5 text-red-600" onClick={() => onDelete(request)}>
              <Trash2 className="h-3.5 w-3.5" /> מחק
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 border-b">
          {[
            { k: "details", label: "פרטים", icon: Pencil },
            { k: "history", label: `היסטוריה (${history.length})`, icon: Clock },
            { k: "comments", label: `תגובות (${comments.length})`, icon: MessageSquare },
            { k: "files", label: `קבצים (${attachments.length})`, icon: Paperclip },
          ].map(t => (
            <button
              key={t.k}
              onClick={() => setTab(t.k as typeof tab)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                tab === t.k ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="mt-4">
          {tab === "details" && (
            <div className="space-y-4 text-sm">
              {request.reject_reason && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <div className="text-xs font-semibold text-red-700 mb-0.5">סיבת דחייה</div>
                  <div className="text-red-800">{request.reject_reason}</div>
                  {request.reviewed_by_name && (
                    <div className="text-[11px] text-red-600 mt-1">
                      ע"י {request.reviewed_by_name}{request.reviewed_at ? ` · ${format(new Date(request.reviewed_at), "dd/MM/yyyy")}` : ""}
                    </div>
                  )}
                </div>
              )}

              <DetailGrid>
                <Detail label="חטיבה" value={request.division} />
                <Detail label="מק״ט" value={request.product_sku ?? "—"} dir="ltr" />
                <Detail
                  label="ספק"
                  value={request.supplier ? (
                    <button
                      className={supplierForLink ? "hover:underline" : ""}
                      onClick={() => supplierForLink && navigateToSupplier(request.supplier!)}
                    >
                      {request.supplier}
                    </button>
                  ) : "—"}
                />
                <Detail label="סוג הזמנה" value={request.order_type} />
                <Detail
                  label="כמות"
                  value={fmtNum(request.required_to_order ?? request.quantity)}
                  highlight={((request.required_to_order ?? request.quantity) ?? 0) > 0}
                />
              </DetailGrid>

              <Section title="מלאי וצפי">
                <DetailGrid>
                  <Detail
                    label={<LabelWithHelp text="מלאי חטיבה" help="הערך הנוכחי החי. מתעדכן בכל שינוי." />}
                    value={
                      <div className="flex items-baseline gap-2">
                        <span>{fmtNum(request.division_stock)}</span>
                        {request.division_stock_at_request != null
                         && request.division_stock_at_request !== request.division_stock && (
                          <span className="text-[10px] text-muted-foreground" title="מלאי שהיה בעת יצירת הבקשה">
                            (היה {fmtNum(request.division_stock_at_request)})
                          </span>
                        )}
                      </div>
                    }
                  />
                  <Detail
                    label={<LabelWithHelp text="צפי רבעון" help="הצריכה הצפויה ברבעון הנוכחי על בסיס היסטוריה." />}
                    value={fmtNum(request.quarterly_forecast)}
                  />
                  <Detail
                    label={<LabelWithHelp text="% מימוש" help="הערכת אחוז הצריכה בפועל מתוך הצפי. ערך נמוך משמעותו פחות צריכה ולכן פחות צורך להזמין." />}
                    value={<span className={utilizationColor(request.utilization_pct)}>{fmtPct(request.utilization_pct)}</span>}
                  />
                  <Detail label='עול"ב' value={<span>{fmtNum(request.incoming_orders)}<HelpDot help="עומס לב — כמות שכבר בהזמנה אך טרם הגיעה." /></span>} />
                  <Detail
                    label={<LabelWithHelp text="נדרש משוכלל" help="צפי × % מימוש + מלאי ביטחון. אומדן הכמות הריאלית הדרושה." />}
                    value={fmtNum(request.smoothed_required)}
                  />
                </DetailGrid>
              </Section>

              {/* Lead time intelligence */}
              {(() => {
                const leadDays = supplierForLink?.lead_time_days ?? null;
                if (!leadDays) return null;
                const today = new Date();
                const exec = request.order_execution_date ? new Date(request.order_execution_date) : null;
                const wouldArrive = exec ? addDays(exec, leadDays) : null;
                const noOrderYet = exec && exec.getTime() > today.getTime() && request.status === "pending";
                return (
                  <div className="rounded-lg border p-3 text-sm flex items-start gap-2 bg-blue-50 border-blue-200">
                    <Truck className="h-4 w-4 mt-0.5 shrink-0 text-blue-700" />
                    <div className="flex-1">
                      <div className="font-semibold text-blue-800">מודיעין ספק</div>
                      <div className="text-xs text-muted-foreground space-y-0.5 mt-0.5">
                        <div>זמן יבוא של {request.supplier}: <span className="font-semibold text-foreground">{leadDays} ימים</span></div>
                        {wouldArrive && noOrderYet && (
                          <div>אם תבוצע ב-{format(exec!, "dd/MM/yy")} צפויה הגעה ב-<span className="font-semibold">{format(wouldArrive, "dd/MM/yy")}</span></div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <Section title="תאריכים ומשלוח">
                <DetailGrid>
                  <Detail
                    label="תאריך ביצוע הזמנה"
                    value={request.order_execution_date ? format(new Date(request.order_execution_date), "dd/MM/yy") : "—"}
                  />
                  <Detail
                    label='תאריך הגעת עול"ב'
                    value={request.incoming_arrival_date ? format(new Date(request.incoming_arrival_date), "dd/MM/yy") : "—"}
                  />
                  <Detail label="סוג משלוח" value={request.shipping_type ?? "—"} />
                  <Detail label="סטטוס תשלום" value={request.payment_status ?? "—"} />
                  <Detail label="כמות שהוזמנה בפועל" value={fmtNum(request.actual_ordered_qty)} />
                </DetailGrid>
              </Section>

              {(request.reason || request.notes || request.current_consumption) && (
                <Section title="פירוט">
                  {request.reason && <NoteBlock label="סיבת ההזמנה" body={request.reason} />}
                  {request.current_consumption && <NoteBlock label="צריכה חודשית ממוצעת" body={request.current_consumption} />}
                  {request.notes && <NoteBlock label="הערות" body={request.notes} />}
                </Section>
              )}

              <Section title="מעקב">
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div>נוצרה: {request.created_by_name ?? "—"} · {format(new Date(request.created_at), "dd/MM/yyyy HH:mm")}</div>
                  {request.updated_at && request.updated_at !== request.created_at && (
                    <div>עודכנה לאחרונה: {format(new Date(request.updated_at), "dd/MM/yyyy HH:mm")} ({formatDistanceToNow(new Date(request.updated_at), { addSuffix: true, locale: he })})</div>
                  )}
                  {request.ordered_by_name && request.ordered_at && (
                    <div>הוזמנה: {request.ordered_by_name} · {format(new Date(request.ordered_at), "dd/MM/yyyy HH:mm")}</div>
                  )}
                </div>
              </Section>
            </div>
          )}

          {tab === "history" && (
            <div className="space-y-2 text-sm">
              {history.length === 0 ? (
                <p className="text-muted-foreground text-sm py-6 text-center">אין רישומי היסטוריה</p>
              ) : history.map(h => (
                <div key={h.id} className="border-r-2 border-primary/30 ps-3 py-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold">{ACTION_LABELS[h.action]}</span>
                    {h.field_name && <span className="text-muted-foreground">· {FIELD_LABELS[h.field_name] ?? h.field_name}</span>}
                  </div>
                  {h.field_name && (h.old_value || h.new_value) && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      <span className="line-through">{h.old_value ?? "∅"}</span>
                      {" → "}
                      <span className="text-foreground">{h.new_value ?? "∅"}</span>
                    </div>
                  )}
                  {h.note && <div className="text-xs text-muted-foreground mt-0.5">{h.note}</div>}
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {h.changed_by_name ?? "מערכת"} · {format(new Date(h.changed_at), "dd/MM/yyyy HH:mm")}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "files" && (
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                <div className="text-xs font-semibold">צרף קובץ (קישור)</div>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={newFileName} onChange={e => setNewFileName(e.target.value)} placeholder="שם הקובץ" />
                  <Input value={newFileUrl} onChange={e => setNewFileUrl(e.target.value)} placeholder="https://..." dir="ltr" />
                </div>
                <Input value={newFileDesc} onChange={e => setNewFileDesc(e.target.value)} placeholder="תיאור (אופציונלי)" />
                <div className="flex justify-end">
                  <Button size="sm" onClick={submitAttachment} disabled={savingFile || !newFileUrl.trim() || !newFileName.trim()} className="gap-1.5">
                    <Paperclip className="h-3.5 w-3.5" /> {savingFile ? "שומר..." : "צרף"}
                  </Button>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  הקובץ עצמו צריך להיות זמין ב-URL ציבורי או דרך מערכת המסמכים. אפשר להדביק קישור ל-Drive, מסמך מהמערכת, וכו׳.
                </div>
              </div>
              <div className="space-y-2">
                {attachments.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-6 text-center">אין קבצים מצורפים</p>
                ) : attachments.map(a => (
                  <div key={a.id} className="rounded-lg border bg-card p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <a href={a.file_url} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline flex items-center gap-1.5">
                        <Paperclip className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{a.file_name}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                      </a>
                      {a.description && <div className="text-xs text-muted-foreground mt-0.5">{a.description}</div>}
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {a.created_by_name ?? "אנונימי"} · {format(new Date(a.created_at), "dd/MM/yyyy")}
                      </div>
                    </div>
                    {(a.created_by === currentUser?.id || isManager) && (
                      <button onClick={() => deleteAttachment(a.id)} className="text-muted-foreground hover:text-destructive shrink-0" title="מחק">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "comments" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  placeholder="כתוב תגובה... (Ctrl+Enter לשליחה)"
                  rows={3}
                  onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submitComment(); } }}
                />
                <div className="flex justify-end">
                  <Button size="sm" onClick={submitComment} disabled={saving || !draft.trim()} className="gap-1.5">
                    <Send className="h-3.5 w-3.5" /> {saving ? "שולח..." : "שלח"}
                  </Button>
                </div>
              </div>
              <div className="space-y-2 mt-3">
                {comments.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-6 text-center">אין תגובות עדיין</p>
                ) : comments.map(c => (
                  <div key={c.id} className="rounded-lg border bg-muted/20 p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <span>{c.created_by_name ?? "אנונימי"}</span>
                        {c.created_by_role === "MANAGER" && (
                          <span className="text-[10px] px-1.5 py-0 rounded bg-primary/10 text-primary border border-primary/20">מנהל רכש</span>
                        )}
                        <span className="text-muted-foreground font-normal">
                          · {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: he })}
                        </span>
                      </div>
                      {(c.created_by === currentUser?.id || isManager) && (
                        <button
                          onClick={() => deleteComment(c.id)}
                          className="text-xs text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <div className="text-sm whitespace-pre-wrap">{c.body}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Detail({ label, value, highlight, dir }: { label: React.ReactNode; value: React.ReactNode; highlight?: boolean; dir?: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`text-sm tabular-nums ${highlight ? "font-semibold text-foreground" : ""}`} dir={dir}>{value}</div>
    </div>
  );
}

function DetailGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{children}</div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 pt-3 border-t">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

function NoteBlock({ label, body }: { label: string; body: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm whitespace-pre-wrap rounded-md border bg-muted/20 p-2">{body}</div>
    </div>
  );
}

function LabelWithHelp({ text, help }: { text: string; help: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {text}
      <HelpDot help={help} />
    </span>
  );
}

function HelpDot({ help }: { help: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center cursor-help text-muted-foreground/60 hover:text-muted-foreground">
            <Info className="h-3 w-3" />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{help}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
