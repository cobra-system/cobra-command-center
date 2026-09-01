import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  Loader2, Plus, ShoppingCart, CheckCircle, XCircle,
  ChevronDown, ChevronUp, Lock, CreditCard, AlertTriangle,
  Zap, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { ColContextMenu, useColMenu, colThContextMenu, trContextMenu } from "@/components/ui/ColContextMenu";
import type { ColDef } from "@/hooks/useColumnVisibility";
import { PriorityBadge } from "@/components/PriorityBadge";
import { OrderStatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import type { Meeting, ProcurementDecision } from "./types";
import { useCurrency } from "@/contexts/AppContext";
import type { Order, Priority, OrderStatus } from "@/contexts/AppContext";

// ─── Column defs ─────────────────────────────────────────────────────────────

const PENDING_COLS: ColDef[] = [
  { id: "supplier",        label: "ספק",          sortField: "supplier" },
  { id: "pi_number",       label: "PI" },
  { id: "total_price",     label: 'סה"כ',         sortField: "total_price" },
  { id: "pending_payment", label: "תשלום ממתין" },
  { id: "priority",        label: "עדיפות",        sortField: "priority" },
  { id: "eta",             label: "ETA",           sortField: "eta" },
] as const;

type PendingSortField = "supplier" | "total_price" | "priority" | "eta";
type SortDir = "asc" | "desc" | null;

const PRIORITY_ORDER: Record<string, number> = { "דחוף": 0, "גבוה": 1, "בינוני": 2, "נמוך": 3 };

// ─── Types ────────────────────────────────────────────────────────────────────

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
  order: Order;
  pendingPayments: OrderPayment[];
  decision: ProcurementDecision;
  approvedAmount: string;
  notes: string;
  saving: boolean;
}

type PendingOrderRow = Order & { pendingPayments: OrderPayment[] };

interface KPIs {
  pendingPaymentsCount: number;
  pendingPaymentsTotals: Record<string, number>;
  overdueCount: number;
  urgentCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DECISION_OPTIONS: { value: ProcurementDecision; label: string; color: string }[] = [
  { value: "pending",  label: "ממתין",  color: "bg-muted text-muted-foreground" },
  { value: "approved", label: "אושר",   color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  { value: "partial",  label: "חלקי",   color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  { value: "deferred", label: "נדחה",   color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
];


function fmtDate(d: string | null | undefined) {
  return d ? format(new Date(d), "dd/MM/yyyy") : "—";
}

function DecisionBadge({ decision }: { decision: ProcurementDecision }) {
  const opt = DECISION_OPTIONS.find(d => d.value === decision)!;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${opt.color}`}>
      {opt.label}
    </span>
  );
}

function useFmtAmount() {
  const { formatPrice } = useCurrency();
  return (amount: number | null | undefined, currency?: string | null) =>
    formatPrice(amount, currency || "USD");
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProcurementMeetingTab() {
  const fmtAmount = useFmtAmount();
  const navigate = useNavigate();

  // ── KPI state ─────────────────────────────────────────────────────────────
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [loadingKpis, setLoadingKpis] = useState(true);

  // ── Meeting state ─────────────────────────────────────────────────────────
  const [meetings, setMeetings]     = useState<Meeting[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [loadingMeetings, setLoadingMeetings]  = useState(true);

  // ── Pending orders state ──────────────────────────────────────────────────
  const [pendingOrders, setPendingOrders]     = useState<PendingOrderRow[]>([]);
  const [loadingOrders, setLoadingOrders]     = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [filterSupplier, setFilterSupplier]   = useState("");
  const [filterPriority, setFilterPriority]   = useState("all");
  const [showPending, setShowPending]         = useState(true);
  const [sortField, setSortField]             = useState<PendingSortField | null>(null);
  const [sortDir, setSortDir]                 = useState<SortDir>(null);

  // ── Agenda state ──────────────────────────────────────────────────────────
  const [agendaOrders, setAgendaOrders]   = useState<AgendaOrder[]>([]);
  const [loadingAgenda, setLoadingAgenda] = useState(false);
  const [addingToAgenda, setAddingToAgenda] = useState(false);
  const [closing, setClosing]             = useState(false);

  // ── Column visibility ─────────────────────────────────────────────────────
  const { isVisible, hide, show, hiddenCols, visibleCount } = useColumnVisibility(
    "agenda-meeting:hidden-columns",
    PENDING_COLS,
    []
  );
  const { menu: colMenu, setMenu: setColMenu, closeMenu } = useColMenu();

  // ── Fetch KPIs ────────────────────────────────────────────────────────────
  const fetchKpis = useCallback(async () => {
    setLoadingKpis(true);
    try {
      const today = new Date().toISOString();
      const [paymentsRes, overdueRes, urgentRes] = await Promise.all([
        supabase
          .from("order_payments")
          .select("id, amount, currency")
          .eq("status", "ממתין"),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .not("eta", "is", null)
          .lt("eta", today)
          .not("status", "in", '("ARRIVED","DELIVERED","CANCELLED")'),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .in("priority", ["דחוף", "גבוה"])
          .in("status", ["PENDING", "ORDERED", "SHIPPED", "ARRIVED_PORT", "CUSTOMS_CLEARANCE"]),
      ]);

      const totals: Record<string, number> = {};
      for (const p of (paymentsRes.data || [])) {
        totals[p.currency] = (totals[p.currency] || 0) + (p.amount || 0);
      }

      setKpis({
        pendingPaymentsCount: paymentsRes.data?.length ?? 0,
        pendingPaymentsTotals: totals,
        overdueCount: overdueRes.count ?? 0,
        urgentCount: urgentRes.count ?? 0,
      });
    } catch {
      // KPIs are non-critical — silently fail, cards show zeros
    } finally {
      setLoadingKpis(false);
    }
  }, []);

  // ── Fetch meetings ────────────────────────────────────────────────────────
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

  useEffect(() => {
    fetchKpis();
    fetchMeetings();
  }, [fetchKpis, fetchMeetings]);

  // ── Auto-select most recent open meeting ──────────────────────────────────
  useEffect(() => {
    if (selectedId || meetings.length === 0) return;
    const openMeeting = meetings.find(m => m.status === "open");
    if (openMeeting) setSelectedId(openMeeting.id);
  }, [meetings, selectedId]);

  // ── Sync selected meeting object ──────────────────────────────────────────
  useEffect(() => {
    if (!selectedId) { setSelectedMeeting(null); return; }
    const m = meetings.find(x => x.id === selectedId) ?? null;
    setSelectedMeeting(m);
    if (m) {
      fetchPendingOrders(m.id);
      fetchAgenda(m.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, meetings]);

  // ── Fetch pending orders ──────────────────────────────────────────────────
  const fetchPendingOrders = useCallback(async (meetingId: string) => {
    setLoadingOrders(true);

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

    const { data: pendingPiData } = await supabase
      .from("orders")
      .select("id")
      .eq("status", "PENDING")
      .not("pi_number", "is", null);

    const piOrderIds = (pendingPiData || [])
      .map((o: Record<string, unknown>) => o.id as string)
      .filter(id => !orderIdsWithPayments.includes(id));

    const allOrderIds = [...new Set([...orderIdsWithPayments, ...piOrderIds])];

    if (allOrderIds.length === 0) {
      setPendingOrders([]);
      setLoadingOrders(false);
      return;
    }

    const [ordersRes, alreadyRes] = await Promise.all([
      supabase
        .from("orders")
        .select("*")
        .in("id", allOrderIds)
        .not("status", "in", '("ARRIVED","DELIVERED","CANCELLED")'),
      supabase
        .from("procurement_meeting_orders")
        .select("order_id")
        .eq("meeting_id", meetingId),
    ]);

    const alreadyIds = new Set((alreadyRes.data || []).map((r: Record<string, unknown>) => r.order_id as string));

    const rows: PendingOrderRow[] = ((ordersRes.data || []) as unknown as Order[])
      .filter(o => !alreadyIds.has(o.id))
      .map(o => ({ ...o, pendingPayments: paymentsByOrder[o.id] || [] }));

    rows.sort((a, b) => {
      const aHas = a.pendingPayments.length > 0 ? 0 : 1;
      const bHas = b.pendingPayments.length > 0 ? 0 : 1;
      if (aHas !== bHas) return aHas - bHas;
      return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
    });

    setPendingOrders(rows);
    setLoadingOrders(false);
  }, []);

  // ── Fetch agenda ──────────────────────────────────────────────────────────
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

    if (error || !data) { setLoadingAgenda(false); return; }

    const orderIds = (data as Record<string, unknown>[]).map(r => (r.orders as Record<string, unknown>).id as string);
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

    const agenda: AgendaOrder[] = (data as Record<string, unknown>[]).map(r => {
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

  // ── Sorting for pending orders table ──────────────────────────────────────
  const toggleSort = (field: PendingSortField) => {
    if (sortField === field) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortField(null); setSortDir(null); }
    } else {
      setSortField(field); setSortDir("asc");
    }
  };

  // ── Filtered + sorted pending orders ─────────────────────────────────────
  const filteredPending = pendingOrders
    .filter(o => {
      if (filterSupplier && !(o.supplier_name?.toLowerCase().includes(filterSupplier.toLowerCase()))) return false;
      if (filterPriority !== "all" && o.priority !== filterPriority) return false;
      return true;
    })
    .sort((a, b) => {
      if (!sortField || !sortDir) return 0;
      let cmp = 0;
      if (sortField === "supplier") cmp = (a.supplier_name || "").localeCompare(b.supplier_name || "", "he");
      else if (sortField === "total_price") cmp = (a.total_price || 0) - (b.total_price || 0);
      else if (sortField === "priority") cmp = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
      else if (sortField === "eta") cmp = (a.eta || "").localeCompare(b.eta || "");
      return sortDir === "desc" ? -cmp : cmp;
    });

  const groupA = filteredPending.filter(o => o.pendingPayments.length > 0);
  const groupB = filteredPending.filter(o => o.pendingPayments.length === 0);

  // ── Mutations ─────────────────────────────────────────────────────────────
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

  const updateDecision = async (item: AgendaOrder, field: "decision" | "approvedAmount" | "notes", value: string) => {
    setAgendaOrders(prev => prev.map(a =>
      a.meetingOrderId === item.meetingOrderId ? { ...a, [field]: value, saving: true } : a
    ));
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (field === "decision")       updates.decision        = value;
    if (field === "approvedAmount") updates.approved_amount = value === "" ? null : Number(value);
    if (field === "notes")          updates.notes           = value || null;
    const { error } = await supabase
      .from("procurement_meeting_orders")
      .update(updates)
      .eq("id", item.meetingOrderId);
    setAgendaOrders(prev => prev.map(a =>
      a.meetingOrderId === item.meetingOrderId ? { ...a, saving: false } : a
    ));
    if (error) toast.error(`שגיאה: ${error.message}`);
  };

  const removeFromAgenda = async (item: AgendaOrder) => {
    const { error } = await supabase
      .from("procurement_meeting_orders")
      .delete()
      .eq("id", item.meetingOrderId);
    if (error) { toast.error(`שגיאה: ${error.message}`); return; }
    setAgendaOrders(prev => prev.filter(a => a.meetingOrderId !== item.meetingOrderId));
    if (selectedMeeting) fetchPendingOrders(selectedMeeting.id);
  };

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

  const createTodayMeeting = async () => {
    const today = new Date();
    const title = `ישיבת רכש — ${format(today, "dd/MM/yyyy")}`;
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

  // ── Agenda summary ────────────────────────────────────────────────────────
  const summaryByCurrency: Record<string, number> = {};
  for (const a of agendaOrders) {
    if (a.decision !== "approved" && a.decision !== "partial") continue;
    for (const p of a.pendingPayments) {
      const amt = a.decision === "partial" && a.approvedAmount !== ""
        ? Number(a.approvedAmount)
        : p.amount;
      summaryByCurrency[p.currency] = (summaryByCurrency[p.currency] || 0) + (amt || 0);
    }
  }

  // Group all pending payments from agenda items by due_date
  const paymentsByDate: Record<string, Record<string, number>> = {};
  for (const a of agendaOrders) {
    for (const p of a.pendingPayments) {
      const key = p.due_date || "__none__";
      if (!paymentsByDate[key]) paymentsByDate[key] = {};
      paymentsByDate[key][p.currency] = (paymentsByDate[key][p.currency] || 0) + p.amount;
    }
  }
  const sortedPaymentDates = Object.keys(paymentsByDate).sort((a, b) => {
    if (a === "__none__") return 1;
    if (b === "__none__") return -1;
    return a.localeCompare(b);
  });

  const isClosed = selectedMeeting?.status === "closed";

  const SortIcon = ({ field }: { field: PendingSortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-12" dir="rtl">

      {/* ── KPI bar ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Pending payments */}
        <div className="bg-card border rounded-xl p-4 flex items-start gap-3">
          <div className="p-2 bg-warning/10 rounded-lg shrink-0">
            <CreditCard className="h-5 w-5 text-warning" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium">תשלומים ממתינים</p>
            {loadingKpis ? (
              <div className="h-5 w-16 bg-muted animate-pulse rounded mt-1" />
            ) : (
              <>
                <p className="text-xl font-bold text-foreground leading-none mt-0.5">
                  {kpis?.pendingPaymentsCount ?? 0}
                </p>
                {kpis && Object.entries(kpis.pendingPaymentsTotals).map(([cur, total]) => (
                  <p key={cur} className="text-xs text-muted-foreground mt-0.5">{fmtAmount(total, cur)}</p>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Overdue ETAs */}
        <div className="bg-card border rounded-xl p-4 flex items-start gap-3">
          <div className="p-2 bg-destructive/10 rounded-lg shrink-0">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">הזמנות שעברו ETA</p>
            {loadingKpis ? (
              <div className="h-5 w-10 bg-muted animate-pulse rounded mt-1" />
            ) : (
              <p className="text-xl font-bold text-destructive leading-none mt-0.5">
                {kpis?.overdueCount ?? 0}
              </p>
            )}
          </div>
        </div>

        {/* Urgent orders */}
        <div className="bg-card border rounded-xl p-4 flex items-start gap-3">
          <div className="p-2 bg-primary/10 rounded-lg shrink-0">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">הזמנות דחוף / גבוה</p>
            {loadingKpis ? (
              <div className="h-5 w-10 bg-muted animate-pulse rounded mt-1" />
            ) : (
              <p className="text-xl font-bold text-foreground leading-none mt-0.5">
                {kpis?.urgentCount ?? 0}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="mr-auto h-7 w-7 shrink-0"
            onClick={() => { fetchKpis(); }}
            disabled={loadingKpis}
            title="רענן"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loadingKpis && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* ── Meeting selector ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-52">
          <Select value={selectedId} onValueChange={setSelectedId} disabled={loadingMeetings}>
            <SelectTrigger>
              <SelectValue placeholder={loadingMeetings ? "טוען ישיבות..." : "בחר ישיבת רכש..."} />
            </SelectTrigger>
            <SelectContent>
              {meetings.map(m => (
                <SelectItem key={m.id} value={m.id}>
                  <span className="flex items-center gap-2">
                    {m.status === "closed" && <Lock className="h-3 w-3 text-muted-foreground" />}
                    {m.title} — {format(new Date(m.meeting_date), "dd/MM/yyyy")}
                    {m.status === "closed" && (
                      <span className="text-xs text-muted-foreground">(סגורה)</span>
                    )}
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

      {/* ── Empty state ── */}
      {!selectedMeeting && !loadingMeetings && (
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
                onClick={() => setShowPending(v => !v)}
              >
                <span className="font-semibold text-sm flex items-center gap-2">
                  הזמנות ממתינות לטיפול
                  {pendingOrders.length > 0 && (
                    <Badge variant="secondary">{pendingOrders.length}</Badge>
                  )}
                </span>
                {showPending ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showPending && (
                <div className="p-4 space-y-4">
                  {/* Filters */}
                  <div className="flex flex-wrap gap-2 items-center">
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
                    {selectedOrderIds.size > 0 && (
                      <div className="flex items-center gap-2 mr-auto">
                        <span className="text-sm text-muted-foreground">{selectedOrderIds.size} נבחרו</span>
                        <Button size="sm" onClick={addToAgenda} disabled={addingToAgenda}>
                          {addingToAgenda
                            ? <Loader2 className="h-4 w-4 animate-spin ml-1" />
                            : <Plus className="h-4 w-4 ml-1" />}
                          הוסף לסדר יום
                        </Button>
                      </div>
                    )}
                  </div>

                  {loadingOrders ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : filteredPending.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">אין הזמנות ממתינות</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr
                            className="border-b bg-muted/30 text-xs"
                            onContextMenu={trContextMenu(hiddenCols, setColMenu)}
                          >
                            <th className="p-2 w-8" />
                            {PENDING_COLS.map(col => isVisible(col.id) ? (
                              <th
                                key={col.id}
                                className="p-2 text-right font-semibold text-foreground"
                                onContextMenu={colThContextMenu(col, setColMenu)}
                              >
                                {col.sortField ? (
                                  <button
                                    onClick={() => toggleSort(col.sortField as PendingSortField)}
                                    className="flex items-center gap-1 cursor-pointer select-none hover:text-primary transition-colors"
                                  >
                                    {col.label} <SortIcon field={col.sortField as PendingSortField} />
                                  </button>
                                ) : col.label}
                              </th>
                            ) : null)}
                          </tr>
                        </thead>
                        <tbody>
                          {/* Group A header */}
                          {groupA.length > 0 && (
                            <tr className="bg-warning/5">
                              <td colSpan={visibleCount + 1} className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                ממתינות לתשלום ({groupA.length})
                              </td>
                            </tr>
                          )}
                          {groupA.map(o => (
                            <PendingRow
                              key={o.id}
                              order={o}
                              selected={selectedOrderIds.has(o.id)}
                              onToggle={() => setSelectedOrderIds(prev => {
                                const next = new Set(prev);
                                if (next.has(o.id)) { next.delete(o.id); } else { next.add(o.id); }
                                return next;
                              })}
                              isVisible={isVisible}
                              onNavigate={id => navigate(`/orders/${id}`)}
                            />
                          ))}

                          {/* Group B header */}
                          {groupB.length > 0 && (
                            <tr className="bg-blue-50/50 dark:bg-blue-900/10">
                              <td colSpan={visibleCount + 1} className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                PI ממתינות לאישור — אין לוח תשלומים ({groupB.length})
                              </td>
                            </tr>
                          )}
                          {groupB.map(o => (
                            <PendingRow
                              key={o.id}
                              order={o}
                              selected={selectedOrderIds.has(o.id)}
                              onToggle={() => setSelectedOrderIds(prev => {
                                const next = new Set(prev);
                                if (next.has(o.id)) { next.delete(o.id); } else { next.add(o.id); }
                                return next;
                              })}
                              isVisible={isVisible}
                              onNavigate={id => navigate(`/orders/${id}`)}
                            />
                          ))}
                        </tbody>
                      </table>
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
                  {isClosed
                    ? "הישיבה נסגרה ללא הזמנות בסדר היום"
                    : "בחר הזמנות מהרשימה למעלה והוסף לסדר היום"}
                </p>
              ) : (
                <div className="space-y-3">
                  {agendaOrders.map(a => (
                    <AgendaOrderRow
                      key={a.meetingOrderId}
                      item={a}
                      readOnly={isClosed}
                      onDecisionChange={val => updateDecision(a, "decision", val)}
                      onAmountChange={val => updateDecision(a, "approvedAmount", val)}
                      onNotesChange={val => updateDecision(a, "notes", val)}
                      onRemove={() => removeFromAgenda(a)}
                      onNavigate={id => navigate(`/orders/${id}`)}
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

              {/* Payments by date */}
              {agendaOrders.length > 0 && sortedPaymentDates.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-sm font-semibold mb-2">תשלומים נדרשים לפי תאריך:</p>
                  <div className="space-y-1">
                    {sortedPaymentDates.map(dateKey => (
                      <div key={dateKey} className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="text-muted-foreground w-24 shrink-0">
                          {dateKey === "__none__" ? "ללא תאריך" : fmtDate(dateKey)}
                        </span>
                        {Object.entries(paymentsByDate[dateKey]).map(([cur, total]) => (
                          <span key={cur} className="font-medium">{fmtAmount(total, cur)}</span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Close meeting */}
              {!isClosed && agendaOrders.length > 0 && (
                <div className="mt-4 pt-4 border-t flex justify-end">
                  <Button variant="destructive" size="sm" onClick={closeMeeting} disabled={closing}>
                    {closing
                      ? <Loader2 className="h-4 w-4 animate-spin ml-1" />
                      : <Lock className="h-4 w-4 ml-1" />}
                    סגור ישיבה
                  </Button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {colMenu && (
        <ColContextMenu
          menu={colMenu}
          sortField={sortField}
          sortDir={sortDir}
          hiddenCols={hiddenCols}
          onClose={closeMenu}
          onHide={hide}
          onShow={show}
          onSortAsc={field => { setSortField(field as PendingSortField); setSortDir("asc"); }}
          onSortDesc={field => { setSortField(field as PendingSortField); setSortDir("desc"); }}
        />
      )}
    </div>
  );
}

// ─── PendingRow ───────────────────────────────────────────────────────────────

function PendingRow({
  order,
  selected,
  onToggle,
  isVisible,
  onNavigate,
}: {
  order: PendingOrderRow;
  selected: boolean;
  onToggle: () => void;
  isVisible: (id: string) => boolean;
  onNavigate: (id: string) => void;
}) {
  const fmtAmount = useFmtAmount();
  const totalPending = order.pendingPayments.reduce((s, p) => s + p.amount, 0);
  const paymentCurrency = order.pendingPayments[0]?.currency;

  return (
    <tr
      className="border-b last:border-0 hover:bg-muted/20 cursor-pointer"
      onClick={onToggle}
    >
      <td className="p-2">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          onClick={e => e.stopPropagation()}
        />
      </td>
      {isVisible("supplier") && (
        <td className="p-2 font-medium">
          <button
            className="hover:underline text-foreground"
            onClick={e => { e.stopPropagation(); onNavigate(order.id); }}
          >
            {order.supplier_name || "—"}
          </button>
        </td>
      )}
      {isVisible("pi_number") && (
        <td className="p-2 text-muted-foreground font-mono text-xs">{order.pi_number || "—"}</td>
      )}
      {isVisible("total_price") && (
        <td className="p-2 text-sm">{fmtAmount(order.total_price ?? null)}</td>
      )}
      {isVisible("pending_payment") && (
        <td className="p-2">
          {order.pendingPayments.length > 0 ? (
            <span className="text-warning font-medium text-sm">
              {fmtAmount(totalPending, paymentCurrency)}
              <span className="text-xs text-muted-foreground mr-1">
                ({order.pendingPayments.length})
              </span>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">אין לוח תשלומים</span>
          )}
        </td>
      )}
      {isVisible("priority") && (
        <td className="p-2">
          <PriorityBadge priority={order.priority as Priority} />
        </td>
      )}
      {isVisible("eta") && (
        <td className="p-2 text-xs text-muted-foreground">{fmtDate(order.eta)}</td>
      )}
    </tr>
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
  onNavigate,
}: {
  item: AgendaOrder;
  readOnly: boolean;
  onDecisionChange: (v: string) => void;
  onAmountChange: (v: string) => void;
  onNotesChange: (v: string) => void;
  onRemove: () => void;
  onNavigate: (id: string) => void;
}) {
  const fmtAmount = useFmtAmount();
  const totalPending = item.pendingPayments.reduce((s, p) => s + p.amount, 0);
  const paymentCurrency = item.pendingPayments[0]?.currency;
  const decisionOpt = DECISION_OPTIONS.find(d => d.value === item.decision)!;

  return (
    <div className={cn(
      "rounded-lg border p-3 space-y-2",
      item.decision === "approved" && "border-green-200 dark:border-green-900",
      item.decision === "deferred" && "border-orange-200 dark:border-orange-900",
    )}>
      <div className="flex flex-wrap items-start gap-2">
        {/* Order info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              className="font-semibold text-sm hover:underline text-foreground"
              onClick={() => onNavigate(item.order.id)}
            >
              {item.order.supplier_name}
            </button>
            {item.order.pi_number && (
              <span className="text-xs text-muted-foreground">PI: {item.order.pi_number}</span>
            )}
            <OrderStatusBadge status={item.order.status as OrderStatus} />
            <PriorityBadge priority={item.order.priority as Priority} />
          </div>
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
            {/* Primary amount: approved_amount > pending payment > total_price fallback */}
            {item.approvedAmount !== "" ? (
              <span className="text-green-600 dark:text-green-400 font-medium">
                לאישור: {fmtAmount(Number(item.approvedAmount), paymentCurrency)}
              </span>
            ) : item.pendingPayments.length > 0 ? (
              <span className="text-warning font-medium">
                לתשלום: {fmtAmount(totalPending, paymentCurrency)}
                {item.pendingPayments.map(p => (
                  <span key={p.id} className="mr-1 font-normal opacity-80">
                    ({p.payment_type}{p.due_date ? ` — ${fmtDate(p.due_date)}` : ""})
                  </span>
                ))}
              </span>
            ) : item.order.total_price != null ? (
              <span>סה"כ הזמנה: {fmtAmount(item.order.total_price)}</span>
            ) : null}
            {/* Secondary: show total_price when pending payments exist, for context */}
            {item.pendingPayments.length > 0 && item.order.total_price != null && (
              <span className="opacity-50">(סה"כ הזמנה: {fmtAmount(item.order.total_price)})</span>
            )}
            {item.order.eta && (
              <span>ETA: {fmtDate(item.order.eta)}</span>
            )}
            {item.pendingPayments.length === 0 && item.approvedAmount === "" && (
              <span className="text-blue-500">PI ממתינה לאישור — אין לוח תשלומים</span>
            )}
          </div>
        </div>

        {/* Decision + remove */}
        <div className="flex items-center gap-2 shrink-0">
          {item.saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {!readOnly ? (
            <Select value={item.decision} onValueChange={onDecisionChange}>
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

      {/* Partial amount */}
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
        <p className="text-xs text-muted-foreground">
          סכום מאושר: <span className="font-medium">{fmtAmount(Number(item.approvedAmount), paymentCurrency)}</span>
        </p>
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
