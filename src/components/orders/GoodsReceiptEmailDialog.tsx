/**
 * "מייל קליטת סחורה" — the mail that goes to the receiving clerk when a
 * shipment lands, with the supplier's invoice attached.
 *
 * Everything is prefilled from the order and stays editable: the table is the
 * mail, row for row, so what the sender sees here is what the clerk receives.
 * The rendering and the send itself happen in the send-goods-receipt-email Edge
 * Function — this dialog only submits structured rows.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateInput } from "@/components/ui/date-input";
import { Mail, Loader2, Paperclip, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/contexts/AppContext";
import type { Order } from "@/contexts/types";
import {
  GOODS_RECEIPT_ROW_COLUMNS,
  GOODS_RECEIPT_SUPPLIER_FIELDS,
  buildGoodsReceiptSubject,
  formatReceiptDate,
  isLikelyInvoice,
  warehouseLabel,
  type GoodsReceiptField,
  type GoodsReceiptLine,
} from "@/lib/goodsReceipt";

interface CenterOption {
  id: string;
  name: string;
  sap_code: string | null;
}

interface AttachableDocument {
  id: string;
  document_name: string | null;
  type: string | null;
  document_subtype: string | null;
  file_url: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  onSent?: () => void;
}

let rowSeq = 0;
const nextKey = () => `row-${++rowSeq}`;

export default function GoodsReceiptEmailDialog({ open, onOpenChange, order, onSent }: Props) {
  const { suppliers, products } = useData();

  const [lines, setLines] = useState<GoodsReceiptLine[]>([]);
  const [receiptDate, setReceiptDate] = useState<Date | undefined>(new Date());
  const [warehouse, setWarehouse] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [recipient, setRecipient] = useState("");
  const [greetingName, setGreetingName] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [subjectTouched, setSubjectTouched] = useState(false);
  const [note, setNote] = useState("");

  const [centers, setCenters] = useState<CenterOption[]>([]);
  const [documents, setDocuments] = useState<AttachableDocument[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const supplier = useMemo(
    () => (order.supplier_id ? suppliers.find(s => s.id === order.supplier_id) : undefined),
    [order.supplier_id, suppliers],
  );

  /** Prefill from the order every time the dialog is opened, so a reopen is a clean slate. */
  useEffect(() => {
    if (!open) return;

    const today = formatReceiptDate(new Date());
    const supplierName = supplier?.company || order.supplier_name || "";
    const supplierCode = supplier?.sap_code || "";

    setLines(order.items.map(item => {
      const product = item.product_id
        ? products.find(p => p.id === item.product_id)
        : products.find(p => p.name === item.name);
      return {
        key: nextKey(),
        supplier_code: supplierCode,
        supplier_name: supplierName,
        product_code: product?.sap_code || product?.sku?.toUpperCase() || "",
        product_name: product?.name || item.name,
        qty: item.qty != null ? String(item.qty) : "",
        receipt_date: today,
        warehouse: "",
        received_by: "",
      };
    }));
    setReceiptDate(new Date());
    setWarehouse("");
    setReceivedBy("");
    setNote("");
    setSubjectTouched(false);
  }, [open, order, products, supplier]);

  /** Config defaults, warehouses and attachable documents — one round trip per open. */
  const loadContext = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, centersRes, docsRes] = await Promise.all([
        supabase.from("app_config").select("key, value")
          .in("key", ["goods_receipt_recipient_email", "goods_receipt_cc_emails", "goods_receipt_recipient_name"]),
        supabase.from("distribution_centers").select("id, name, sap_code").order("is_main", { ascending: false }).order("name"),
        supabase.from("purchase_documents").select("id, document_name, type, document_subtype, file_url")
          .eq("order_id", order.id).not("file_url", "is", null).order("created_at", { ascending: false }),
      ]);

      const config = Object.fromEntries((configRes.data ?? []).map(r => [r.key, r.value ?? ""]));
      setRecipient(config.goods_receipt_recipient_email ?? "");
      setCc(config.goods_receipt_cc_emails ?? "");
      setGreetingName(config.goods_receipt_recipient_name ?? "");

      setCenters((centersRes.data ?? []) as CenterOption[]);

      const docs = (docsRes.data ?? []) as AttachableDocument[];
      setDocuments(docs);
      const invoices = docs.filter(isLikelyInvoice);
      setSelectedDocs((invoices.length > 0 ? invoices : docs.slice(0, 1)).map(d => d.id));
    } finally {
      setLoading(false);
    }
  }, [order.id]);

  useEffect(() => { if (open) loadContext(); }, [open, loadContext]);

  /** The subject tracks the product codes until the sender types their own. */
  useEffect(() => {
    if (!subjectTouched) setSubject(buildGoodsReceiptSubject(lines));
  }, [lines, subjectTouched]);

  const setField = (key: string, field: keyof GoodsReceiptLine, value: string) =>
    setLines(prev => prev.map(l => (l.key === key ? { ...l, [field]: value } : l)));

  /** The header controls are "apply to every row" — rows stay editable after. */
  const applyToAll = (field: GoodsReceiptField, value: string) =>
    setLines(prev => prev.map(l => ({ ...l, [field]: value })));

  const handleDateChange = (date: Date | undefined) => {
    setReceiptDate(date);
    applyToAll("receipt_date", date ? formatReceiptDate(date) : "");
  };

  const handleWarehouseChange = (centerId: string) => {
    const center = centers.find(c => c.id === centerId);
    if (!center) return;
    const label = warehouseLabel(center);
    setWarehouse(centerId);
    applyToAll("warehouse", label);
  };

  const handleReceivedByChange = (value: string) => {
    setReceivedBy(value);
    applyToAll("received_by", value);
  };

  const addLine = () => setLines(prev => [...prev, {
    key: nextKey(),
    supplier_code: supplier?.sap_code || "",
    supplier_name: supplier?.company || order.supplier_name || "",
    product_code: "",
    product_name: "",
    qty: "",
    receipt_date: receiptDate ? formatReceiptDate(receiptDate) : "",
    warehouse: prev[0]?.warehouse ?? "",
    received_by: receivedBy,
  }]);

  const toggleDoc = (id: string) =>
    setSelectedDocs(prev => (prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]));

  const handleSend = async () => {
    if (lines.length === 0) { toast.error("אין שורות לשליחה"); return; }
    if (!recipient.trim()) { toast.error("חסר נמען — הגדר אותו בהגדרות או הזן כאן"); return; }
    if (lines.some(l => !l.product_code.trim() && !l.product_name.trim())) {
      toast.error("כל שורה חייבת לכלול קוד מוצר או שם מוצר");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-goods-receipt-email", {
        body: {
          order_id: order.id,
          // `key` is a client-side row id — the function has no use for it.
          lines: lines.map(({ key: _key, ...line }) => line),
          recipient_email: recipient.trim(),
          cc_emails: cc.split(",").map(s => s.trim()).filter(Boolean),
          greeting_name: greetingName.trim(),
          subject: subject.trim(),
          note: note.trim(),
          receipt_date: receiptDate ? receiptDate.toISOString().split("T")[0] : null,
          warehouse: lines[0]?.warehouse ?? "",
          received_by: receivedBy.trim(),
          document_ids: selectedDocs,
        },
      });

      // A non-2xx from an Edge Function surfaces as an opaque FunctionsHttpError,
      // so the Hebrew reason the function returned is read off the response body.
      if (error) {
        const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
        throw new Error(detail?.error ?? error.message);
      }
      if (data?.error) throw new Error(data.error);

      toast.success(`המייל נשלח ל-${data?.recipient ?? recipient}`);
      onSent?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שליחת המייל נכשלה");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            מייל קליטת סחורה
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-10 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          </div>
        ) : (
          <div className="space-y-5 min-w-0">
            {/* Recipients */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="gr-to">אל</Label>
                <Input id="gr-to" dir="ltr" value={recipient} onChange={e => setRecipient(e.target.value)}
                  placeholder="clerk@cobra.co.il" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="gr-cc">עותק (מופרד בפסיקים)</Label>
                <Input id="gr-cc" dir="ltr" value={cc} onChange={e => setCc(e.target.value)} placeholder="—" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="gr-subject">נושא</Label>
                <Input id="gr-subject" value={subject}
                  onChange={e => { setSubjectTouched(true); setSubject(e.target.value); }} />
              </div>
            </div>

            {/* Values shared by every row — the supplier, and the receipt details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg border bg-muted/30 p-3">
              {GOODS_RECEIPT_SUPPLIER_FIELDS.map(f => (
                <div key={f.field} className="space-y-1">
                  <Label htmlFor={`gr-${f.field}`}>{f.label}</Label>
                  <Input
                    id={`gr-${f.field}`}
                    value={lines[0]?.[f.field] ?? ""}
                    onChange={e => applyToAll(f.field, e.target.value)}
                    placeholder={f.field === "supplier_code" ? "קוד הספק ב-SAP" : "שם הספק"}
                  />
                </div>
              ))}
              <div className="hidden sm:block" />
              <div className="space-y-1">
                <Label>תאריך קבלה</Label>
                <DateInput value={receiptDate} onChange={handleDateChange} />
              </div>
              <div className="space-y-1">
                <Label>לאן לקלוט</Label>
                <Select value={warehouse} onValueChange={handleWarehouseChange}>
                  <SelectTrigger><SelectValue placeholder="בחר מחסן..." /></SelectTrigger>
                  <SelectContent>
                    {centers.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{c.sap_code ? ` (${c.sap_code})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="gr-received-by">מי קיבל</Label>
                <Input id="gr-received-by" value={receivedBy}
                  onChange={e => handleReceivedByChange(e.target.value)} placeholder="שם הקולט" />
              </div>
            </div>

            {/* The table, exactly as it goes out */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>שורות המייל</Label>
                <Button variant="outline" size="sm" onClick={addLine}>
                  <Plus className="h-3.5 w-3.5 ml-1" />שורה
                </Button>
              </div>
              {/* table-fixed with percentage widths: the table sizes to the
                  dialog rather than forcing it wider than the screen. */}
              <div className="rounded-lg border min-w-0">
                <table className="w-full table-fixed text-sm">
                  <thead>
                    <tr className="bg-[#2f5597] text-white">
                      {GOODS_RECEIPT_ROW_COLUMNS.map(col => (
                        <th key={col.field} className="text-right px-2 py-1.5 text-xs font-semibold"
                          style={{ width: col.width }}>{col.label}</th>
                      ))}
                      <th style={{ width: "4%" }} />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {lines.map(line => (
                      <tr key={line.key} className="hover:bg-muted/30">
                        {GOODS_RECEIPT_ROW_COLUMNS.map(col => (
                          <td key={col.field} className="p-1">
                            <Input
                              className="h-8 w-full px-2 text-xs border-transparent bg-transparent hover:border-input focus:border-input"
                              value={line[col.field]}
                              onChange={e => setField(line.key, col.field, e.target.value)}
                            />
                          </td>
                        ))}
                        <td className="p-1 text-center">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                            onClick={() => setLines(prev => prev.filter(l => l.key !== line.key))}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {lines.length === 0 && (
                      <tr><td colSpan={GOODS_RECEIPT_ROW_COLUMNS.length + 1}
                        className="p-4 text-center text-muted-foreground">אין שורות</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Attachments */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5" />קבצים מצורפים
              </Label>
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  אין מסמכים עם קובץ מצורף בהזמנה זו — העלה את החשבונית במסמכי ההזמנה כדי לצרף אותה.
                </p>
              ) : (
                <div className="space-y-1.5 rounded-lg border p-3 max-h-48 overflow-y-auto min-w-0">
                  {documents.map(doc => (
                    <label key={doc.id} className="flex items-center gap-2 text-sm cursor-pointer min-w-0">
                      <Checkbox className="shrink-0" checked={selectedDocs.includes(doc.id)}
                        onCheckedChange={() => toggleDoc(doc.id)} />
                      <span className="truncate min-w-0">{doc.document_name || "ללא שם"}</span>
                      {doc.document_subtype && (
                        <span className="text-xs text-muted-foreground shrink-0">({doc.document_subtype})</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="gr-note">הערה (אופציונלי)</Label>
              <Textarea id="gr-note" value={note} onChange={e => setNote(e.target.value)} rows={2}
                placeholder="טקסט חופשי שיתווסף מתחת לטבלה" />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>ביטול</Button>
          <Button onClick={handleSend} disabled={sending || loading}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Mail className="h-4 w-4 ml-1" />}
            שלח
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
