import { useState, useEffect, useRef, useCallback } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Trash2, Wrench, Package, ShoppingCart, Upload, Calendar, X, ExternalLink,
} from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { WasteStatusBadge } from "./WasteStatusBadge";

import { supabase } from "@/lib/supabase";
import { useData, useAuth } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";

import type { WasteItem, WasteSupplierReturn, Profile, Supplier } from "@/contexts/types";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  item: WasteItem | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdated: () => void;
}

// ─── Draft return shape (from supabase query) ─────────────────────────────────

interface DraftReturn {
  id: string;
  supplier_id: string;
  suppliers: { company: string } | null;
}

// ─── Action form types ────────────────────────────────────────────────────────

type ActiveForm = null | "destroy" | "repair" | "sale" | "return";

// ─── Section divider ──────────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 my-1">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className={cn("text-xs text-foreground text-left break-all", mono && "font-mono")}>
        {value}
      </span>
    </div>
  );
}

// ─── Action card ──────────────────────────────────────────────────────────────

interface ActionCardProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  colorClass: string;
  active: boolean;
  onClick: () => void;
}

function ActionCard({ icon, label, description, colorClass, active, onClick }: ActionCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col gap-1 rounded-xl border p-3 text-right transition-all w-full",
        "hover:shadow-sm active:scale-[0.98]",
        active
          ? `${colorClass} border-current/30 shadow-sm ring-2 ring-current/20`
          : "bg-card border-border hover:bg-muted/40",
      )}
    >
      <div className={cn("mb-0.5", active ? "text-current" : "text-muted-foreground")}>
        {icon}
      </div>
      <span className={cn("text-sm font-semibold", active ? "text-current" : "text-foreground")}>
        {label}
      </span>
      <span className={cn("text-[11px] leading-tight", active ? "text-current/80" : "text-muted-foreground")}>
        {description}
      </span>
    </button>
  );
}

// ─── Photo section ────────────────────────────────────────────────────────────

function PhotoSection({
  photoUrl,
  itemId,
  onPhotoUpdated,
}: {
  photoUrl: string | null | undefined;
  itemId: string;
  onPhotoUpdated: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `waste-items/${itemId}/photo_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("waste-files")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from("waste-files").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      const { error: dbErr } = await supabase
        .from("waste_items")
        .update({ photo_url: publicUrl })
        .eq("id", itemId);
      if (dbErr) throw dbErr;

      onPhotoUpdated(publicUrl);
      toast.success("תמונה עודכנה");
    } catch (err) {
      console.error(err);
      toast.error("שגיאה בהעלאת תמונה");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <SectionDivider label="תמונה" />
      {photoUrl ? (
        <div className="relative rounded-xl overflow-hidden border bg-muted/20">
          <img
            src={photoUrl}
            alt="תמונת פריט"
            className="w-full max-h-52 object-contain"
          />
          <a
            href={photoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-2 left-2 rounded-md bg-background/80 border p-1.5 hover:bg-background transition-colors"
            title="פתח בחלון חדש"
          >
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-xl border border-dashed bg-muted/10 h-28 text-muted-foreground text-xs">
          אין תמונה
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFile}
      />
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-3.5 w-3.5" />
        {uploading ? "מעלה..." : photoUrl ? "החלפת תמונה" : "העלאת תמונה"}
      </Button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WasteItemPanel({ item, open, onOpenChange, onUpdated }: Props) {
  const { profiles, suppliers } = useData();
  const { currentUser } = useAuth();

  // ── Local photo state (for instant UI update after upload) ─────────────────
  const [localPhotoUrl, setLocalPhotoUrl] = useState<string | null | undefined>(null);

  // ── Active form ────────────────────────────────────────────────────────────
  const [activeForm, setActiveForm] = useState<ActiveForm>(null);
  const [saving, setSaving] = useState(false);

  // ── Destroy form ───────────────────────────────────────────────────────────
  const [destroyDate, setDestroyDate] = useState("");
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certUploading, setCertUploading] = useState(false);
  const certInputRef = useRef<HTMLInputElement>(null);

  // ── Repair form ────────────────────────────────────────────────────────────
  const [repairTechId, setRepairTechId] = useState("");
  const [repairExpectedDate, setRepairExpectedDate] = useState("");

  // ── Sale form ──────────────────────────────────────────────────────────────
  const [saleBuyer, setSaleBuyer] = useState("");
  const [salePrice, setSalePrice] = useState<string>("");
  const [saleDate, setSaleDate] = useState("");

  // ── Return form ────────────────────────────────────────────────────────────
  const [draftReturns, setDraftReturns] = useState<DraftReturn[]>([]);
  const [draftReturnsLoading, setDraftReturnsLoading] = useState(false);
  const [selectedReturnId, setSelectedReturnId] = useState(""); // existing draft
  const [newReturnSupplierId, setNewReturnSupplierId] = useState(""); // for new return

  // ── Reset on item change ───────────────────────────────────────────────────
  useEffect(() => {
    setActiveForm(null);
    setLocalPhotoUrl(item?.photo_url);
    setDestroyDate("");
    setCertFile(null);
    setRepairTechId("");
    setRepairExpectedDate("");
    setSaleBuyer("");
    setSalePrice("");
    setSaleDate(format(new Date(), "yyyy-MM-dd"));
    setSelectedReturnId("");
    setNewReturnSupplierId("");
    setDraftReturns([]);
     
  }, [item?.id, item?.photo_url]);

  // ── Fetch draft supplier returns when return form opens ────────────────────
  const fetchDraftReturns = useCallback(async () => {
    if (!item) return;
    setDraftReturnsLoading(true);
    try {
      const { data, error } = await supabase
        .from("waste_supplier_returns")
        .select("id, supplier_id, suppliers(company)")
        .eq("status", "draft")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setDraftReturns((data ?? []) as DraftReturn[]);
    } catch (err) {
      console.error(err);
      toast.error("שגיאה בטעינת החזרות קיימות");
    } finally {
      setDraftReturnsLoading(false);
    }
  }, [item]);

  function toggleForm(form: ActiveForm) {
    setActiveForm(prev => {
      const next = prev === form ? null : form;
      if (next === "return") fetchDraftReturns();
      return next;
    });
  }

  if (!item) return null;

  const isPending = item.status === "pending";
  const effectivePhotoUrl = localPhotoUrl !== null ? localPhotoUrl : item.photo_url;

  // ── Profile options for repair technician ──────────────────────────────────
  const profileOptions = profiles.map((p: Profile) => ({
    value: p.id,
    label: p.name,
  }));

  // ── Supplier options for new return ───────────────────────────────────────
  const supplierOptions = suppliers.map((s: Supplier) => ({
    value: s.id,
    label: s.company,
  }));

  // ── Draft return options ───────────────────────────────────────────────────
  const draftReturnOptions = draftReturns.map(r => ({
    value: r.id,
    label: `${r.suppliers?.company ?? "ספק לא ידוע"} — ${r.id.slice(0, 8)}`,
  }));

  // ────────────────────────────────────────────────────────────────────────────
  // Action handlers
  // ────────────────────────────────────────────────────────────────────────────

  async function setDestroyed() {
    if (!destroyDate) { toast.error("יש לבחור תאריך השמדה"); return; }
    setSaving(true);
    try {
      let certUrl: string | null = null;

      // Upload certificate if provided
      if (certFile) {
        setCertUploading(true);
        const ext = certFile.name.split(".").pop() ?? "pdf";
        const path = `waste-items/${item.id}/cert_${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("waste-files")
          .upload(path, certFile, { upsert: true });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("waste-files").getPublicUrl(path);
        certUrl = urlData.publicUrl;
        setCertUploading(false);
      }

      const { error } = await supabase
        .from("waste_items")
        .update({
          status: "destroyed",
          destruction_date: destroyDate,
          destruction_certificate_url: certUrl,
        })
        .eq("id", item.id);
      if (error) throw error;

      toast.success("הפריט סומן כהושמד");
      setActiveForm(null);
      onUpdated();
    } catch (err) {
      console.error(err);
      toast.error("שגיאה בשמירה");
    } finally {
      setSaving(false);
      setCertUploading(false);
    }
  }

  async function setRepair() {
    if (!repairTechId) { toast.error("יש לבחור טכנאי"); return; }
    if (!repairExpectedDate) { toast.error("יש לבחור תאריך החזרה צפוי"); return; }
    setSaving(true);
    try {
      const tech = profiles.find((p: Profile) => p.id === repairTechId);
      const { error } = await supabase
        .from("waste_items")
        .update({
          status: "repairing",
          repair_technician_id: repairTechId,
          repair_technician_name: tech?.name ?? null,
          repair_expected_date: repairExpectedDate,
        })
        .eq("id", item.id);
      if (error) throw error;

      toast.success("הפריט נשלח לתיקון");
      setActiveForm(null);
      onUpdated();
    } catch (err) {
      console.error(err);
      toast.error("שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  async function setSold() {
    if (!saleBuyer.trim()) { toast.error("יש להזין שם קונה"); return; }
    if (!salePrice || Number(salePrice) <= 0) { toast.error("יש להזין מחיר מכירה תקין"); return; }
    if (!saleDate) { toast.error("יש לבחור תאריך מכירה"); return; }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("waste_items")
        .update({
          status: "sold",
          sale_buyer: saleBuyer.trim(),
          sale_price: Number(salePrice),
          sale_date: saleDate,
        })
        .eq("id", item.id);
      if (error) throw error;

      toast.success("הפריט סומן כנמכר");
      setActiveForm(null);
      onUpdated();
    } catch (err) {
      console.error(err);
      toast.error("שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  async function addToReturn(returnId: string) {
    setSaving(true);
    try {
      // Insert junction row
      const { error: junctionErr } = await supabase
        .from("waste_return_items")
        .insert({ return_id: returnId, waste_item_id: item.id });
      if (junctionErr) throw junctionErr;

      // Update waste item status
      const { error: itemErr } = await supabase
        .from("waste_items")
        .update({ status: "returning", return_id: returnId })
        .eq("id", item.id);
      if (itemErr) throw itemErr;

      toast.success("הפריט נוסף להחזרה לספק");
      setActiveForm(null);
      onUpdated();
    } catch (err) {
      console.error(err);
      toast.error("שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  async function createReturn() {
    if (!newReturnSupplierId) { toast.error("יש לבחור ספק"); return; }
    setSaving(true);
    try {
      // Create new draft return
      const { data: newReturn, error: insertErr } = await supabase
        .from("waste_supplier_returns")
        .insert({
          supplier_id: newReturnSupplierId,
          status: "draft",
          created_by: currentUser?.id ?? null,
          created_by_name: currentUser?.name ?? null,
        })
        .select("id")
        .single();
      if (insertErr) throw insertErr;

      await addToReturn(newReturn.id);
    } catch (err) {
      console.error(err);
      toast.error("שגיאה ביצירת החזרה");
      setSaving(false);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Render helpers for disposition details (non-pending statuses)
  // ────────────────────────────────────────────────────────────────────────────

  function renderDispositionDetails() {
    switch (item.status) {
      case "destroyed":
        return (
          <div className="space-y-1">
            <SectionDivider label="פרטי השמדה" />
            <InfoRow
              label="תאריך השמדה"
              value={item.destruction_date
                ? format(new Date(item.destruction_date), "dd/MM/yyyy")
                : "—"}
            />
            <InfoRow
              label="תעודת השמדה"
              value={
                item.destruction_certificate_url
                  ? (
                    <a
                      href={item.destruction_certificate_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      הצגת תעודה <ExternalLink className="h-3 w-3" />
                    </a>
                  )
                  : <span className="text-muted-foreground">לא הועלתה</span>
              }
            />
          </div>
        );

      case "repairing":
        return (
          <div className="space-y-1">
            <SectionDivider label="פרטי תיקון" />
            <InfoRow label="טכנאי" value={item.repair_technician_name ?? "—"} />
            <InfoRow
              label="תאריך החזרה צפוי"
              value={item.repair_expected_date
                ? format(new Date(item.repair_expected_date), "dd/MM/yyyy")
                : "—"}
            />
            {item.repair_completed_date && (
              <InfoRow
                label="תאריך השלמה"
                value={format(new Date(item.repair_completed_date), "dd/MM/yyyy")}
              />
            )}
          </div>
        );

      case "sold":
        return (
          <div className="space-y-1">
            <SectionDivider label="פרטי מכירה" />
            <InfoRow label="קונה" value={item.sale_buyer ?? "—"} />
            <InfoRow
              label="מחיר"
              value={item.sale_price != null
                ? `₪${item.sale_price.toLocaleString("he")}`
                : "—"}
            />
            <InfoRow
              label="תאריך מכירה"
              value={item.sale_date
                ? format(new Date(item.sale_date), "dd/MM/yyyy")
                : "—"}
            />
          </div>
        );

      case "returning":
        return (
          <div className="space-y-1">
            <SectionDivider label="פרטי החזרה לספק" />
            <InfoRow label="מזהה החזרה" value={item.return_id?.slice(0, 8) ?? "—"} mono />
          </div>
        );

      default:
        return null;
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Inline form renderers
  // ────────────────────────────────────────────────────────────────────────────

  function renderDestroyForm() {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/60 p-4 space-y-3">
        <p className="text-sm font-semibold text-red-700">פרטי השמדה</p>

        <div className="space-y-1.5">
          <Label className="text-xs">תאריך השמדה <span className="text-destructive">*</span></Label>
          <div className="relative">
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="date"
              value={destroyDate}
              onChange={e => setDestroyDate(e.target.value)}
              className="pr-9 text-sm"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">תעודת השמדה (אופציונלי)</Label>
          <div className="flex items-center gap-2">
            <input
              ref={certInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={e => setCertFile(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 flex-1"
              onClick={() => certInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              {certFile ? certFile.name : "בחר קובץ"}
            </Button>
            {certFile && (
              <button
                type="button"
                onClick={() => {
                  setCertFile(null);
                  if (certInputRef.current) certInputRef.current.value = "";
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {certFile && (
            <p className="text-[11px] text-muted-foreground">{certFile.name}</p>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            onClick={() => setActiveForm(null)}
          >
            ביטול
          </Button>
          <Button
            size="sm"
            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            onClick={setDestroyed}
            disabled={saving || certUploading || !destroyDate}
          >
            {saving || certUploading ? "שומר..." : "אישור השמדה"}
          </Button>
        </div>
      </div>
    );
  }

  function renderRepairForm() {
    return (
      <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-4 space-y-3">
        <p className="text-sm font-semibold text-purple-700">פרטי שליחה לתיקון</p>

        <div className="space-y-1.5">
          <Label className="text-xs">טכנאי <span className="text-destructive">*</span></Label>
          <Combobox
            options={profileOptions}
            value={repairTechId}
            onValueChange={setRepairTechId}
            placeholder="בחר טכנאי..."
            searchPlaceholder="חיפוש..."
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">תאריך החזרה צפוי <span className="text-destructive">*</span></Label>
          <div className="relative">
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="date"
              value={repairExpectedDate}
              onChange={e => setRepairExpectedDate(e.target.value)}
              className="pr-9 text-sm"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            onClick={() => setActiveForm(null)}
          >
            ביטול
          </Button>
          <Button
            size="sm"
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
            onClick={setRepair}
            disabled={saving || !repairTechId || !repairExpectedDate}
          >
            {saving ? "שומר..." : "שלח לתיקון"}
          </Button>
        </div>
      </div>
    );
  }

  function renderSaleForm() {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50/60 p-4 space-y-3">
        <p className="text-sm font-semibold text-green-700">פרטי מכירה</p>

        <div className="space-y-1.5">
          <Label className="text-xs">שם קונה <span className="text-destructive">*</span></Label>
          <Input
            value={saleBuyer}
            onChange={e => setSaleBuyer(e.target.value)}
            placeholder="שם הקונה..."
            className="text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">מחיר מכירה (₪) <span className="text-destructive">*</span></Label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={salePrice}
            onChange={e => setSalePrice(e.target.value)}
            placeholder="0.00"
            className="text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">תאריך מכירה <span className="text-destructive">*</span></Label>
          <div className="relative">
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="date"
              value={saleDate}
              onChange={e => setSaleDate(e.target.value)}
              className="pr-9 text-sm"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            onClick={() => setActiveForm(null)}
          >
            ביטול
          </Button>
          <Button
            size="sm"
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            onClick={setSold}
            disabled={saving || !saleBuyer.trim() || !salePrice || !saleDate}
          >
            {saving ? "שומר..." : "אישור מכירה"}
          </Button>
        </div>
      </div>
    );
  }

  function renderReturnForm() {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 space-y-4">
        <p className="text-sm font-semibold text-blue-700">החזרה לספק</p>

        {/* Existing draft returns */}
        <div className="space-y-1.5">
          <Label className="text-xs">הוסף להחזרה קיימת (טיוטה)</Label>
          {draftReturnsLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border border-muted border-t-primary" />
              טוען...
            </div>
          ) : draftReturns.length === 0 ? (
            <p className="text-xs text-muted-foreground">אין החזרות בטיוטה</p>
          ) : (
            <Combobox
              options={draftReturnOptions}
              value={selectedReturnId}
              onValueChange={setSelectedReturnId}
              placeholder="בחר החזרה קיימת..."
              searchPlaceholder="חיפוש..."
            />
          )}
          {selectedReturnId && (
            <Button
              size="sm"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-1"
              onClick={() => addToReturn(selectedReturnId)}
              disabled={saving}
            >
              {saving ? "שומר..." : "הוסף להחזרה זו"}
            </Button>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-blue-200" />
          <span className="text-[10px] font-medium text-blue-500">או</span>
          <div className="h-px flex-1 bg-blue-200" />
        </div>

        {/* New return */}
        <div className="space-y-1.5">
          <Label className="text-xs">צור החזרה חדשה</Label>
          <Combobox
            options={supplierOptions}
            value={newReturnSupplierId}
            onValueChange={setNewReturnSupplierId}
            placeholder="בחר ספק..."
            searchPlaceholder="חיפוש ספק..."
          />
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            onClick={() => setActiveForm(null)}
          >
            ביטול
          </Button>
          <Button
            size="sm"
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            onClick={createReturn}
            disabled={saving || !newReturnSupplierId}
          >
            {saving ? "יוצר..." : "צור החזרה חדשה"}
          </Button>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Main render
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-full sm:max-w-md flex flex-col p-0 gap-0 overflow-hidden"
        aria-describedby={undefined}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <SheetHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base leading-snug truncate">
                {item.product_name ?? <span className="text-muted-foreground italic text-sm">מוצר לא ידוע</span>}
              </SheetTitle>
              {item.product_sku && (
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{item.product_sku}</p>
              )}
            </div>
            <WasteStatusBadge status={item.status} className="shrink-0 mt-0.5" />
          </div>
        </SheetHeader>

        {/* ── Scrollable body ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" dir="rtl">

          {/* Basic info */}
          <div className="space-y-0.5">
            <InfoRow label="כמות" value={item.quantity.toLocaleString("he")} />
            {item.condition_notes && (
              <InfoRow label="תיאור המצב" value={item.condition_notes} />
            )}
            {item.source && (
              <InfoRow
                label="מקור"
                value={
                  item.source === "equipment_return"
                    ? "החזרת ציוד"
                    : "ידני"
                }
              />
            )}
          </div>

          {/* Photo */}
          <PhotoSection
            photoUrl={effectivePhotoUrl}
            itemId={item.id}
            onPhotoUpdated={url => setLocalPhotoUrl(url)}
          />

          {/* ── Pending: action cards + forms ────────────────────────────── */}
          {isPending && (
            <div className="space-y-3">
              <SectionDivider label="קביעת גורל הפריט" />

              {/* 2×2 action grid */}
              <div className="grid grid-cols-2 gap-2">
                <ActionCard
                  icon={<Trash2 className="h-5 w-5" />}
                  label="השמדה"
                  description="סלק את הפריט והנפק תעודת השמדה"
                  colorClass="bg-red-50 text-red-700"
                  active={activeForm === "destroy"}
                  onClick={() => toggleForm("destroy")}
                />
                <ActionCard
                  icon={<Package className="h-5 w-5" />}
                  label="החזרה לספק"
                  description="הוסף להחזרה קיימת או צור חדשה"
                  colorClass="bg-blue-50 text-blue-700"
                  active={activeForm === "return"}
                  onClick={() => toggleForm("return")}
                />
                <ActionCard
                  icon={<Wrench className="h-5 w-5" />}
                  label="תיקון"
                  description="שלח לטכנאי לתיקון ותעד תאריך חזרה"
                  colorClass="bg-purple-50 text-purple-700"
                  active={activeForm === "repair"}
                  onClick={() => toggleForm("repair")}
                />
                <ActionCard
                  icon={<ShoppingCart className="h-5 w-5" />}
                  label="מכירה"
                  description="תעד מכירת הפריט לקונה חיצוני"
                  colorClass="bg-green-50 text-green-700"
                  active={activeForm === "sale"}
                  onClick={() => toggleForm("sale")}
                />
              </div>

              {/* Inline forms */}
              {activeForm === "destroy" && renderDestroyForm()}
              {activeForm === "return"  && renderReturnForm()}
              {activeForm === "repair"  && renderRepairForm()}
              {activeForm === "sale"    && renderSaleForm()}
            </div>
          )}

          {/* ── Non-pending: show disposition details ────────────────────── */}
          {!isPending && renderDispositionDetails()}

          {/* ── Audit footer ──────────────────────────────────────────────── */}
          <div className="pt-2 border-t space-y-0.5">
            <InfoRow
              label='נוצר ע"י'
              value={item.created_by_name ?? "—"}
            />
            <InfoRow
              label="תאריך יצירה"
              value={format(new Date(item.created_at), "dd/MM/yyyy")}
            />
            {item.updated_at && item.updated_at !== item.created_at && (
              <InfoRow
                label="עדכון אחרון"
                value={format(new Date(item.updated_at), "dd/MM/yyyy")}
              />
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
