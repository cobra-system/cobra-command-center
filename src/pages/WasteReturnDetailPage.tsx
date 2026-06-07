/* eslint-disable @typescript-eslint/no-explicit-any */
import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InlineEditField } from "@/components/InlineEditField";
import { WasteReturnStatusBadge } from "@/components/waste/WasteStatusBadge";
import { WasteReturnDhlWidget } from "@/components/waste/WasteReturnDhlWidget";
import { useData } from "@/contexts/AppContext";
import { usePermissions } from "@/hooks/usePermissions";
import {
  ArrowRight,
  Truck,
  Package,
  Calendar,
  DollarSign,
  FileText,
  Trash2,
  Check,
  AlertCircle,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { WasteSupplierReturn, WasteItem } from "@/contexts/types";

// ─── Settlement dialog ────────────────────────────────────────────────────────

interface SettlementDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (type: "rma" | "credit") => void;
}

function SettlementDialog({ open, onOpenChange, onConfirm }: SettlementDialogProps) {
  const [type, setType] = useState<"rma" | "credit">("rma");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>בחר סוג הסדרה</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          לפני שמסמנים כ"הוסדר", יש לציין כיצד ההחזרה הוסדרה עם הספק.
        </p>
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label>סוג הסדרה</Label>
            <Select value={type} onValueChange={(v: "rma" | "credit") => setType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rma">RMA — יחזור לאחר תיקון</SelectItem>
                <SelectItem value="credit">זיכוי כספי</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button className="flex-1" onClick={() => { onConfirm(type); onOpenChange(false); }}>
              סמן כהוסדר
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Settlement section ───────────────────────────────────────────────────────

interface SettlementSectionProps {
  ret: WasteSupplierReturn;
  hasEdit: boolean;
  onSaved: () => void;
}

function SettlementSection({ ret, hasEdit, onSaved }: SettlementSectionProps) {
  const [creditInput, setCreditInput] = useState(ret.credit_amount?.toString() ?? "");
  const [rmaDateInput, setRmaDateInput] = useState(ret.rma_expected_return_date?.slice(0, 10) ?? "");
  const [savingCredit, setSavingCredit] = useState(false);
  const [savingDate, setSavingDate] = useState(false);

  async function saveSettlementType(value: string) {
    const { error } = await supabase
      .from("waste_supplier_returns")
      .update({ settlement_type: value || null })
      .eq("id", ret.id);
    if (error) { toast.error("שגיאה בשמירה"); return; }
    toast.success("סוג הסדרה עודכן");
    onSaved();
  }

  async function saveCreditAmount() {
    setSavingCredit(true);
    const parsed = creditInput ? Number(creditInput) : null;
    const { error } = await supabase
      .from("waste_supplier_returns")
      .update({ credit_amount: parsed })
      .eq("id", ret.id);
    setSavingCredit(false);
    if (error) { toast.error("שגיאה בשמירה"); return; }
    toast.success("סכום זיכוי עודכן");
    onSaved();
  }

  async function saveRmaDate() {
    setSavingDate(true);
    const { error } = await supabase
      .from("waste_supplier_returns")
      .update({ rma_expected_return_date: rmaDateInput || null })
      .eq("id", ret.id);
    setSavingDate(false);
    if (error) { toast.error("שגיאה בשמירה"); return; }
    toast.success("תאריך RMA עודכן");
    onSaved();
  }

  return (
    <div className="bg-card rounded-xl border shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2">
        <DollarSign className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">פרטי הסדרה</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Settlement type */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">סוג הסדרה</p>
          {hasEdit ? (
            <Select
              value={ret.settlement_type ?? ""}
              onValueChange={saveSettlementType}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="בחר סוג..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rma">RMA — יחזור לאחר תיקון</SelectItem>
                <SelectItem value="credit">זיכוי כספי</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm font-medium text-foreground">
              {ret.settlement_type === "rma"
                ? "RMA — יחזור לאחר תיקון"
                : ret.settlement_type === "credit"
                ? "זיכוי כספי"
                : "—"}
            </p>
          )}
        </div>

        {/* RMA expected return date */}
        {ret.settlement_type === "rma" && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              תאריך החזרה משוערת (RMA)
            </div>
            {hasEdit ? (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={rmaDateInput}
                  onChange={e => setRmaDateInput(e.target.value)}
                  className="h-8 text-sm flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={saveRmaDate}
                  disabled={savingDate}
                >
                  {savingDate ? "שומר..." : "שמור"}
                </Button>
              </div>
            ) : (
              <p className="text-sm font-medium text-foreground">
                {ret.rma_expected_return_date
                  ? format(new Date(ret.rma_expected_return_date), "dd/MM/yyyy")
                  : "—"}
              </p>
            )}
          </div>
        )}

        {/* Credit amount */}
        {ret.settlement_type === "credit" && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <DollarSign className="h-3.5 w-3.5" />
              סכום זיכוי ($)
            </div>
            {hasEdit ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={creditInput}
                  onChange={e => setCreditInput(e.target.value)}
                  placeholder="0.00"
                  className="h-8 text-sm flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={saveCreditAmount}
                  disabled={savingCredit}
                >
                  {savingCredit ? "שומר..." : "שמור"}
                </Button>
              </div>
            ) : (
              <p className="text-sm font-medium text-foreground">
                {ret.credit_amount != null ? `$${ret.credit_amount.toLocaleString()}` : "—"}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Status advancement card ──────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  draft: "טיוטה",
  shipped: "נשלח",
  delivered: "התקבל אצל ספק",
  settled: "הוסדר",
};

const NEXT_ACTION_LABEL: Record<string, string> = {
  draft: "סמן כנשלח",
  shipped: "סמן כהתקבל אצל ספק",
  delivered: "סמן כהוסדר",
};

interface StatusCardProps {
  ret: WasteSupplierReturn;
  hasEdit: boolean;
  onAdvance: () => void;
}

function StatusCard({ ret, hasEdit, onAdvance }: StatusCardProps) {
  const statusOrder = ["draft", "shipped", "delivered", "settled"] as const;
  const currentIdx = statusOrder.indexOf(ret.status as any);
  const isSettled = ret.status === "settled";

  return (
    <div className="bg-card rounded-xl border shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Truck className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">מצב ההחזרה</h2>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-1">
        {statusOrder.map((s, i) => {
          const reached = i <= currentIdx;
          const current = i === currentIdx;
          return (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div className="flex flex-col items-center gap-1 flex-1">
                <div
                  className={cn(
                    "h-2.5 w-2.5 rounded-full border-2 transition-colors",
                    reached
                      ? "border-primary bg-primary"
                      : "border-muted-foreground/30 bg-background",
                    current && "ring-2 ring-primary/30",
                  )}
                />
                <span
                  className={cn(
                    "text-[10px] whitespace-nowrap",
                    reached ? "text-foreground font-medium" : "text-muted-foreground",
                  )}
                >
                  {STATUS_LABELS[s]}
                </span>
              </div>
              {i < statusOrder.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 rounded-full -mt-3",
                    i < currentIdx ? "bg-primary" : "bg-muted-foreground/20",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Action area */}
      {hasEdit && (
        <div className="pt-1">
          {isSettled ? (
            <div className="flex items-center gap-2 text-sm text-green-700 font-medium">
              <Check className="h-4 w-4 text-green-600" />
              ההחזרה הוסדרה בהצלחה
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <Button onClick={onAdvance} size="sm">
                {NEXT_ACTION_LABEL[ret.status]}
              </Button>
              {ret.status === "draft" && !ret.tracking_number && (
                <div className="flex items-center gap-1.5 text-xs text-amber-700">
                  <AlertCircle className="h-3.5 w-3.5" />
                  יש להזין מספר מעקב לפני שליחה
                </div>
              )}
              {ret.status === "delivered" && !ret.settlement_type && (
                <div className="flex items-center gap-1.5 text-xs text-amber-700">
                  <AlertCircle className="h-3.5 w-3.5" />
                  יש לבחור סוג הסדרה לפני סגירה
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WasteReturnDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentUser } = useData();
  const { hasEdit, isManager } = usePermissions("waste");

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [removeItemConfirm, setRemoveItemConfirm] = useState<string | null>(null);
  const [settlementDialogOpen, setSettlementDialogOpen] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: ret, isLoading, refetch } = useQuery({
    queryKey: ["waste-return", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waste_supplier_returns")
        .select("*, suppliers(company)")
        .eq("id", id!)
        .is("deleted_at", null)
        .single();
      if (error) throw error;
      return {
        ...data,
        supplier_name: (data as any).suppliers?.company ?? null,
      } as WasteSupplierReturn;
    },
    enabled: !!id,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["waste-return-items", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waste_return_items")
        .select("waste_items(*, products(name, sku))")
        .eq("return_id", id!);
      if (error) throw error;
      return ((data ?? []) as any[]).map((row: any) => ({
        ...row.waste_items,
        product_name: row.waste_items?.products?.name ?? null,
        product_sku: row.waste_items?.products?.sku ?? null,
      })) as WasteItem[];
    },
    enabled: !!id,
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleSave(field: string, value: string) {
    const updates: Record<string, any> = {};
    if (field === "tracking_number") updates.tracking_number = value || null;
    else if (field === "tracking_carrier") updates.tracking_carrier = value || null;
    else if (field === "return_reason") updates.return_reason = value || null;
    else if (field === "notes") updates.notes = value || null;
    const { error } = await supabase
      .from("waste_supplier_returns")
      .update(updates)
      .eq("id", id!);
    if (error) { toast.error("שגיאה בשמירה"); return; }
    toast.success("עודכן");
    refetch();
  }

  async function advanceStatus(overrideSettlement?: "rma" | "credit") {
    if (!ret) return;
    const next = ({ draft: "shipped", shipped: "delivered", delivered: "settled" } as Record<string, string>)[ret.status];
    if (!next) return;

    if (next === "shipped" && !ret.tracking_number) {
      toast.error("יש להזין מספר מעקב לפני שליחה");
      return;
    }
    if (next === "settled" && !ret.settlement_type && !overrideSettlement) {
      setSettlementDialogOpen(true);
      return;
    }

    const updates: Record<string, any> = { status: next };
    if (overrideSettlement) updates.settlement_type = overrideSettlement;

    const { error } = await supabase
      .from("waste_supplier_returns")
      .update(updates)
      .eq("id", id!);
    if (error) { toast.error("שגיאה בעדכון סטטוס"); return; }
    toast.success("סטטוס עודכן");
    refetch();
  }

  async function handleDelete() {
    const { error } = await supabase
      .from("waste_supplier_returns")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id!);
    if (error) { toast.error("שגיאה במחיקה"); return; }
    toast.success("ההחזרה נמחקה");
    queryClient.invalidateQueries({ queryKey: ["waste-supplier-returns"] });
    navigate(-1);
  }

  async function handleRemoveItem(itemId: string) {
    // Remove from the junction table
    const { error: linkError } = await supabase
      .from("waste_return_items")
      .delete()
      .eq("return_id", id!)
      .eq("waste_item_id", itemId);
    if (linkError) { toast.error("שגיאה בהסרת פריט"); return; }

    // Reset waste item status back to pending
    await supabase
      .from("waste_items")
      .update({ status: "pending" })
      .eq("id", itemId);

    toast.success("פריט הוסר מההחזרה");
    queryClient.invalidateQueries({ queryKey: ["waste-return-items", id] });
    queryClient.invalidateQueries({ queryKey: ["waste-supplier-returns"] });
  }

  // ── Loading / not found ────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <p className="text-sm">טוען החזרה...</p>
        </div>
      </div>
    );
  }

  if (!ret) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="font-medium">החזרה לא נמצאה</p>
      </div>
    );
  }

  const showSettlement = ret.status === "delivered" || ret.status === "settled";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6" dir="rtl">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground">
            {ret.supplier_name ?? "החזרה לספק"}
          </h1>
          {ret.created_at && (
            <p className="text-sm text-muted-foreground">
              נוצר ב-{format(new Date(ret.created_at), "dd/MM/yyyy")}
              {ret.created_by_name && ` על ידי ${ret.created_by_name}`}
            </p>
          )}
        </div>
        <WasteReturnStatusBadge status={ret.status} />
        {isManager && (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteConfirm(true)}
          >
            <Trash2 className="h-4 w-4 ml-1" />
            מחיקה
          </Button>
        )}
      </div>

      {/* ── Status advancement ────────────────────────────────────────────── */}
      <StatusCard ret={ret} hasEdit={hasEdit} onAdvance={() => advanceStatus()} />

      {/* ── Details grid ─────────────────────────────────────────────────── */}
      <div className="bg-card rounded-xl border shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">פרטי ההחזרה</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

          {/* Tracking number */}
          <InlineEditField
            label="מספר מעקב"
            value={ret.tracking_number}
            onSave={v => handleSave("tracking_number", v)}
            disabled={!hasEdit}
          />

          {/* Carrier */}
          <InlineEditField
            label="חברת שילוח"
            value={ret.tracking_carrier ?? ""}
            displayValue={
              ret.tracking_carrier === "dhl"
                ? "DHL"
                : ret.tracking_carrier === "other"
                ? "אחר"
                : undefined
            }
            options={[
              { value: "dhl", label: "DHL" },
              { value: "other", label: "אחר" },
            ]}
            onSave={v => handleSave("tracking_carrier", v)}
            disabled={!hasEdit}
          />

          {/* Return reason */}
          <InlineEditField
            label="סיבת ההחזרה"
            value={ret.return_reason}
            onSave={v => handleSave("return_reason", v)}
            disabled={!hasEdit}
            className="sm:col-span-2"
          />

          {/* Notes */}
          <InlineEditField
            label="הערות"
            value={ret.notes}
            type="textarea"
            onSave={v => handleSave("notes", v)}
            disabled={!hasEdit}
            className="sm:col-span-2"
          />
        </div>
      </div>

      {/* ── Settlement section ────────────────────────────────────────────── */}
      {showSettlement && (
        <SettlementSection ret={ret} hasEdit={hasEdit} onSaved={refetch} />
      )}

      {/* ── DHL tracking widget ───────────────────────────────────────────── */}
      {ret.tracking_carrier === "dhl" && (
        <WasteReturnDhlWidget ret={ret} onRefreshed={refetch} />
      )}

      {/* ── Items table ───────────────────────────────────────────────────── */}
      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center gap-2">
          <Package className="h-4 w-4 text-accent" />
          <h2 className="font-semibold text-foreground">פריטים בהחזרה ({items.length})</h2>
        </div>

        {items.length === 0 ? (
          <div className="py-12 text-center">
            <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">אין פריטים בהחזרה זו</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              הוסף פריטי בלאי מדף פריטי הבלאי
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-right p-3 font-semibold text-foreground">מוצר</th>
                <th className="text-right p-3 font-semibold text-foreground">SKU</th>
                <th className="text-right p-3 font-semibold text-foreground">כמות</th>
                <th className="text-right p-3 font-semibold text-foreground">מצב</th>
                <th className="text-right p-3 font-semibold text-foreground">הערות</th>
                {hasEdit && ret.status === "draft" && (
                  <th className="p-3 w-12" />
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-3 font-medium text-foreground">
                    {item.product_name ?? <span className="text-muted-foreground italic text-xs">לא ידוע</span>}
                  </td>
                  <td className="p-3 text-muted-foreground font-mono text-xs">
                    {item.product_sku ?? "—"}
                  </td>
                  <td className="p-3 text-muted-foreground tabular-nums">{item.quantity}</td>
                  <td className="p-3 text-muted-foreground text-xs">{item.status}</td>
                  <td className="p-3 text-muted-foreground text-xs max-w-[200px] truncate">
                    {item.condition_notes ?? "—"}
                  </td>
                  {hasEdit && ret.status === "draft" && (
                    <td className="p-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive h-7 w-7 p-0"
                        onClick={() => setRemoveItemConfirm(item.id)}
                        title="הסר מהחזרה"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Delete return confirmation ─────────────────────────────────────── */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>מחיקת החזרה לספק</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            האם למחוק את ההחזרה? פעולה זו אינה ניתנת לביטול.
          </p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(false)}>
              ביטול
            </Button>
            <Button variant="destructive" className="flex-1" onClick={handleDelete}>
              מחק
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Remove item confirmation ──────────────────────────────────────── */}
      <Dialog
        open={!!removeItemConfirm}
        onOpenChange={open => { if (!open) setRemoveItemConfirm(null); }}
      >
        <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>הסרת פריט מההחזרה</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            הפריט יוסר מההחזרה ויחזור לסטטוס "ממתין לטיפול". האם להמשיך?
          </p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setRemoveItemConfirm(null)}>
              ביטול
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => {
                handleRemoveItem(removeItemConfirm!);
                setRemoveItemConfirm(null);
              }}
            >
              הסר
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Settlement type dialog (shown when advancing to settled) ─────── */}
      <SettlementDialog
        open={settlementDialogOpen}
        onOpenChange={setSettlementDialogOpen}
        onConfirm={type => advanceStatus(type)}
      />
    </div>
  );
}
