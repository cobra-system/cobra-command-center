import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SupplierReturnStatusBadge } from "./DispositionBadge";
import { PhotoCaptureButton } from "@/components/ui/PhotoCaptureButton";
import { Loader2, ChevronLeft, X, Download, Trash2 } from "lucide-react";

interface SupplierReturn {
  id: string;
  supplier_id: string;
  status: string;
  tracking_number: string | null;
  return_reason: string | null;
  resolution_type: string | null;
  resolution_notes: string | null;
  shipped_at: string | null;
  received_at: string | null;
  settled_at: string | null;
  created_by_name: string | null;
  notes: string | null;
  photo_url: string | null;
  created_at: string;
  suppliers?: { name: string };
}

interface WasteItem {
  id: string;
  product_name: string;
  sku: string;
  quantity: number;
  photo_url: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
  supplierReturn: SupplierReturn;
  items: WasteItem[];
}

const STATUS_ORDER = ["טיוטה", "נשלח", "התקבל אצל ספק", "הוסדר"];

export function SupplierReturnDetailPanel({ open, onClose, onUpdated, supplierReturn, items }: Props) {
  const [advancing, setAdvancing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingTracking, setEditingTracking] = useState(false);
  const [trackingInput, setTrackingInput] = useState(supplierReturn.tracking_number ?? "");
  const [resolutionType, setResolutionType] = useState(supplierReturn.resolution_type ?? "");
  const [resolutionNotes, setResolutionNotes] = useState(supplierReturn.resolution_notes ?? "");

  const currentIndex = STATUS_ORDER.indexOf(supplierReturn.status);
  const nextStatus = STATUS_ORDER[currentIndex + 1];
  const isSettled = supplierReturn.status === "הוסדר";
  const isDraft = supplierReturn.status === "טיוטה";

  const handleAdvance = async () => {
    if (!nextStatus) return;

    // Validation
    if (nextStatus === "נשלח" && !supplierReturn.tracking_number && !trackingInput) {
      setEditingTracking(true);
      toast.error("יש להזין מספר מעקב לפני משלוח");
      return;
    }
    if (nextStatus === "הוסדר" && !resolutionType) {
      toast.error("יש לבחור סוג פתרון לפני הסדרה");
      return;
    }

    setAdvancing(true);
    try {
      const updates: Record<string, unknown> = { status: nextStatus };
      if (nextStatus === "נשלח") {
        updates.shipped_at = new Date().toISOString();
        if (trackingInput) updates.tracking_number = trackingInput;
      }
      if (nextStatus === "התקבל אצל ספק") updates.received_at = new Date().toISOString();
      if (nextStatus === "הוסדר") {
        updates.settled_at = new Date().toISOString();
        updates.resolution_type = resolutionType;
        if (resolutionNotes) updates.resolution_notes = resolutionNotes;
      }

      const { error } = await supabase
        .from("supplier_returns")
        .update(updates)
        .eq("id", supplierReturn.id);

      if (error) throw error;
      toast.success(`סטטוס עודכן ל: ${nextStatus}`);
      onUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "שגיאה בעדכון סטטוס";
      toast.error(msg);
    } finally {
      setAdvancing(false);
    }
  };

  const handleSaveTracking = async () => {
    const { error } = await supabase
      .from("supplier_returns")
      .update({ tracking_number: trackingInput })
      .eq("id", supplierReturn.id);
    if (error) { toast.error("שגיאה בשמירת מספר מעקב"); return; }
    toast.success("מספר מעקב נשמר");
    setEditingTracking(false);
    onUpdated();
  };

  const handleUnlinkItem = async (itemId: string) => {
    const { error } = await supabase.from("waste_items")
      .update({ supplier_return_id: null, disposition_type: null, disposition_date: null })
      .eq("id", itemId);
    if (error) { toast.error("שגיאה בהסרת פריט"); return; }
    toast.success("פריט הוסר מהחזרה");
    onUpdated();
  };

  const handleDeleteReturn = async () => {
    setDeleting(true);
    try {
      // Unlink all items
      const { error: unlinkError } = await supabase
        .from("waste_items")
        .update({ supplier_return_id: null, disposition_type: null, disposition_date: null })
        .eq("supplier_return_id", supplierReturn.id);
      if (unlinkError) throw unlinkError;

      // Delete the return
      const { error: deleteError } = await supabase
        .from("supplier_returns")
        .delete()
        .eq("id", supplierReturn.id);
      if (deleteError) throw deleteError;

      toast.success("ההחזרה נמחקה");
      onUpdated();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "שגיאה במחיקת ההחזרה";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = () => {
    const rows = [
      ["מוצר", 'מק"ט', "כמות"],
      ...items.map(i => [i.product_name, i.sku ?? "", String(i.quantity)])
    ];
    const header = [
      `החזרה לספק: ${supplierReturn.suppliers?.name}`,
      `סטטוס: ${supplierReturn.status}`,
      `מספר מעקב: ${supplierReturn.tracking_number ?? ""}`,
      `סיבה: ${supplierReturn.return_reason ?? ""}`,
      "",
    ];
    const csv = [...header.map(h => h), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }); // BOM for Hebrew Excel
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `החזרה-${supplierReturn.suppliers?.name}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("he-IL") : "—";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="flex-1">החזרה לספק — {supplierReturn.suppliers?.name ?? ""}</span>
            <SupplierReturnStatusBadge status={supplierReturn.status} />
            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={handleExport} title="ייצוא CSV">
              <Download className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Status progress */}
          <div className="flex items-center gap-1 text-sm">
            {STATUS_ORDER.map((s, i) => (
              <span key={s} className="flex items-center gap-1">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  supplierReturn.status === s
                    ? "bg-primary text-primary-foreground"
                    : currentIndex > i
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                    : "bg-muted text-muted-foreground"
                }`}>{s}</span>
                {i < STATUS_ORDER.length - 1 && <ChevronLeft className="h-3 w-3 text-muted-foreground" />}
              </span>
            ))}
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">נוצר ע"י</p>
              <p>{supplierReturn.created_by_name ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">תאריך יצירה</p>
              <p>{formatDate(supplierReturn.created_at)}</p>
            </div>
            {supplierReturn.shipped_at && (
              <div>
                <p className="text-muted-foreground">תאריך משלוח</p>
                <p>{formatDate(supplierReturn.shipped_at)}</p>
              </div>
            )}
            {supplierReturn.received_at && (
              <div>
                <p className="text-muted-foreground">התקבל אצל ספק</p>
                <p>{formatDate(supplierReturn.received_at)}</p>
              </div>
            )}
            {supplierReturn.settled_at && (
              <div>
                <p className="text-muted-foreground">תאריך הסדרה</p>
                <p>{formatDate(supplierReturn.settled_at)}</p>
              </div>
            )}
            {supplierReturn.return_reason && (
              <div className="col-span-2">
                <p className="text-muted-foreground">סיבת החזרה</p>
                <p>{supplierReturn.return_reason}</p>
              </div>
            )}
            {supplierReturn.resolution_type && (
              <div>
                <p className="text-muted-foreground">סוג פתרון</p>
                <p>{supplierReturn.resolution_type}</p>
              </div>
            )}
            {supplierReturn.resolution_notes && (
              <div className="col-span-2">
                <p className="text-muted-foreground">פרטי פתרון</p>
                <p>{supplierReturn.resolution_notes}</p>
              </div>
            )}
            {supplierReturn.notes && (
              <div className="col-span-2">
                <p className="text-muted-foreground">הערות</p>
                <p>{supplierReturn.notes}</p>
              </div>
            )}
          </div>

          {/* Tracking number */}
          <div className="space-y-2">
            <Label>מספר מעקב</Label>
            {editingTracking || !supplierReturn.tracking_number ? (
              <div className="flex gap-2">
                <Input
                  placeholder="JD1234567890"
                  value={trackingInput}
                  onChange={(e) => setTrackingInput(e.target.value)}
                  className="flex-1"
                />
                <Button size="sm" onClick={handleSaveTracking}>שמור</Button>
                {supplierReturn.tracking_number && (
                  <Button size="sm" variant="ghost" onClick={() => setEditingTracking(false)}>ביטול</Button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <code className="font-mono text-sm bg-muted px-2 py-1 rounded">{supplierReturn.tracking_number}</code>
                {!isSettled && (
                  <Button size="sm" variant="ghost" onClick={() => { setTrackingInput(supplierReturn.tracking_number ?? ""); setEditingTracking(true); }}>
                    ערוך
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Return-level photo */}
          <div className="space-y-2">
            <Label>תמונה (אריזה / תווית משלוח)</Label>
            <PhotoCaptureButton
              imageUrl={supplierReturn.photo_url}
              storagePath={`supplier-returns/${supplierReturn.id}`}
              onSave={async (url) => {
                await supabase.from("supplier_returns").update({ photo_url: url }).eq("id", supplierReturn.id);
                onUpdated();
              }}
              disabled={isSettled}
            />
          </div>

          {/* Settlement fields — shown when about to advance to הוסדר */}
          {supplierReturn.status === "התקבל אצל ספק" && (
            <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
              <p className="text-sm font-medium">פרטי הסדרה (נדרש לסיום)</p>
              <div className="space-y-2">
                <Label>סוג פתרון *</Label>
                <Select value={resolutionType} onValueChange={setResolutionType}>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר סוג פתרון..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="זיכוי">זיכוי</SelectItem>
                    <SelectItem value="החלפה">החלפה</SelectItem>
                    <SelectItem value="אחר">אחר</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>הערות פתרון</Label>
                <Textarea
                  placeholder="פרטים על הסדר..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* Linked waste items */}
          <div className="space-y-2">
            <p className="text-sm font-medium">פריטי בלאי ({items.length})</p>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">אין פריטים מקושרים</p>
            ) : (
              <div className="border rounded-md divide-y">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      {item.photo_url && (
                        <img
                          src={item.photo_url}
                          alt={item.product_name}
                          className="h-10 w-10 object-cover rounded border cursor-pointer"
                          onClick={() => window.open(item.photo_url!, "_blank")}
                        />
                      )}
                      <div>
                        <p className="font-medium">{item.product_name}</p>
                        {item.sku && <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{item.quantity} יח׳</span>
                      {isDraft && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-destructive"
                          onClick={() => handleUnlinkItem(item.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Delete draft */}
          {isDraft && (
            <div className="pt-1">
              <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive" disabled={deleting} className="gap-1">
                    <Trash2 className="h-3 w-3" /> מחק החזרה
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent dir="rtl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>מחיקת החזרה</AlertDialogTitle>
                    <AlertDialogDescription>
                      האם למחוק את ההחזרה לספק {supplierReturn.suppliers?.name}? כל הפריטים המקושרים יוסרו ממנה ויחזרו לסטטוס "ממתין".
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>ביטול</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteReturn} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {deleting ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}
                      מחק
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>

        {/* Status advance button */}
        {!isSettled && nextStatus && (
          <div className="pt-2 border-t">
            <Button onClick={handleAdvance} disabled={advancing} className="w-full">
              {advancing && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              קדם ל: {nextStatus}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
