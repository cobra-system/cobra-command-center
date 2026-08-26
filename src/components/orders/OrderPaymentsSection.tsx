import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CreditCard, Plus, Trash2, Check, Paperclip, Upload, Loader2, ExternalLink, Link2, Link2Off, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateInput } from "@/components/ui/date-input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { ColContextMenu, useColMenu, colThContextMenu, trContextMenu } from "@/components/ui/ColContextMenu";
import type { ColDef } from "@/hooks/useColumnVisibility";
import type { OrderPayment } from "@/contexts/types";
import { useAuth, useCurrency } from "@/contexts/AppContext";
import { canSeePrices } from "@/lib/permissions";
import { SWIFT_FILE_ACCEPT, SWIFT_SUBTYPE, uploadSwiftDocument } from "@/lib/swiftDocuments";
import { parseSwiftFile, type ParsedSwift } from "@/lib/swiftImport/parseSwift";
import { matchSwiftToPayment, paymentUpdateFromSwift } from "@/lib/swiftImport/matchPayment";

import { format } from "date-fns";
const COLUMN_DEFS: ColDef[] = [
  { id: "payment_type", label: "סוג",          sortField: "payment_type" },
  { id: "percentage",   label: "אחוז" },
  { id: "amount",       label: "סכום",         sortField: "amount" },
  { id: "currency",     label: "מטבע" },
  { id: "due_date",     label: "מועד פירעון",  sortField: "due_date" },
  { id: "status",       label: "סטטוס",        sortField: "status" },
  { id: "paid_date",    label: "תאריך תשלום",  sortField: "paid_date" },
  { id: "swift_ref",    label: "Swift Ref" },
  { id: "swift_doc",    label: "מסמך SWIFT" },
  { id: "notes",        label: "הערות" },
] as const;

type SortField = "payment_type" | "amount" | "due_date" | "status" | "paid_date";
type SortDir = "asc" | "desc" | null;

interface Props {
  orderId: string;
  orderTotal?: number | null;
  hasEdit: boolean;
  /** Supplier of the order — copied onto SWIFT documents so they file correctly. */
  supplierId?: string | null;
}

/** SWIFT confirmation attached to this order (optionally to one installment). */
interface SwiftDoc {
  id: string;
  document_name: string | null;
  file_url: string | null;
  created_at: string;
  order_payment_id: string | null;
}

const UNLINKED = "__unlinked__";

const paymentTypeLabel: Record<string, string> = {
  Deposit: "מקדמה",
  Balance: "יתרה",
  Full: "מלא",
};

const typeColors: Record<string, string> = {
  Deposit: "bg-accent/15 text-accent",
  Balance: "bg-primary/15 text-primary",
  Full: "bg-muted text-muted-foreground",
};

const statusColors: Record<string, string> = {
  "שולם": "bg-success/15 text-success",
  "ממתין": "bg-warning/15 text-warning",
};

export function OrderPaymentsSection({ orderId, orderTotal, hasEdit, supplierId }: Props) {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { formatPrice } = useCurrency();
  const queryClient = useQueryClient();
  const invalidatePaymentCaches = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["order-payment-statuses"] });
    queryClient.invalidateQueries({ queryKey: ["order-payments-dashboard"] });
  }, [queryClient]);
  const [payments, setPayments] = useState<OrderPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<OrderPayment | null>(null);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  // Form state
  const [formType, setFormType] = useState<"Deposit" | "Balance" | "Full">("Deposit");
  const [formPct, setFormPct] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formCurrency, setFormCurrency] = useState<"USD" | "EUR" | "ILS">("USD");
  const [formDueDate, setFormDueDate] = useState<Date | undefined>();
  const [formSwift, setFormSwift] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formSwiftFile, setFormSwiftFile] = useState<File | null>(null);
  // What the attached SWIFT confirmation says — read from the file, not typed.
  const [parsedSwift, setParsedSwift] = useState<ParsedSwift | null>(null);
  const [parsingSwift, setParsingSwift] = useState(false);
  const [saving, setSaving] = useState(false);

  // SWIFT documents attached to this order, grouped by installment
  const [swiftDocs, setSwiftDocs] = useState<Record<string, SwiftDoc[]>>({});
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const swiftInputRef = useRef<HTMLInputElement>(null);
  const formSwiftInputRef = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<OrderPayment | null>(null);

  const { isVisible, hide, show, hiddenCols, visibleCount } = useColumnVisibility(
    "order-payments:hidden-columns",
    COLUMN_DEFS,
    ["percentage", "notes"]
  );
  const { menu: colMenu, setMenu: setColMenu, closeMenu } = useColMenu();

  const fetchPayments = useCallback(async () => {
    const { data, error } = await supabase
      .from("order_payments")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });
    if (!error && data) setPayments(data as OrderPayment[]);
    setLoading(false);
  }, [orderId]);

  const fetchSwiftDocs = useCallback(async () => {
    const { data } = await supabase
      .from("purchase_documents")
      .select("id, document_name, file_url, created_at, order_payment_id")
      .eq("order_id", orderId)
      .eq("document_subtype", SWIFT_SUBTYPE)
      .order("created_at", { ascending: false });
    const grouped: Record<string, SwiftDoc[]> = {};
    for (const doc of (data as SwiftDoc[] | null) || []) {
      const key = doc.order_payment_id || UNLINKED;
      (grouped[key] ||= []).push(doc);
    }
    setSwiftDocs(grouped);
  }, [orderId]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);
  useEffect(() => { fetchSwiftDocs(); }, [fetchSwiftDocs]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDir === "asc") { setSortDir("desc"); }
      else { setSortField(null); setSortDir(null); }
    } else {
      setSortField(field); setSortDir("asc");
    }
  };

  const sorted = [...payments].sort((a, b) => {
    if (!sortField || !sortDir) return 0;
    let cmp = 0;
    if (sortField === "amount") cmp = (a.amount || 0) - (b.amount || 0);
    else if (sortField === "due_date") cmp = (a.due_date || "").localeCompare(b.due_date || "");
    else if (sortField === "paid_date") cmp = (a.paid_date || "").localeCompare(b.paid_date || "");
    else if (sortField === "payment_type") cmp = (a.payment_type || "").localeCompare(b.payment_type || "");
    else if (sortField === "status") cmp = (a.status || "").localeCompare(b.status || "");
    return sortDir === "desc" ? -cmp : cmp;
  });

  // SWIFT files with no installment behind them (never linked, or their
  // installment was deleted) — surfaced under the table so they stay reachable
  const paymentIds = new Set(payments.map(p => p.id));
  const unlinkedSwiftDocs = Object.entries(swiftDocs)
    .filter(([key]) => key === UNLINKED || !paymentIds.has(key))
    .flatMap(([, docs]) => docs);

  const totalScheduled = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const totalPaid = payments.filter(p => p.status === "שולם").reduce((s, p) => s + (p.amount || 0), 0);
  const remaining = totalScheduled - totalPaid;

  const openAdd = () => {
    setEditingPayment(null);
    setFormType("Deposit");
    setFormPct("");
    setFormAmount("");
    setFormCurrency("USD");
    setFormDueDate(undefined);
    setFormSwift("");
    setFormNotes("");
    setFormSwiftFile(null);
    setParsedSwift(null);
    setShowForm(true);
  };

  const openEdit = (p: OrderPayment) => {
    setEditingPayment(p);
    setFormType(p.payment_type);
    setFormPct(p.percentage?.toString() || "");
    setFormAmount(p.amount?.toString() || "");
    setFormCurrency(p.currency || "USD");
    setFormDueDate(p.due_date ? new Date(p.due_date) : undefined);
    setFormSwift(p.swift_reference || "");
    setFormNotes(p.notes || "");
    setFormSwiftFile(null);
    setShowForm(true);
  };

  /**
   * Read an attached SWIFT confirmation and fill the form from it.
   *
   * The bank document is the source of truth for what was actually paid, so its
   * amount, currency and reference overwrite whatever is in the form; the due
   * date is left alone because that is a term of the order, not of the transfer.
   */
  const handleFormSwiftFile = async (file: File | null) => {
    setFormSwiftFile(file);
    setParsedSwift(null);
    if (!file) return;
    setParsingSwift(true);
    const parsed = await parseSwiftFile(file);
    setParsingSwift(false);
    setParsedSwift(parsed);

    if (parsed.amount != null) setFormAmount(String(parsed.amount));
    if (parsed.currency === "USD" || parsed.currency === "EUR" || parsed.currency === "ILS") {
      setFormCurrency(parsed.currency);
    }
    if (parsed.reference) setFormSwift(parsed.reference);

    // Adding a new payment: if the transfer settles an installment already in the
    // schedule, say so rather than letting the user create a duplicate row.
    if (!editingPayment) {
      const match = matchSwiftToPayment(parsed, payments);
      if (match) {
        setFormType(match.payment.payment_type);
        if (match.payment.percentage) setFormPct(String(match.payment.percentage));
      }
    }
  };

  const handleSave = async () => {
    if (!formAmount || isNaN(Number(formAmount))) {
      toast.error("יש להזין סכום תקין");
      return;
    }
    setSaving(true);
    const payload = {
      order_id: orderId,
      payment_type: formType,
      percentage: formPct ? Number(formPct) : null,
      amount: Number(formAmount),
      currency: formCurrency,
      due_date: formDueDate ? formDueDate.toISOString().split("T")[0] : null,
      swift_reference: formSwift || null,
      notes: formNotes || null,
      // A SWIFT confirmation is proof the money left — the installment is paid,
      // dated by the transfer's value date rather than by when it was entered.
      ...(parsedSwift && parsedSwift.amount != null
        ? { status: "שולם", paid_date: paymentUpdateFromSwift(parsedSwift).paid_date }
        : { status: editingPayment?.status || "ממתין" }),
    };
    const { data: savedRow, error } = editingPayment
      ? await supabase.from("order_payments").update(payload).eq("id", editingPayment.id).select("*").single()
      : await supabase.from("order_payments").insert(payload).select("*").single();
    if (error) { setSaving(false); toast.error("שגיאה בשמירה"); return; }

    // Attached SWIFT confirmation → upload it and file it under the saved installment
    if (formSwiftFile && savedRow) {
      const { error: swiftError } = await uploadSwiftDocument({
        file: formSwiftFile,
        orderId,
        payment: savedRow as OrderPayment,
        supplierId,
      });
      if (swiftError) toast.error("התשלום נשמר, אך העלאת ה-SWIFT נכשלה: " + swiftError);
      else fetchSwiftDocs();
    }

    setSaving(false);
    toast.success(
      parsedSwift && parsedSwift.amount != null
        ? `${editingPayment ? "תשלום עודכן" : "תשלום נוסף"} וסומן כשולם לפי ה-SWIFT`
        : editingPayment ? "תשלום עודכן" : "תשלום נוסף"
    );
    setShowForm(false);
    setFormSwiftFile(null);
    setParsedSwift(null);
    fetchPayments();
    invalidatePaymentCaches();
  };

  const markPaid = async (id: string) => {
    const today = new Date().toISOString().split("T")[0];
    const { error } = await supabase
      .from("order_payments")
      .update({ status: "שולם", paid_date: today })
      .eq("id", id);
    if (error) { toast.error("שגיאה"); return; }
    toast.success("תשלום סומן כשולם");
    fetchPayments(); invalidatePaymentCaches();
  };

  const markPending = async (id: string) => {
    const { error } = await supabase
      .from("order_payments")
      .update({ status: "ממתין", paid_date: null })
      .eq("id", id);
    if (error) { toast.error("שגיאה"); return; }
    toast.success("תשלום סומן כממתין");
    fetchPayments(); invalidatePaymentCaches();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("order_payments").delete().eq("id", id);
    if (error) { toast.error("שגיאה במחיקה"); return; }
    toast.success("תשלום נמחק");
    fetchPayments(); fetchSwiftDocs(); invalidatePaymentCaches();
  };

  const updateSwift = async (id: string, swift: string) => {
    const { error } = await supabase
      .from("order_payments")
      .update({ swift_reference: swift || null })
      .eq("id", id);
    if (error) { toast.error("שגיאה"); return; }
    toast.success("אסמכתא עודכנה");
    fetchPayments();
  };

  /**
   * Upload a SWIFT file straight from a payment row: the file lands in the
   * documents module, and what it says settles the row — reference, payment date
   * and status, without the user retyping the bank's own numbers.
   */
  const handleSwiftUpload = async (payment: OrderPayment, file: File) => {
    setUploadingFor(payment.id);
    const [{ error }, parsed] = await Promise.all([
      uploadSwiftDocument({ file, orderId, payment, supplierId }),
      parseSwiftFile(file),
    ]);
    setUploadingFor(null);
    if (error) { toast.error("שגיאה בהעלאת ה-SWIFT: " + error); return; }
    await fetchSwiftDocs();

    if (parsed.amount == null) {
      // Nothing readable (a scan, or a layout the parser does not know) — the
      // file is still filed; the row is left exactly as it was.
      toast.success("מסמך SWIFT נשמר במסמכים", {
        description: parsed.warnings[0],
        action: payment.status === "ממתין"
          ? { label: "סמן כשולם", onClick: () => markPaid(payment.id) }
          : undefined,
      });
      return;
    }

    const rowAmount = Number(payment.amount) || 0;
    const difference = rowAmount > 0 ? Math.abs(rowAmount - parsed.amount) / rowAmount : 1;
    const currencyClash = Boolean(parsed.currency && payment.currency && parsed.currency !== payment.currency);
    const money = `${parsed.amount.toLocaleString("en-US")} ${parsed.currency || ""}`.trim();

    if (difference > 0.02 || currencyClash) {
      // The transfer is not this installment. Say so and leave the row untouched —
      // silently marking the wrong installment paid is the expensive mistake here.
      const suggestion = matchSwiftToPayment(parsed, payments);
      toast.warning(`ה-SWIFT הוא על ${money}, והתשלום בשורה הוא ${rowAmount.toLocaleString("en-US")} ${payment.currency || ""}`, {
        description: suggestion
          ? `המסמך נשמר. נראה שהוא שייך לתשלום אחר: ${suggestion.reason}`
          : "המסמך נשמר, אך התשלום לא סומן כשולם — בדוק לאיזה תשלום ההעברה שייכת",
        action: { label: "סמן כשולם בכל זאת", onClick: () => applySwiftToPayment(payment, parsed) },
        duration: 12000,
      });
      return;
    }

    await applySwiftToPayment(payment, parsed);
  };

  /** Write what the SWIFT says onto the installment it settles. */
  const applySwiftToPayment = async (payment: OrderPayment, parsed: ParsedSwift) => {
    const update = paymentUpdateFromSwift(parsed);
    const { error } = await supabase
      .from("order_payments")
      .update({
        status: update.status,
        paid_date: update.paid_date,
        // Never blank an existing reference with a SWIFT that had none.
        swift_reference: update.swift_reference || payment.swift_reference || null,
      })
      .eq("id", payment.id);
    if (error) { toast.error("המסמך נשמר, אך עדכון התשלום נכשל"); return; }

    const money = parsed.amount != null
      ? `${parsed.amount.toLocaleString("en-US")} ${parsed.currency || ""}`.trim()
      : "";
    toast.success(`התשלום סומן כשולם${money ? ` — ${money}` : ""}`, {
      description: [
        `תאריך ערך: ${update.paid_date}`,
        update.swift_reference ? `אסמכתא: ${update.swift_reference}` : null,
      ].filter(Boolean).join(" · "),
    });
    fetchPayments();
    invalidatePaymentCaches();
  };

  const handleDeleteSwiftDoc = async (docId: string) => {
    const { error } = await supabase.from("purchase_documents").delete().eq("id", docId);
    if (error) { toast.error("שגיאה במחיקת המסמך"); return; }
    toast.success("מסמך נמחק");
    fetchSwiftDocs();
  };

  /** Attach an already-uploaded SWIFT of this order to an installment (or detach it). */
  const handleLinkSwiftDoc = async (docId: string, paymentId: string | null) => {
    const { error } = await supabase
      .from("purchase_documents")
      .update({ order_payment_id: paymentId })
      .eq("id", docId);
    if (error) { toast.error("שגיאה בשיוך המסמך"); return; }
    toast.success(paymentId ? "המסמך שויך לתשלום" : "השיוך בוטל");
    fetchSwiftDocs();
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-muted-foreground/40">⇅</span>;
    return sortDir === "asc" ? <span>↑</span> : <span>↓</span>;
  };

  if (loading) return null;
  if (!canSeePrices(currentUser)) return null;

  return (
    <>
      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-accent" />
            <h2 className="font-semibold text-foreground">תזמון תשלומים ({payments.length})</h2>
          </div>
          {hasEdit && (
            <Button variant="outline" size="sm" onClick={openAdd}>
              <Plus className="h-3.5 w-3.5 ml-1" />הוסף תשלום
            </Button>
          )}
        </div>

        {/* Summary bar */}
        {payments.length > 0 && (
          <div className="px-4 py-3 bg-muted/30 border-b grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">סה״כ מתוכנן: </span>
              <span className={cn("font-semibold", orderTotal && Math.abs(totalScheduled - orderTotal) > 1 ? "text-warning" : "")}>
                {formatPrice(totalScheduled)}
              </span>
              {orderTotal && Math.abs(totalScheduled - orderTotal) > 1 && (
                <span className="text-xs text-muted-foreground mr-1">(ס״כ הזמנה: {formatPrice(orderTotal)})</span>
              )}
            </div>
            <div>
              <span className="text-muted-foreground text-xs">שולם: </span>
              <span className="font-semibold text-success">{formatPrice(totalPaid)}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">נותר: </span>
              <span className={cn("font-semibold", remaining > 0 ? "text-warning" : "text-success")}>
                {formatPrice(remaining)}
              </span>
            </div>
          </div>
        )}

        <div className="overflow-x-auto" dir="rtl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50" onContextMenu={trContextMenu(hiddenCols, setColMenu)}>
                {COLUMN_DEFS.map(col => isVisible(col.id) ? (
                  <th key={col.id} className="text-right p-3 font-semibold text-foreground" onContextMenu={colThContextMenu(col, setColMenu)}>
                    {col.sortField ? (
                      <button onClick={() => toggleSort(col.sortField as SortField)} className="flex items-center gap-1 hover:text-primary transition-colors">
                        {col.label} <SortIcon field={col.sortField as SortField} />
                      </button>
                    ) : col.label}
                  </th>
                ) : null)}
                {hasEdit && <th className="p-3 w-20" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={visibleCount + (hasEdit ? 1 : 0)} className="p-6 text-center text-muted-foreground text-sm">
                    אין תשלומים מתוכננים להזמנה זו
                  </td>
                </tr>
              ) : sorted.map(p => (
                <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                  {isVisible("payment_type") && (
                    <td className="p-3">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", typeColors[p.payment_type] || "bg-muted text-muted-foreground")}>
                        {paymentTypeLabel[p.payment_type] || p.payment_type}
                      </span>
                    </td>
                  )}
                  {isVisible("percentage") && (
                    <td className="p-3 text-muted-foreground text-xs">{p.percentage ? `${p.percentage}%` : "—"}</td>
                  )}
                  {isVisible("amount") && (
                    <td className="p-3 font-medium">
                      {p.amount ? formatPrice(p.amount, p.currency) : "—"}
                    </td>
                  )}
                  {isVisible("currency") && (
                    <td className="p-3 text-muted-foreground text-xs">{p.currency || "—"}</td>
                  )}
                  {isVisible("due_date") && (
                    <td className="p-3 text-muted-foreground text-xs">
                      {p.due_date ? format(new Date(p.due_date), "dd/MM/yyyy") : "—"}
                    </td>
                  )}
                  {isVisible("status") && (
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                      {hasEdit ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className={cn("px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity", statusColors[p.status] || "bg-muted text-muted-foreground")}>
                              {p.status}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-1" align="start">
                            {p.status === "ממתין" && (
                              <button
                                onClick={() => markPaid(p.id)}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium hover:bg-muted rounded transition-colors text-success"
                              >
                                <Check className="h-3 w-3" />סמן כשולם
                              </button>
                            )}
                            {p.status === "שולם" && (
                              <button
                                onClick={() => markPending(p.id)}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium hover:bg-muted rounded transition-colors text-warning"
                              >
                                ↺ סמן כממתין
                              </button>
                            )}
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", statusColors[p.status] || "bg-muted text-muted-foreground")}>
                          {p.status}
                        </span>
                      )}
                    </td>
                  )}
                  {isVisible("paid_date") && (
                    <td className="p-3 text-muted-foreground text-xs">
                      {p.paid_date ? format(new Date(p.paid_date), "dd/MM/yyyy") : "—"}
                    </td>
                  )}
                  {isVisible("swift_ref") && (
                    <td className="p-3 text-muted-foreground text-xs font-mono" onClick={e => e.stopPropagation()}>
                      {hasEdit ? (
                        <input
                          className="text-xs font-mono bg-transparent border-b border-dashed border-muted-foreground/30 focus:outline-none focus:border-primary w-full min-w-[100px]"
                          defaultValue={p.swift_reference || ""}
                          placeholder="SWIFT..."
                          onBlur={e => { if (e.target.value !== (p.swift_reference || "")) updateSwift(p.id, e.target.value); }}
                        />
                      ) : (p.swift_reference || "—")}
                    </td>
                  )}
                  {isVisible("swift_doc") && (
                    <td
                      className="p-3"
                      onClick={e => e.stopPropagation()}
                      onDragOver={hasEdit ? e => { e.preventDefault(); setDragOver(p.id); } : undefined}
                      onDragLeave={hasEdit ? () => setDragOver(null) : undefined}
                      onDrop={hasEdit ? e => {
                        e.preventDefault();
                        setDragOver(null);
                        const f = e.dataTransfer.files?.[0];
                        if (f) handleSwiftUpload(p, f);
                      } : undefined}
                    >
                      <div className={cn(
                        "flex items-center gap-1 flex-wrap rounded transition-colors",
                        dragOver === p.id && "ring-2 ring-primary ring-offset-1"
                      )}>
                        {(swiftDocs[p.id] || []).map(doc => (
                          <Popover key={doc.id}>
                            <PopoverTrigger asChild>
                              <button className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-success/10 text-success text-xs font-medium hover:bg-success/20 transition-colors max-w-[150px]">
                                <Paperclip className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{doc.document_name || "SWIFT"}</span>
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-1" align="start">
                              <div className="flex flex-col gap-0.5">
                                {doc.file_url && (
                                  <a
                                    href={doc.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium hover:bg-muted rounded transition-colors"
                                  >
                                    <ExternalLink className="h-3 w-3" />פתח קובץ
                                  </a>
                                )}
                                <button
                                  onClick={() => navigate(`/documents/${doc.id}`)}
                                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium hover:bg-muted rounded transition-colors"
                                >
                                  <FileText className="h-3 w-3" />פתח בדף המסמך
                                </button>
                                {hasEdit && (
                                  <>
                                    <button
                                      onClick={() => handleLinkSwiftDoc(doc.id, null)}
                                      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium hover:bg-muted rounded transition-colors"
                                    >
                                      <Link2Off className="h-3 w-3" />בטל שיוך לתשלום
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSwiftDoc(doc.id)}
                                      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium hover:bg-muted rounded transition-colors text-destructive"
                                    >
                                      <Trash2 className="h-3 w-3" />מחק מסמך
                                    </button>
                                  </>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        ))}
                        {hasEdit ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                            disabled={uploadingFor === p.id}
                            title="העלה אישור SWIFT — ייכנס אוטומטית למסמכים"
                            onClick={() => { uploadTarget.current = p; swiftInputRef.current?.click(); }}
                          >
                            {uploadingFor === p.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <><Upload className="h-3 w-3 ml-1" />העלה</>}
                          </Button>
                        ) : (swiftDocs[p.id] || []).length === 0 && (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </div>
                    </td>
                  )}
                  {isVisible("notes") && (
                    <td className="p-3 text-muted-foreground text-xs max-w-[150px] truncate">{p.notes || "—"}</td>
                  )}
                  {hasEdit && (
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit(p)}>
                          ✎
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* SWIFT documents on this order that are not yet tied to an installment */}
        {unlinkedSwiftDocs.length > 0 && (
          <div className="px-4 py-3 border-t bg-muted/20 flex flex-wrap items-center gap-2" dir="rtl">
            <span className="text-xs text-muted-foreground">מסמכי SWIFT ללא שיוך לתשלום:</span>
            {unlinkedSwiftDocs.map(doc => (
              <Popover key={doc.id}>
                <PopoverTrigger asChild>
                  <button className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-warning/10 text-warning text-xs font-medium hover:bg-warning/20 transition-colors max-w-[180px]">
                    <Paperclip className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{doc.document_name || "SWIFT"}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-1" align="start">
                  <div className="flex flex-col gap-0.5">
                    {doc.file_url && (
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium hover:bg-muted rounded transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />פתח קובץ
                      </a>
                    )}
                    {hasEdit && payments.map(p => (
                      <button
                        key={p.id}
                        onClick={() => handleLinkSwiftDoc(doc.id, p.id)}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium hover:bg-muted rounded transition-colors"
                      >
                        <Link2 className="h-3 w-3" />
                        שייך ל{paymentTypeLabel[p.payment_type] || p.payment_type}
                        {p.amount ? ` · ${formatPrice(p.amount, p.currency)}` : ""}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            ))}
          </div>
        )}
      </div>

      {/* Hidden picker used by the per-row SWIFT upload buttons */}
      <input
        ref={swiftInputRef}
        type="file"
        accept={SWIFT_FILE_ACCEPT}
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          const payment = uploadTarget.current;
          e.target.value = "";
          uploadTarget.current = null;
          if (file && payment) handleSwiftUpload(payment, file);
        }}
      />

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editingPayment ? "עריכת תשלום" : "הוספת תשלום"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>סוג תשלום</Label>
                <Select value={formType} onValueChange={v => setFormType(v as "Deposit" | "Balance" | "Full")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Deposit">מקדמה</SelectItem>
                    <SelectItem value="Balance">יתרה</SelectItem>
                    <SelectItem value="Full">מלא</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>אחוז (אופציונלי)</Label>
                <Input value={formPct} onChange={e => setFormPct(e.target.value)} placeholder="15" type="number" min="0" max="100" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>סכום</Label>
                <Input value={formAmount} onChange={e => setFormAmount(e.target.value)} placeholder="0" type="number" min="0" />
              </div>
              <div className="space-y-1.5">
                <Label>מטבע</Label>
                <Select value={formCurrency} onValueChange={v => setFormCurrency(v as "USD" | "EUR" | "ILS")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD $</SelectItem>
                    <SelectItem value="EUR">EUR €</SelectItem>
                    <SelectItem value="ILS">ILS ₪</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>מועד פירעון</Label>
              <DateInput value={formDueDate} onChange={setFormDueDate} clearable />
            </div>
            <div className="space-y-1.5">
              <Label>אסמכתא SWIFT</Label>
              <Input value={formSwift} onChange={e => setFormSwift(e.target.value)} placeholder="SWIFT reference..." className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>מסמך SWIFT (אופציונלי)</Label>
              <input
                ref={formSwiftInputRef}
                type="file"
                accept={SWIFT_FILE_ACCEPT}
                className="hidden"
                onChange={e => handleFormSwiftFile(e.target.files?.[0] || null)}
              />
              {formSwiftFile ? (
                <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <Paperclip className="h-3.5 w-3.5 text-success flex-shrink-0" />
                  <span className="truncate flex-1">{formSwiftFile.name}</span>
                  <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => handleFormSwiftFile(null)}>הסר</Button>
                </div>
              ) : (
                <Button variant="outline" className="w-full justify-start font-normal" onClick={() => formSwiftInputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5 ml-2" />העלה SWIFT — הפרטים יתמלאו לבד
                </Button>
              )}

              {parsingSwift && (
                <p className="text-xs text-muted-foreground">קורא את ה-SWIFT…</p>
              )}

              {/* What the bank document says — shown so the user checks the
                  parser rather than trusting it. */}
              {parsedSwift && !parsingSwift && (
                <div className="rounded-md border bg-muted/20 p-2.5 space-y-1 text-xs">
                  <div className="font-semibold text-foreground">
                    {parsedSwift.amount != null ? "זוהה מתוך ה-SWIFT" : "לא הצלחתי לקרוא את ה-SWIFT"}
                  </div>
                  {parsedSwift.amount != null && (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-muted-foreground">
                      <span>סכום: <span className="text-foreground font-medium">{parsedSwift.amount.toLocaleString("en-US")} {parsedSwift.currency || ""}</span></span>
                      {parsedSwift.valueDate && <span>תאריך ערך: <span className="text-foreground font-medium">{parsedSwift.valueDate}</span></span>}
                      {parsedSwift.reference && <span className="col-span-2 truncate">אסמכתא: <span className="text-foreground font-mono">{parsedSwift.reference}</span></span>}
                      {parsedSwift.beneficiary && <span className="col-span-2 truncate">מוטב: <span className="text-foreground">{parsedSwift.beneficiary}</span></span>}
                      {parsedSwift.referencedDocument && <span className="col-span-2 truncate">מסמך מקושר: <span className="text-foreground font-mono">{parsedSwift.referencedDocument}</span></span>}
                    </div>
                  )}
                  {parsedSwift.amount != null && (
                    <p className="text-success">התשלום יסומן כשולם בתאריך {paymentUpdateFromSwift(parsedSwift).paid_date}</p>
                  )}
                  {parsedSwift.warnings.map((w, i) => (
                    <p key={i} className="text-warning">{w}</p>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>הערות</Label>
              <Input value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="הערות..." />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>ביטול</Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? "שומר..." : "שמור"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {colMenu && (
        <ColContextMenu
          menu={colMenu}
          sortField={sortField}
          sortDir={sortDir}
          hiddenCols={hiddenCols}
          onClose={closeMenu}
          onHide={hide}
          onShow={show}
          onSortAsc={field => { setSortField(field as SortField); setSortDir("asc"); }}
          onSortDesc={field => { setSortField(field as SortField); setSortDir("desc"); }}
        />
      )}
    </>
  );
}
