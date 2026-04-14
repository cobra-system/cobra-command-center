import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, ShoppingCart, CheckCircle, Clock, XCircle, AlertCircle, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { toast } from "sonner";
import type { Meeting, ProcurementDecision } from "./types";
import type { Order } from "@/contexts/AppContext";

// ─── Types ───────────────────────────────────────────────────────────────────

interface OrderPayment {
  id: string;
  order_id: string;
  payment_type: string;
  amount: number;
  currency: string;
  due_date: string | null;
  status: string;
}

interface AgendaOrder {
  meetingOrderId: string;
  order: Order & { currency?: string | null };
  pendingPayments: OrderPayment[];
  decision: ProcurementDecision;
  approvedAmount: number | string;
  notes: string;
  saving: boolean;
}

type PendingOrderRow = Order & { currency?: string | null; pendingPayments: OrderPayment[] };

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DECISION_OPTIONS: { value: ProcurementDecision; label: string; color: string }[] = [
  { value: "pending",  label: "ממתין",  color: "bg-muted text-muted-foreground" },
  { value: "approved", label: "אושר",   color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  { value: "partial",  label: "חלקי",   color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  { value: "deferred", label: "נדחה",   color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
];

const PRIORITY_LABEL: Record<string, string> = { "דחוף": "דחוף", "גבוה": "גבוה", "בינוני": "בינוני", "נמוך": "נמוך" };

function fmtAmount(amount: number | null | undefined, currency?: string | null) {
  if (!amount) return "—";
  const sym = currency === "EUR" ? "€" : currency === "ILS" ? "₪" : "$";
  return `${sym}${amount.toLocaleString()}`;
}

function DecisionBadge({ decision }: { decision: ProcurementDecision }) {
  const opt = DECISION_OPTIONS.find(d => d.value === decision)!;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${opt.color}`}>{opt.label}</span>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProcurementMeetingTab() {
  const [meetings, setMeetings]         = useState<Meeting[]>([]);
  const [selectedId, setSelectedId]     = useState<string>("");
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [loadingMeetings, setLoadingMeetings] = useState(true);

  // Pending orders (not yet on agenda)
  const [pendingOrders, setPendingOrders]   = useState<PendingOrderRow[]>([]);
  const [loadingOrders, setLoadingOrders]   = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
  const [showPendingSection, setShowPendingSection] = useState(true);

  // Agenda
  const [agendaOrders, setAgendaOrders] = useState<AgendaOrder[]>([]);
  const [loadingAgenda, setLoadingAgenda] = useState(false);
  const [addingToAgenda, setAddingToAgenda] = useState(false);
  const [closing, setClosing] = useState(false);

  // ── Fetch procurement meetings ──────────────────────────────────────────
  const fetchMeetings = useCallback(async () => {
    setLoadingMeetings(true);
    const { data } = await supabase
      .from("meetings")
      .select("*")
      .eq("type", "procurement")
      .order("meeting_date", { ascending: false })
      .limit(30);
    if (data) setMeetings(data as Meeting[]);
    setLoadingMeetings(false);
  }, []);

  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);

  // ── Auto-select the most recent open meeting on first load ───────────
  useEffect(() => {
    if (selectedId || meetings.length === 0) return;
    const openMeeting = meetings.find(m => m.status === "open");
    if (openMeeting) setSelectedId(openMeeting.id);
  }, [meetings, selectedId]);

  // ── When a meeting is selected ────────────────────────────────────────
  useEffect(() => {
    if (!selectedId) { setSelectedMeeting(null); return; }
    const m = meetings.find(x => x.id === selectedId) ?? null;
    setSelectedMeeting(m);
    if (m) {
      fetchPendingOrders(m.id);
      fetchAgenda(m.id);
    }
  }, [selectedId, meetings]);

  // ── Fetch pending orders (not yet on this meeting's agenda) ──────────
  const fetchPendingOrders = useCallback(async (meetingId: string) => {
    setLoadingOrders(true);

    // Group A: orders with pending payments
    const { data: paymentsData } = await supabase
      .from("order_payments")
      .select("order_id, id, payment_type, amount, currency, due_date, status")
      .eq("status", "ממתין");

    const paymentsByOrder: Record<string, OrderPayment[]> = {};
    for (const p of (paymentsData || []) as OrderPayment[]) {
      if (!paymentsByOrder[p.order_id]) paymentsByOrder[p.order_id] = [];
      paymentsByOrder[p.order_id].push(p);
    }
    const orderIdsWithPayments = Object.keys(paymentsByOrder);

    // Group B: PI pending approval (PENDING status, no payments at all)
    const { data: pendingPiData } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "PENDING")
      .not("pi_number", "is", null);

    const piOrderIds = (pendingPiData || [])
      .map((o: Record<string, unknown>) => o.id as string)
      .filter(id => !orderIdsWithPayments.includes(id));

    // Fetch full order data for both groups
    const allOrderIds = [...new Set([...orderIdsWithPayments, ...piOrderIds])];

    if (allOrderIds.length === 0) {
      setPendingOrders([]);
      setLoadingOrders(false);
      return;
    }

    const { data: ordersData } = await supabase
      .from("orders")
      .select("*")
      .in("id", allOrderIds)
      .not("status", "eq", "CANCELLED")
      .not("status", "eq", "ARRIVED");

    // Find which orders are already on this meeting
    const { data: alreadyOnMeeting } = await supabase
      .from("procurement_meeting_orders")
      .select("order_id")
      .eq("meeting_id", meetingId);

    const alreadyIds = new Set((alreadyOnMeeting || []).map((r: Record<string, unknown>) => r.order_id as string));

    const rows: PendingOrderRow[] = ((ordersData || []) as Order[])
      .filter(o => !alreadyIds.has(o.id))
      .map(o => ({
        ...o,
        pendingPayments: paymentsByOrder[o.id] || [],
      }));

    // Sort: orders with payments first, then by priority
    const priorityOrder = ["דחוף", "גבוה", "בינוני", "נמוך"];
    rows.sort((a, b) => {
      const aHasPayment = a.pendingPayments.length > 0 ? 0 : 1;
      const bHasPayment = b.pendingPayments.length > 0 ? 0 : 1;
      if (aHasPayment !== bHasPayment) return aHasPayment - bHasPayment;
      return priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
    });

    setPendingOrders(rows);
    setLoadingOrders(false);
  }, []);

  // ── Fetch agenda ──────────────────────────────────────────────────────
  const fetchAgenda = useCallback(async (meetingId: string) => {
    setLoadingAgenda(true);
    const { data, error } = await supabase
      .from("procurement_meeting_orders")
      .select(`
        id, decision, approved_amount, notes, order_id,
        orders!inner(id, supplier_name, pi_number, status, total_price, priority, eta, etd, notes, tracking_number)
      `)
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: true });

    if (error) { setLoadingAgenda(false); return; }

    const rows = (data || []) as Record<string, unknown>[];

    // Enrich with pending payments
    const orderIds = rows.map(r => (r.orders as Record<string, unknown>).id as string);
    let payments: OrderPayment[] = [];
    if (orderIds.length > 0) {
      const { data: pData } = await supabase
        .from("order_payments")
        .select("id, order_id, payment_type, amount, currency, due_date, status")
        .in("order_id", orderIds)
        .eq("status", "ממתין");
      payments = (pData || []) as OrderPayment[];
    }

    const paysByOrder: Record<string, OrderPayment[]> = {};
    for (const p of payments) {
      if (!paysByOrder[p.order_id]) paysByOrder[p.order_id] = [];
      paysByOrder[p.order_id].push(p);
    }

    const agenda: AgendaOrder[] = rows.map(r => {
      const order = r.orders as Order;
      return {
        meetingOrderId: r.id as string,
        order,
        pendingPayments: paysByOrder[order.id] || [],
        decision: (r.decision as ProcurementDecision) || "pending",
        approvedAmount: r.approved_amount != null ? String(r.approved_amount) : "",
        notes: (r.notes as string) || "",
        saving: false,
      };
    });

    setAgendaOrders(agenda);
    setLoadingAgenda(false);
  }, []);

  // ── Add selected orders to agenda ─────────────────────────────────────
  const addToAgenda = async () => {
    if (!selectedMeeting || selectedOrderIds.size === 0) return;
    setAddingToAgenda(true);

    const inserts = Array.from(selectedOrderIds).map(order_id => ({
      meeting_id: selectedMeeting.id,
      order_id,
      decision: "pending" as const,
    }));

    const { error } = await supabase.from("procurement_meeting_orders").insert(inserts);
    if (error) {
      toast.error(`שגיאה: ${error.message}`);
    } else {
      toast.success(`${inserts.length} הזמנות נוספו לסדר היום`);
      setSelectedOrderIds(new Set());
      fetchPendingOrders(selectedMeeting.id);
      fetchAgenda(selectedMeeting.id);
    }
    setAddingToAgenda(false);
  };

  // ── Update a single agenda item decision ──────────────────────────────
  const updateDecision = async (agendaItem: AgendaOrder, field: "decision" | "approvedAmount" | "notes", value: string) => {
    // Optimistic local update
    setAgendaOrders(prev => prev.map(a => {
      if (a.meetingOrderId !== agendaItem.meetingOrderId) return a;
      return { ...a, [field]: value, saving: true };
    }));

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (field === "decision")       updates.decision        = value;
    if (field === "approvedAmount") updates.approved_amount = value === "" ? null : Number(value);
    if (field === "notes")          updates.notes           = value || null;

    const { error } = await supabase
      .from("procurement_meeting_orders")
      .update(updates)
      .eq("id", agendaItem.meetingOrderId);

    setAgendaOrders(prev => prev.map(a =>
      a.meetingOrderId === agendaItem.meetingOrderId ? { ...a, saving: false } : a
    ));

    if (error) toast.error(`שגיאה: ${error.message}`);
  };

  // ── Remove from agenda ────────────────────────────────────────────────
  const removeFromAgenda = async (agendaItem: AgendaOrder) => {
    const { error } = await supabase
      .from("procurement_meeting_orders")
      .delete()
      .eq("id", agendaItem.meetingOrderId);

    if (error) { toast.error(`שגיאה: ${error.message}`); return; }
    setAgendaOrders(prev => prev.filter(a => a.meetingOrderId !== agendaItem.meetingOrderId));
    if (selectedMeeting) fetchPendingOrders(selectedMeeting.id);
  };

  // ── Close meeting ─────────────────────────────────────────────────────
  const closeMeeting = async () => {
    if (!selectedMeeting) return;
    setClosing(true);
    const { error } = await supabase
      .from("meetings")
      .update({ status: "closed", updated_at: new Date().toISOString() })
      .eq("id", selectedMeeting.id);

    if (error) {
      toast.error(`שגיאה: ${error.message}`);
    } else {
      toast.success("הישיבה נסגרה");
      fetchMeetings();
    }
    setClosing(false);
  };

  // ── Create procurement meeting for today ──────────────────────────────
  const createTodayMeeting = async () => {
    const today = new Date();
    const title = `ישיבת רכש — ${today.toLocaleDateString("he-IL")}`;
    const { data, error } = await supabase
      .from("meetings")
      .insert({ title, meeting_date: today.toISOString(), type: "procurement", status: "open" })
      .select()
      .single();

    if (error) { toast.error(`שגיאה: ${error.message}`); return; }
    toast.success("ישיבה חדשה נוצרה");
    await fetchMeetings();
    setSelectedId((data as Meeting).id);
  };

  // ── Filtered pending orders ───────────────────────────────────────────
  const filteredPending = pendingOrders.filter(o => {
    if (filterSupplier && !(o.supplier_name?.toLowerCase().includes(filterSupplier.toLowerCase()))) return false;
    if (filterPriority !== "all" && o.priority !== filterPriority) return false;
    return true;
  });

  // Split into two groups for display
  const groupA = filteredPending.filter(o => o.pendingPayments.length > 0);
  const groupB = filteredPending.filter(o => o.pendingPayments.length === 0);

  // ── Summary bar ───────────────────────────────────────────────────────
  const summaryByCurrency: Record<string, number> = {};
  for (const a of agendaOrders) {
    if (a.decision !== "approved" && a.decision !== "partial") continue;
    const payments = a.pendingPayments;
    if (payments.length === 0) continue;
    for (const p of payments) {
      const amt = a.decision === "partial" && a.approvedAmount !== ""
        ? Number(a.approvedAmount)
        : p.amount;
      summaryByCurrency[p.currency] = (summaryByCurrency[p.currency] || 0) + (amt || 0);
    }
  }

  const isClosed = selectedMeeting?.status === "closed";

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* Meeting selector */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-48">
          <Select value={selectedId} onValueChange={setSelectedId} disabled={loadingMeetings}>
            <SelectTrigger>
              <SelectValue placeholder={loadingMeetings ? "טוען ישיבות..." : "בחר ישיבת רכש..."} />
            </SelectTrigger>
            <SelectContent>
              {meetings.map(m => (
                <SelectItem key={m.id} value={m.id}>
                  <span className="flex items-center gap-2">
                    {m.status === "closed" && <Lock className="h-3 w-3 text-muted-foreground" />}
                    {m.title} — {new Date(m.meeting_date).toLocaleDateString("he-IL")}
                    {m.status === "closed" && <span className="text-xs text-muted-foreground">(סגורה)</span>}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={createTodayMeeting}>
          <Plus className="h-4 w-4 ml-1" />
          ישיבה חדשה להיום
        </Button>
      </div>

      {!selectedMeeting && (
        <div className="text-center py-16 text-muted-foreground">
          <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>בחר ישיבת רכש כדי להתחיל</p>
        </div>
      )}

      {selectedMeeting && (
        <>
          {/* ── Pending orders section ── */}
          {!isClosed && (
            <div className="border rounded-xl overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors"
                onClick={() => setShowPendingSection(v => !v)}
              >
                <span className="font-semibold text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-warning" />
                  הזמנות ממתינות לטיפול
                  {pendingOrders.length > 0 && (
                    <Badge variant="secondary">{pendingOrders.length}</Badge>
                  )}
                </span>
                {showPendingSection ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showPendingSection && (
                <div className="p-4 space-y-4">
                  {/* Filters */}
                  <div className="flex flex-wrap gap-2">
                    <Input
                      placeholder="סנן לפי ספק..."
                      value={filterSupplier}
                      onChange={e => setFilterSupplier(e.target.value)}
                      className="max-w-48 h-8 text-sm"
                    />
                    <Select value={filterPriority} onValueChange={setFilterPriority}>
                      <SelectTrigger className="w-36 h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">כל העדיפויות</SelectItem>
                        <SelectItem value="דחוף">דחוף</SelectItem>
                        <SelectItem value="גבוה">גבוה</SelectItem>
                        <SelectItem value="בינוני">בינוני</SelectItem>
                        <SelectItem value="נמוך">נמוך</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {loadingOrders ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : filteredPending.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">אין הזמנות ממתינות</p>
                  ) : (
                    <div className="space-y-5">
                      {/* Group A */}
                      {groupA.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                            ממתינות לתשלום ({groupA.length})
                          </p>
                          <PendingOrdersTable
                            orders={groupA}
                            selectedOrderIds={selectedOrderIds}
                            onToggle={id => setSelectedOrderIds(prev => {
                              const next = new Set(prev);
                              if (next.has(id)) { next.delete(id); } else { next.add(id); }
                              return next;
                            })}
                          />
                        </div>
                      )}

                      {/* Group B */}
                      {groupB.length > 0 && (
                        <div>
                          <Separator />
                          <p className="text-xs font-semibold text-muted-foreground mb-2 mt-4 uppercase tracking-wide">
                            PI ממתינות לאישור — אין לוח תשלומים ({groupB.length})
                          </p>
                          <PendingOrdersTable
                            orders={groupB}
                            selectedOrderIds={selectedOrderIds}
                            onToggle={id => setSelectedOrderIds(prev => {
                              const next = new Set(prev);
                              if (next.has(id)) { next.delete(id); } else { next.add(id); }
                              return next;
                            })}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {selectedOrderIds.size > 0 && (
                    <div className="flex items-center justify-between border-t pt-3 mt-3">
                      <span className="text-sm text-muted-foreground">{selectedOrderIds.size} הזמנות נבחרו</span>
                      <Button size="sm" onClick={addToAgenda} disabled={addingToAgenda}>
                        {addingToAgenda ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Plus className="h-4 w-4 ml-1" />}
                        הוסף לסדר יום
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Agenda section ── */}
          <div className="border rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-muted/40 flex items-center justify-between">
              <span className="font-semibold text-sm flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                סדר יום הישיבה
                {agendaOrders.length > 0 && (
                  <Badge variant="secondary">{agendaOrders.length}</Badge>
                )}
              </span>
              {isClosed && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Lock className="h-3 w-3" /> ישיבה סגורה
                </Badge>
              )}
            </div>

            <div className="p-4">
              {loadingAgenda ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : agendaOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {isClosed ? "הישיבה נסגרה ללא הזמנות בסדר היום" : "בחר הזמנות מהרשימה למעלה והוסף לסדר היום"}
                </p>
              ) : (
                <div className="space-y-3">
                  {agendaOrders.map(a => (
                    <AgendaOrderRow
                      key={a.meetingOrderId}
                      item={a}
                      readOnly={isClosed}
                      onDecisionChange={(val) => updateDecision(a, "decision", val)}
                      onAmountChange={(val) => updateDecision(a, "approvedAmount", val)}
                      onNotesChange={(val) => updateDecision(a, "notes", val)}
                      onRemove={() => removeFromAgenda(a)}
                    />
                  ))}
                </div>
              )}

              {/* Summary bar */}
              {agendaOrders.length > 0 && Object.keys(summaryByCurrency).length > 0 && (
                <div className="mt-4 pt-4 border-t flex flex-wrap gap-4 items-center">
                  <span className="text-sm font-semibold">סה"כ מאושר לתשלום:</span>
                  {Object.entries(summaryByCurrency).map(([cur, total]) => (
                    <span key={cur} className="text-sm font-bold text-green-600 dark:text-green-400">
                      {fmtAmount(total, cur)}
                    </span>
                  ))}
                </div>
              )}

              {/* Close button */}
              {!isClosed && agendaOrders.length > 0 && (
                <div className="mt-4 pt-4 border-t flex justify-end">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={closeMeeting}
                    disabled={closing}
                  >
                    {closing ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Lock className="h-4 w-4 ml-1" />}
                    סגור ישיבה
                  </Button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── PendingOrdersTable ───────────────────────────────────────────────────────

function PendingOrdersTable({
  orders,
  selectedOrderIds,
  onToggle,
}: {
  orders: PendingOrderRow[];
  selectedOrderIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
            <th className="p-2 w-8"></th>
            <th className="p-2 text-right">ספק</th>
            <th className="p-2 text-right">PI</th>
            <th className="p-2 text-right">סכום</th>
            <th className="p-2 text-right">תשלום ממתין</th>
            <th className="p-2 text-right">עדיפות</th>
            <th className="p-2 text-right">ETA</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(o => {
            const totalPending = o.pendingPayments.reduce((s, p) => s + p.amount, 0);
            const paymentCurrency = o.pendingPayments[0]?.currency;
            return (
              <tr
                key={o.id}
                className="border-b last:border-0 hover:bg-muted/20 cursor-pointer"
                onClick={() => onToggle(o.id)}
              >
                <td className="p-2">
                  <Checkbox
                    checked={selectedOrderIds.has(o.id)}
                    onCheckedChange={() => onToggle(o.id)}
                    onClick={e => e.stopPropagation()}
                  />
                </td>
                <td className="p-2 font-medium">{o.supplier_name || "—"}</td>
                <td className="p-2 text-muted-foreground">{o.pi_number || "—"}</td>
                <td className="p-2">{fmtAmount(o.total_price ?? null)}</td>
                <td className="p-2">
                  {o.pendingPayments.length > 0 ? (
                    <span className="text-warning font-medium">
                      {fmtAmount(totalPending, paymentCurrency)}
                      <span className="text-xs text-muted-foreground mr-1">({o.pendingPayments.length})</span>
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">אין לוח תשלומים</span>
                  )}
                </td>
                <td className="p-2">
                  <span className="text-xs">{PRIORITY_LABEL[o.priority] || o.priority}</span>
                </td>
                <td className="p-2 text-xs text-muted-foreground">
                  {o.eta ? new Date(o.eta).toLocaleDateString("he-IL") : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── AgendaOrderRow ───────────────────────────────────────────────────────────

function AgendaOrderRow({
  item,
  readOnly,
  onDecisionChange,
  onAmountChange,
  onNotesChange,
  onRemove,
}: {
  item: AgendaOrder;
  readOnly: boolean;
  onDecisionChange: (v: string) => void;
  onAmountChange: (v: string) => void;
  onNotesChange: (v: string) => void;
  onRemove: () => void;
}) {
  const totalPending = item.pendingPayments.reduce((s, p) => s + p.amount, 0);
  const paymentCurrency = item.pendingPayments[0]?.currency;
  const decisionOpt = DECISION_OPTIONS.find(d => d.value === item.decision)!;

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${item.decision === "approved" ? "border-green-200 dark:border-green-900" : item.decision === "deferred" ? "border-orange-200 dark:border-orange-900" : ""}`}>
      <div className="flex flex-wrap items-start gap-2">
        {/* Order info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{item.order.supplier_name}</span>
            {item.order.pi_number && (
              <span className="text-xs text-muted-foreground">PI: {item.order.pi_number}</span>
            )}
            <span className="text-xs text-muted-foreground">{PRIORITY_LABEL[item.order.priority] || item.order.priority}</span>
          </div>
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
            {item.order.total_price && (
              <span>סה"כ: {fmtAmount(item.order.total_price)}</span>
            )}
            {item.pendingPayments.length > 0 && (
              <span className="text-warning">
                ממתין לתשלום: {fmtAmount(totalPending, paymentCurrency)}
                {item.pendingPayments.map(p => (
                  <span key={p.id} className="mr-1">
                    ({p.payment_type}{p.due_date ? ` — ${new Date(p.due_date).toLocaleDateString("he-IL")}` : ""})
                  </span>
                ))}
              </span>
            )}
            {item.pendingPayments.length === 0 && (
              <span className="text-blue-500">PI ממתינה לאישור — אין לוח תשלומים</span>
            )}
          </div>
        </div>

        {/* Decision + remove */}
        <div className="flex items-center gap-2">
          {item.saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {!readOnly ? (
            <Select value={item.decision} onValueChange={onDecisionChange} disabled={readOnly}>
              <SelectTrigger className={`w-28 h-7 text-xs ${decisionOpt.color}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DECISION_OPTIONS.map(d => (
                  <SelectItem key={d.value} value={d.value}>
                    <span className={`text-xs ${d.color} px-1.5 py-0.5 rounded-full`}>{d.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <DecisionBadge decision={item.decision} />
          )}
          {!readOnly && (
            <button
              type="button"
              className="text-muted-foreground hover:text-destructive transition-colors p-1"
              onClick={onRemove}
              title="הסר מסדר היום"
            >
              <XCircle className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Approved amount (shown when partial) */}
      {!readOnly && item.decision === "partial" && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-24">סכום מאושר:</span>
          <Input
            type="number"
            value={item.approvedAmount}
            onChange={e => onAmountChange(e.target.value)}
            onBlur={e => onAmountChange(e.target.value)}
            className="h-7 w-32 text-xs"
            placeholder="0.00"
          />
          {paymentCurrency && <span className="text-xs text-muted-foreground">{paymentCurrency}</span>}
        </div>
      )}
      {readOnly && item.decision === "partial" && item.approvedAmount !== "" && (
        <div className="text-xs text-muted-foreground">
          סכום מאושר: <span className="font-medium">{fmtAmount(Number(item.approvedAmount), paymentCurrency)}</span>
        </div>
      )}

      {/* Notes */}
      {!readOnly && (
        <Input
          value={item.notes}
          onChange={e => onNotesChange(e.target.value)}
          onBlur={e => onNotesChange(e.target.value)}
          placeholder="הערות..."
          className="h-7 text-xs"
        />
      )}
      {readOnly && item.notes && (
        <p className="text-xs text-muted-foreground">{item.notes}</p>
      )}
    </div>
  );
}
