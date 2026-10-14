/**
 * Dashboard document inbox — drop any procurement paperwork here and it is
 * recognised and routed: a SWIFT to its order's payment schedule, a B/L or
 * packing list to the order's import dossier, a PI / purchase order to a new
 * order. Nothing is written until the person approves the proposed destination,
 * because every one of these moves real money or real shipments.
 */
import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useData } from "@/contexts/AppContext";
import { useFileDropPaste } from "@/hooks/useFileDropPaste";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NewOrderDialog } from "@/components/orders/NewOrderDialog";
import { AlertTriangle, CheckCircle2, FileText, Inbox, Loader2, Sparkles, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { docKindLabels, type DocKind } from "@/lib/docRouter/classify";
import {
  analyzeFile, enrichForKind, planSwiftForOrder, suggestedOrderId, type AnalyzedDoc,
} from "@/lib/docRouter/analyze";
import { attachToExistingOrder, fileShipping, fileSwift, type ExecuteResult } from "@/lib/docRouter/execute";
import { swiftBelongsToOrder } from "@/lib/swiftImport/findOrder";
import { IMPORT_DOC_SUBTYPES, importDocSubtypeLabels, type ImportDocSubtype } from "@/lib/importFiles";

type RowStatus = "ready" | "saving" | "done" | "error";

interface Row {
  doc: AnalyzedDoc;
  orderId: string;
  subtype: ImportDocSubtype;
  status: RowStatus;
  message?: string;
}

interface PendingRow { id: string; name: string }

const KIND_OPTIONS: DocKind[] = ["SWIFT", "SHIPPING", "NEW_ORDER", "UNKNOWN"];

const kindStyles: Record<DocKind, string> = {
  SWIFT: "bg-success/15 text-success",
  SHIPPING: "bg-accent/15 text-accent",
  NEW_ORDER: "bg-primary/15 text-primary",
  UNKNOWN: "bg-muted text-muted-foreground",
};

const confidenceLabel = { high: "זיהוי בטוח", medium: "זיהוי סביר", low: "כדאי לבדוק" } as const;

const money = (v?: number | null, currency?: string | null) =>
  v == null ? "—" : `${v.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency ?? ""}`.trim();

export default function DocumentInboxCard() {
  const { orders, suppliers, products, addOrder } = useData();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [newOrderFile, setNewOrderFile] = useState<File | null>(null);
  const [newOrderRowId, setNewOrderRowId] = useState<string | null>(null);
  const [newOrderOpen, setNewOrderOpen] = useState(false);

  const orderOptions = useMemo(
    () => orders.map(o => ({
      value: o.id,
      label: [o.order_number, o.supplier_name, o.pi_number].filter(Boolean).join(" · ") || o.id.slice(0, 8),
      keywords: [o.order_number, o.pi_number, o.sap_doc_entry, o.tracking_number, o.supplier_name].filter(Boolean) as string[],
    })),
    [orders]
  );

  const patchRow = useCallback((id: string, patch: Partial<Row>) => {
    setRows(prev => prev.map(r => (r.doc.id === id ? { ...r, ...patch } : r)));
  }, []);

  const toRow = (doc: AnalyzedDoc): Row => ({
    doc,
    orderId: doc.kind === "SWIFT" ? doc.swiftPlan?.orderId ?? suggestedOrderId(doc) : suggestedOrderId(doc),
    subtype: doc.classification.subtype ?? "OTHER",
    status: "ready",
  });

  const handleFiles = useCallback(async (files: File[]) => {
    for (const file of files) {
      const placeholder = { id: `${file.name}-${Date.now()}-${Math.random()}`, name: file.name };
      setPending(prev => [...prev, placeholder]);
      try {
        const doc = await analyzeFile(file, orders);
        setRows(prev => [toRow(doc), ...prev]);
      } catch (err) {
        toast.error(`לא ניתן לנתח את ${file.name}: ${err instanceof Error ? err.message : "שגיאה"}`);
      } finally {
        setPending(prev => prev.filter(p => p.id !== placeholder.id));
      }
    }
  }, [orders]);

  const { isDragging, dropProps } = useFileDropPaste(() => {}, { onFiles: handleFiles, disabled: newOrderOpen });

  const changeKind = async (row: Row, kind: DocKind) => {
    patchRow(row.doc.id, { status: "saving" });
    const doc = kind === "UNKNOWN" ? { ...row.doc, kind } : await enrichForKind(row.doc, kind, orders);
    setRows(prev => prev.map(r => (r.doc.id === row.doc.id ? { ...toRow(doc), subtype: r.subtype } : r)));
  };

  const changeSwiftOrder = async (row: Row, orderId: string) => {
    patchRow(row.doc.id, { orderId });
    if (!row.doc.swiftPlan) return;
    const swiftPlan = await planSwiftForOrder(row.doc.swiftPlan.swift, orderId || null);
    setRows(prev => prev.map(r => (r.doc.id === row.doc.id ? { ...r, doc: { ...r.doc, swiftPlan } } : r)));
  };

  const finish = (id: string, result: ExecuteResult) => {
    patchRow(id, { status: result.error ? "error" : "done", message: result.message });
    if (!result.error) {
      queryClient.invalidateQueries({ queryKey: ["order-payment-statuses"] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    }
  };

  const approve = async (row: Row) => {
    const order = orders.find(o => o.id === row.orderId);
    patchRow(row.doc.id, { status: "saving" });
    try {
      if (row.doc.kind === "SWIFT" && order && row.doc.swiftPlan) {
        finish(row.doc.id, await fileSwift(row.doc.file, order, row.doc.swiftPlan));
      } else if (row.doc.kind === "SHIPPING" && order) {
        finish(row.doc.id, await fileShipping([{ file: row.doc.file, subtype: row.subtype }], order, suppliers));
      } else if (row.doc.kind === "NEW_ORDER" && row.doc.duplicate && row.doc.parsedOrder) {
        finish(row.doc.id, await attachToExistingOrder(row.doc.file, row.doc.duplicate, row.doc.parsedOrder));
      } else {
        patchRow(row.doc.id, { status: "ready" });
      }
    } catch (err) {
      finish(row.doc.id, { error: err instanceof Error ? err.message : "שגיאה", message: "שגיאה בשמירה" });
    }
  };

  const openNewOrder = (row: Row) => {
    setNewOrderRowId(row.doc.id);
    setNewOrderFile(row.doc.file);
    setNewOrderOpen(true);
  };

  /** Rows that can be filed with one click: a SWIFT or shipping paper whose order is known. */
  const approvable = rows.filter(r => r.status === "ready" && (
    (r.doc.kind === "SWIFT" || r.doc.kind === "SHIPPING") && !!r.orderId
  ));

  const approveAll = async () => {
    // Shipping papers for the same order go in one batch so they share a dossier.
    const shippingByOrder = new Map<string, Row[]>();
    for (const row of approvable) {
      if (row.doc.kind === "SHIPPING") {
        shippingByOrder.set(row.orderId, [...(shippingByOrder.get(row.orderId) ?? []), row]);
      }
    }
    for (const row of approvable.filter(r => r.doc.kind === "SWIFT")) await approve(row);
    for (const [orderId, group] of shippingByOrder) {
      const order = orders.find(o => o.id === orderId);
      if (!order) continue;
      group.forEach(r => patchRow(r.doc.id, { status: "saving" }));
      const result = await fileShipping(group.map(r => ({ file: r.doc.file, subtype: r.subtype })), order, suppliers);
      group.forEach(r => finish(r.doc.id, result));
    }
  };

  const clearFinished = () => setRows(prev => prev.filter(r => r.status !== "done"));

  return (
    <div className="bg-card rounded-xl border shadow-sm">
      <div className="flex items-center justify-between p-4 pb-2">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Inbox className="h-4 w-4 text-primary" />מרכז מסמכים חכם
        </h2>
        <div className="flex items-center gap-2">
          {rows.some(r => r.status === "done") && (
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={clearFinished}>נקה שטופלו</Button>
          )}
          {approvable.length > 1 && (
            <Button size="sm" onClick={approveAll}>אשר הכל ({approvable.length})</Button>
          )}
        </div>
      </div>

      <div className="px-4 pb-4 space-y-3">
        <label
          {...dropProps}
          className={cn(
            "flex flex-col items-center gap-1.5 rounded-lg border-2 border-dashed p-5 text-center cursor-pointer transition-colors",
            isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
          )}
        >
          <Upload className="h-6 w-6 text-muted-foreground" />
          <span className="text-sm text-foreground">גרור לכאן מסמכים, הדבק (Ctrl+V) או לחץ לבחירה</span>
          <span className="text-xs text-muted-foreground">
            SWIFT · PI / הזמנת רכש · שטר מטען, רשימת אריזה, רשימון, חשבוניות הובלה — המערכת מזהה לבד לאן כל מסמך שייך
          </span>
          <input
            type="file"
            multiple
            className="hidden"
            onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) handleFiles(files); e.target.value = ""; }}
          />
        </label>

        {pending.map(p => (
          <div key={p.id} className="flex items-center gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />קורא ומזהה את {p.name}...
          </div>
        ))}

        {rows.map(row => (
          <InboxRow
            key={row.doc.id}
            row={row}
            orderOptions={orderOptions}
            onKind={kind => changeKind(row, kind)}
            onOrder={orderId => (row.doc.kind === "SWIFT" ? changeSwiftOrder(row, orderId) : patchRow(row.doc.id, { orderId }))}
            onSubtype={subtype => patchRow(row.doc.id, { subtype })}
            onApprove={() => approve(row)}
            onOpenNewOrder={() => openNewOrder(row)}
            onDismiss={() => setRows(prev => prev.filter(r => r.doc.id !== row.doc.id))}
            orderPi={orders.find(o => o.id === row.orderId)?.pi_number}
          />
        ))}
      </div>

      <NewOrderDialog
        suppliers={suppliers}
        products={products}
        addOrder={addOrder}
        open={newOrderOpen}
        onOpenChange={open => {
          setNewOrderOpen(open);
          if (!open) setNewOrderFile(null);
        }}
        hideTrigger
        initialImportFile={newOrderFile}
        onInitialImportConsumed={() => setNewOrderFile(null)}
        onOrderCreated={() => {
          if (newOrderRowId) patchRow(newOrderRowId, { status: "done", message: "ההזמנה נוצרה והקובץ נשמר במסמכיה" });
          setNewOrderRowId(null);
        }}
      />
    </div>
  );
}

interface InboxRowProps {
  row: Row;
  orderOptions: { value: string; label: string; keywords: string[] }[];
  orderPi?: string | null;
  onKind: (kind: DocKind) => void;
  onOrder: (orderId: string) => void;
  onSubtype: (subtype: ImportDocSubtype) => void;
  onApprove: () => void;
  onOpenNewOrder: () => void;
  onDismiss: () => void;
}

function InboxRow({ row, orderOptions, orderPi, onKind, onOrder, onSubtype, onApprove, onOpenNewOrder, onDismiss }: InboxRowProps) {
  const { doc, status } = row;
  const busy = status === "saving";
  const done = status === "done";
  const plan = doc.swiftPlan;
  const mismatch = plan && row.orderId ? swiftBelongsToOrder(plan.swift, orderPi) === false : false;

  return (
    <div className={cn("rounded-lg border p-3 space-y-2.5", done && "bg-success/5 border-success/30", status === "error" && "border-destructive/40")}>
      <div className="flex items-start gap-2">
        <FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-foreground truncate" dir="ltr" style={{ textAlign: "right" }}>{doc.file.name}</div>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <span className={cn("text-xs font-semibold rounded px-1.5 py-0.5", kindStyles[doc.kind])}>{docKindLabels[doc.kind]}</span>
            {doc.kind !== "UNKNOWN" && (
              <span className="text-xs text-muted-foreground">
                {confidenceLabel[doc.classification.confidence]}
                {doc.classification.reasons.length > 0 && ` · ${doc.classification.reasons.slice(0, 2).join(", ")}`}
              </span>
            )}
          </div>
        </div>
        {!done && (
          <>
            <Select value={doc.kind} onValueChange={v => onKind(v as DocKind)} disabled={busy}>
              <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {KIND_OPTIONS.map(k => <SelectItem key={k} value={k}>{docKindLabels[k]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDismiss} disabled={busy}><X className="h-3.5 w-3.5" /></Button>
          </>
        )}
      </div>

      {doc.notes.map((n, i) => (
        <p key={i} className="flex items-start gap-1.5 text-xs text-amber-700"><AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{n}</p>
      ))}

      {done && (
        <p className="flex items-center gap-1.5 text-sm text-success"><CheckCircle2 className="h-4 w-4" />{row.message}</p>
      )}
      {status === "error" && <p className="text-sm text-destructive">{row.message}</p>}

      {!done && doc.kind === "UNKNOWN" && (
        <p className="text-xs text-muted-foreground">לא הצלחתי לזהות את המסמך — בחר ידנית מה הוא בתפריט למעלה.</p>
      )}

      {!done && plan && doc.kind === "SWIFT" && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Fact label="סכום" value={money(plan.swift.amount, plan.swift.currency)} />
            <Fact label="תאריך ערך" value={plan.swift.valueDate ?? "—"} />
            <Fact label="מוטב" value={plan.swift.beneficiary ?? "—"} />
            <Fact label="אסמכתא / חשבונית" value={plan.swift.referencedDocument ?? plan.swift.reference ?? "—"} />
          </div>
          <OrderPicker row={row} options={orderOptions} onOrder={onOrder} busy={busy} />
          {row.orderId && (
            plan.match
              ? <p className="text-xs text-success">יסומן כשולם: {plan.match.reason}</p>
              : <p className="text-xs text-muted-foreground">לא נמצא תשלום תואם בלוח התשלומים — המסמך יישמר בהזמנה בלי לשנות תשלום.</p>
          )}
          {mismatch && (
            <p className="flex items-start gap-1.5 text-xs text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              ה-SWIFT מפנה לחשבונית {plan.swift.referencedDocument}, שאינה של ההזמנה הזו — המסמך יישמר אך שום תשלום לא יסומן.
            </p>
          )}
          {plan.swift.warnings.map((w, i) => <p key={i} className="text-xs text-amber-700">{w}</p>)}
          <Button size="sm" onClick={onApprove} disabled={busy || !row.orderId}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" /> : null}
            {plan.match && !mismatch ? "שמור וסמן כשולם" : "שמור בהזמנה"}
          </Button>
        </div>
      )}

      {!done && doc.kind === "SHIPPING" && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">סוג מסמך:</span>
            <Select value={row.subtype} onValueChange={v => onSubtype(v as ImportDocSubtype)} disabled={busy}>
              <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {IMPORT_DOC_SUBTYPES.map(s => <SelectItem key={s} value={s}>{importDocSubtypeLabels[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <OrderPicker row={row} options={orderOptions} onOrder={onOrder} busy={busy} />
          {doc.candidates.length > 1 && !row.orderId && (
            <p className="text-xs text-muted-foreground">
              כמה הזמנות מתאימות ({doc.candidates.map(c => c.order.order_number ?? c.order.pi_number).filter(Boolean).join(", ")}) — בחר את ההזמנה.
            </p>
          )}
          {!doc.candidates.length && !row.orderId && (
            <p className="text-xs text-muted-foreground">לא נמצא מזהה של הזמנה במסמך — בחר הזמנה ידנית.</p>
          )}
          <Button size="sm" onClick={onApprove} disabled={busy || !row.orderId}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" /> : null}הוסף לתיק יבוא של ההזמנה
          </Button>
        </div>
      )}

      {!done && doc.kind === "NEW_ORDER" && doc.parsedOrder && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Fact label="מספר" value={doc.parsedOrder.poNumber ?? doc.parsedOrder.piNumber ?? "—"} />
            <Fact label="ספק" value={doc.parsedOrder.supplierName ?? "—"} />
            <Fact label="פריטים" value={String(doc.parsedOrder.items.length)} />
            <Fact label="סה״כ" value={money(doc.parsedOrder.total ?? doc.parsedOrder.subtotal, doc.parsedOrder.currency)} />
          </div>
          {doc.parsedOrder.warnings.map((w, i) => <p key={i} className="text-xs text-amber-700">{w}</p>)}
          {doc.duplicate ? (
            <>
              <p className="flex items-start gap-1.5 text-xs text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                כבר קיימת הזמנה עם אותו מספר ({doc.duplicate.order_number ?? doc.duplicate.pi_number}) — לא אפתח הזמנה כפולה.
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={onApprove} disabled={busy}>צרף להזמנה הקיימת</Button>
                <Button size="sm" variant="outline" onClick={onOpenNewOrder} disabled={busy}>צור הזמנה חדשה בכל זאת</Button>
              </div>
            </>
          ) : (
            <Button size="sm" onClick={onOpenNewOrder} disabled={busy}>
              <Sparkles className="h-3.5 w-3.5 ml-1" />פתח הזמנה חדשה מהמסמך
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function OrderPicker({ row, options, onOrder, busy }: {
  row: Row;
  options: { value: string; label: string; keywords: string[] }[];
  onOrder: (id: string) => void;
  busy: boolean;
}) {
  const suggested = row.doc.candidates.find(c => c.order.id === row.orderId);
  return (
    <div className="space-y-1">
      <Combobox
        value={row.orderId}
        onValueChange={onOrder}
        options={options}
        placeholder="בחר הזמנה"
        searchPlaceholder="חיפוש לפי מספר הזמנה, PI או ספק..."
        disabled={busy}
      />
      {suggested && <p className="text-xs text-success">זוהתה לפי: {suggested.reasons.join(", ")}</p>}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/10 px-2 py-1">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-medium text-foreground truncate" dir="ltr" style={{ textAlign: "right" }}>{value}</div>
    </div>
  );
}
